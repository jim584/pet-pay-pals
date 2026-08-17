import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";
import { recomputeDisbursementEligibility } from "../_shared/disbursement.ts";

/**
 * Requirement 12: a settled (or reversed) direct payment to the veterinarian
 * changes whether the ticket's campaign may be disbursed, so recompute it.
 */
// deno-lint-ignore no-explicit-any
async function syncTicketDisbursement(admin: any, ticketId: string) {
  try {
    const { data: campaign } = await admin
      .from("help_now_campaigns").select("id").eq("ticket_id", ticketId).maybeSingle();
    if (campaign?.id) await recomputeDisbursementEligibility(admin, campaign.id);
  } catch (e) {
    console.error("syncTicketDisbursement failed:", e);
  }
}


// Public webhook endpoint — no JWT verification.
Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const sig = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const rawBody = await req.text();

  let event: Stripe.Event;
  // Fail closed. An unsigned or unverifiable payload is never processed —
  // this endpoint moves money and must not accept unauthenticated input.
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured; refusing webhook.");
    return new Response("Webhook Error: signing secret not configured", { status: 500 });
  }
  if (!sig) {
    return new Response("Webhook Error: missing stripe-signature header", { status: 400 });
  }
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
  } catch (e) {
    console.error("Webhook signature verification failed:", e);
    return new Response(`Webhook Error: ${(e as Error).message}`, { status: 400 });
  }

  // ---- Replay protection: record event id; skip only if already succeeded ----
  const { error: dedupErr } = await admin.from("webhook_events").insert({
    provider: "stripe",
    event_id: event.id,
    event_type: event.type,
    payload: event as any,
    status: "processing",
  });
  if (dedupErr) {
    if ((dedupErr as any).code === "23505") {
      // Already seen. Only treat it as a duplicate if the earlier attempt
      // actually succeeded — a previously failed or stalled attempt must be
      // reprocessed, otherwise Stripe's retry silently drops the event.
      const { data: prior } = await admin.from("webhook_events")
        .select("status, processed_at")
        .eq("provider", "stripe").eq("event_id", event.id)
        .maybeSingle();

      const priorStatus = prior?.status ?? "processing";
      const stalledFor = prior?.processed_at
        ? Date.now() - new Date(prior.processed_at).getTime()
        : Number.MAX_SAFE_INTEGER;
      const isStalled = priorStatus === "processing" && stalledFor > 5 * 60 * 1000;

      if (priorStatus === "processed") {
        console.log(`Duplicate webhook event ignored: ${event.id} (${event.type})`);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }
      if (priorStatus === "processing" && !isStalled) {
        // Genuinely in flight elsewhere — ask Stripe to retry later.
        return new Response(JSON.stringify({ error: "event in flight" }), { status: 409 });
      }

      // Failed or stalled: retake ownership and reprocess.
      console.log(`Reprocessing ${priorStatus} webhook event: ${event.id} (${event.type})`);
      await admin.from("webhook_events")
        .update({ status: "processing", error: null, processed_at: new Date().toISOString() })
        .eq("provider", "stripe").eq("event_id", event.id);
    } else {
      console.error("webhook_events insert failed:", dedupErr);
      // Logging failure must not silently drop a money event.
      return new Response(JSON.stringify({ error: "event log unavailable" }), { status: 500 });
    }
  }


  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const md = s.metadata || {};

        // BNPL autopay setup — capture the PaymentMethod from the SetupIntent
        if (md.kind === "bnpl_autopay_setup" && md.user_id && s.mode === "setup") {
          try {
            const siId = typeof s.setup_intent === "string" ? s.setup_intent : s.setup_intent?.id;
            if (siId) {
              const si = await stripe.setupIntents.retrieve(siId);
              const pmId = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
              const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id;
              if (pmId && customerId) {
                try {
                  await stripe.customers.update(customerId, {
                    invoice_settings: { default_payment_method: pmId },
                  });
                } catch (e) { console.error("set customer default pm failed:", e); }
                await admin.from("profiles")
                  .update({ default_payment_method_id: pmId })
                  .eq("user_id", md.user_id);
              }
            }
          } catch (e) { console.error("autopay setup capture failed:", e); }
          break;
        }

        // Community wallet donation — the ONLY path allowed to credit a
        // recipient wallet, and only after Stripe confirms the charge.
        if (md.kind === "wallet_donation" && md.to_user_id && s.payment_status === "paid") {
          const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
          if (pi) {
            const { data: dup } = await admin.from("payment_history")
              .select("id").eq("stripe_payment_intent_id", pi).maybeSingle();
            if (dup) break;
          }
          const amount = (s.amount_total ?? 0) / 100;

          const { error: donErr } = await admin.rpc("process_donation", {
            _from_user_id: md.from_user_id || null,
            _to_user_id: md.to_user_id,
            _amount: amount,
            _story_id: md.story_id && md.story_id.length > 0 ? md.story_id : null,
          });
          if (donErr) throw donErr;

          if (md.from_user_id) {
            await admin.from("payment_history").insert({
              user_id: md.from_user_id,
              kind: "donation",
              status: "paid",
              amount,
              currency: s.currency || "usd",
              description: "Community donation",
              stripe_payment_intent_id: pi,
              occurred_at: new Date().toISOString(),
            });
          }
          break;
        }

        // Sponsorship donation payment

        if (md.kind === "sponsorship_donation" && md.pet_id && s.payment_status === "paid") {
          const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
          // Idempotency: skip if we already recorded this PI
          if (pi) {
            const { data: dup } = await admin.from("payment_history")
              .select("id").eq("stripe_payment_intent_id", pi).maybeSingle();
            if (dup) break;
          }
          const amount = (s.amount_total ?? 0) / 100;
          const userId = md.user_id && md.user_id.length > 0 ? md.user_id : null;

          if (userId) {
            await admin.from("sponsorship_donations").insert({
              pet_id: md.pet_id,
              user_id: userId,
              amount,
              donor_name: md.donor_name || null,
              donor_email: md.donor_email || s.customer_details?.email || null,
              message: md.message || null,
            });
          }

          if (userId) {
            await admin.from("payment_history").insert({
              user_id: userId,
              kind: "donation",
              status: "paid",
              amount,
              currency: s.currency || "usd",
              description: `Sponsorship donation`,
              stripe_payment_intent_id: pi,
              occurred_at: new Date().toISOString(),
            });
          }
          if (md.milestone_id) {
            try {
              await admin.rpc("record_milestone_contribution", {
                _milestone_id: md.milestone_id,
                _amount: amount,
                _source: "donation",
                _payment_history_id: null,
              });
            } catch (e) { console.error("milestone contribution failed:", e); }
          }
          break;
        }

        // Vet ticket member-remainder payment
        if (md.kind === "vet_ticket_remainder" && md.vet_ticket_id) {
          const ticketId = md.vet_ticket_id;
          const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
          // Idempotency
          if (pi) {
            const { data: dup } = await admin.from("payment_history")
              .select("id").eq("stripe_payment_intent_id", pi).maybeSingle();
            if (dup) break;
          }
          const { data: t } = await admin.from("vet_tickets")
            .select("approved_amount, status, owner_id, clinic_name").eq("id", ticketId).maybeSingle();
          if (t && t.status === "approved") {
            await admin.from("vet_tickets").update({
              status: "funded", member_remainder_paid: true,
            }).eq("id", ticketId);
            if (Number(t.approved_amount ?? 0) > 0) {
              await admin.from("vet_payouts").insert({
                ticket_id: ticketId, amount: Number(t.approved_amount),
                method: "manual_ach", status: "pending",
              });
            }
            // Lookup any BNPL obligation for this ticket
            const { data: ob } = await admin.from("bnpl_obligations")
              .select("id").eq("ticket_id", ticketId).maybeSingle();

            await admin.from("payment_history").insert({
              user_id: t.owner_id,
              kind: "member_remainder",
              status: "paid",
              amount: (s.amount_total ?? 0) / 100,
              currency: s.currency || "usd",
              description: `Vet bill member remainder — ${t.clinic_name ?? ""}`.trim(),
              stripe_payment_intent_id: pi,
              vet_ticket_id: ticketId,
              bnpl_obligation_id: ob?.id ?? null,
              occurred_at: new Date().toISOString(),
            });

            // Auto-issue card
            await invokeIssueCard(ticketId);
          }
          break;
        }

        // BNPL installment / full balance payment
        if (md.kind === "bnpl_payment" && md.obligation_id) {
          const obligationId = md.obligation_id as string;
          const installmentId = (md.installment_id as string) || null;
          const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
          if (pi) {
            const { data: dup } = await admin.from("payment_history")
              .select("id").eq("stripe_payment_intent_id", pi).maybeSingle();
            if (dup) break;
          }
          const { data: ob } = await admin.from("bnpl_obligations")
            .select("id, owner_id, pet_id").eq("id", obligationId).maybeSingle();
          if (!ob) break;
          const amountUsd = (s.amount_total ?? 0) / 100;
          // Insert payment (trigger updates outstanding & installments)
          await admin.from("bnpl_payments").insert({
            obligation_id: obligationId,
            amount: amountUsd,
            method: "stripe",
            external_ref: pi,
            notes: installmentId ? `installment ${installmentId}` : "full balance",
            recorded_by: ob.owner_id,
          });
          await postLedger(admin, {
            user_id: ob.owner_id,
            pet_id: ob.pet_id,
            obligation_id: ob.id,
            bucket: "bnpl",
            entry_type: "finalize",
            amount: amountUsd,
            external_ref: pi,
            idempotency_key: `bnpl_payment:${pi ?? s.id}`,
            description: "Payment plan repayment",
          });
          await admin.from("payment_history").insert({
            user_id: ob.owner_id,
            kind: "bnpl_payment",
            status: "paid",
            amount: amountUsd,
            currency: s.currency || "usd",
            description: "Payment plan installment",
            stripe_payment_intent_id: pi,
            bnpl_obligation_id: obligationId,
            occurred_at: new Date().toISOString(),
          });

          break;
        }


        const subId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
        if (!md.user_id || !md.plan_id || !subId) break;
        if (!md.pet_id) {
          console.error("membership checkout completed without pet_id", { session: s.id });
          break;
        }

        const sub = await stripe.subscriptions.retrieve(subId);
        await admin.from("memberships").insert({
          user_id: md.user_id,
          pet_id: md.pet_id,
          plan_id: md.plan_id,
          status: "active",
          billing_interval: md.billing_interval || "month",
          is_fear_free_member: md.is_fear_free_member === "true",
          stripe_subscription_id: subId,
          stripe_customer_id: typeof s.customer === "string" ? s.customer : s.customer?.id,
          started_at: new Date().toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        });
        break;
      }

      // Off-session BNPL autopay PaymentIntent (no Checkout session)
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const md = pi.metadata || {};
        if (md.kind !== "bnpl_payment" || !md.obligation_id) break;
        // Skip if a Checkout session already recorded it (it would have an existing payment_history row)
        const { data: dup } = await admin.from("payment_history")
          .select("id").eq("stripe_payment_intent_id", pi.id).maybeSingle();
        if (dup) break;
        const { data: ob } = await admin.from("bnpl_obligations")
          .select("id, owner_id, pet_id").eq("id", md.obligation_id).maybeSingle();
        if (!ob) break;
        const amountUsd = (pi.amount_received ?? pi.amount ?? 0) / 100;
        await admin.from("bnpl_payments").insert({
          obligation_id: ob.id,
          amount: amountUsd,
          method: "stripe_autopay",
          external_ref: pi.id,
          notes: md.installment_id ? `autopay installment ${md.installment_id}` : "autopay",
          recorded_by: ob.owner_id,
        });
        await postLedger(admin, {
          user_id: ob.owner_id,
          pet_id: ob.pet_id,
          obligation_id: ob.id,
          bucket: "bnpl",
          entry_type: "finalize",
          amount: amountUsd,
          external_ref: pi.id,
          idempotency_key: `bnpl_payment:${pi.id}`,
          description: "Payment plan autopay repayment",
        });
        await admin.from("payment_history").insert({
          user_id: ob.owner_id,
          kind: "bnpl_payment",
          status: "paid",
          amount: amountUsd,
          currency: pi.currency || "usd",
          description: "Payment plan autopay",
          stripe_payment_intent_id: pi.id,
          bnpl_obligation_id: ob.id,
          occurred_at: new Date().toISOString(),
        });
        break;
      }

      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;
        if (!subId) break;

        const { data: m } = await admin.from("memberships")
          .select("id, user_id, pet_id, plan_id, is_fear_free_member, billing_interval, continuous_paid_months, last_paid_month, reserve_eligible_since")
          .eq("stripe_subscription_id", subId).maybeSingle();
        if (!m) break;

        const { data: plan } = await admin.from("membership_plans").select("*").eq("id", m.plan_id).single();
        if (!plan) break;

        // Record payment in user-visible history (idempotent via select-then-write)
        await upsertPaymentByInvoice(admin, inv.id, {
          user_id: m.user_id,
          membership_id: m.id,
          kind: "membership_invoice",
          status: "paid",
          amount: (inv.amount_paid ?? 0) / 100,
          currency: inv.currency || "usd",
          description: inv.lines?.data?.[0]?.description || `${plan.tier_label} membership`,
          stripe_invoice_id: inv.id,
          stripe_charge_id: typeof inv.charge === "string" ? inv.charge : inv.charge?.id ?? null,
          stripe_payment_intent_id: typeof inv.payment_intent === "string" ? inv.payment_intent : inv.payment_intent?.id ?? null,
          stripe_subscription_id: subId,
          hosted_invoice_url: inv.hosted_invoice_url ?? null,
          invoice_pdf: inv.invoice_pdf ?? null,
          occurred_at: new Date(((inv.status_transitions?.paid_at ?? inv.created) || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        });

        // Per-month DP accrual (annual still accrues monthly rows for rolling expiry).
        // Skip if accruals already exist for this invoice (idempotent on webhook retries).
        const { data: existingAccrual } = await admin
          .from("direct_pay_accruals")
          .select("id")
          .eq("stripe_invoice_id", inv.id)
          .limit(1)
          .maybeSingle();

        if (!existingAccrual) {
          const monthlyDP = m.is_fear_free_member
            ? Number(plan.direct_pay_portion) * 0.95
            : Number(plan.direct_pay_portion);

          const monthsCovered = m.billing_interval === "year" ? 12 : 1;
          const now = new Date();

          for (let i = 0; i < monthsCovered; i++) {
            const accrualMonth = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const expiresAt = plan.dp_window_months
              ? new Date(accrualMonth.getFullYear(), accrualMonth.getMonth() + plan.dp_window_months, 1)
              : null;
            const { data: accrualRow } = await admin.from("direct_pay_accruals").insert({
              membership_id: m.id,
              user_id: m.user_id,
              accrual_month: accrualMonth.toISOString().slice(0, 10),
              amount: monthlyDP,
              remaining_amount: monthlyDP,
              expires_at: expiresAt ? expiresAt.toISOString() : null,
              stripe_invoice_id: inv.id,
            }).select("id").single();

            await postLedger(admin, {
              user_id: m.user_id,
              pet_id: m.pet_id ?? null,
              membership_id: m.id,
              bucket: "direct_pay",
              entry_type: "accrual",
              amount: monthlyDP,
              accrual_id: accrualRow?.id ?? null,
              external_ref: inv.id,
              idempotency_key: `dp_accrual:${inv.id}:${i}`,
              description: "Direct Pay accrual from membership invoice",
            });
          }
        }

        // Per-month MEMBER RESERVE accrual (10% allocated to each member's personal reserve).
        // Idempotent on invoice id.
        const { data: existingReserve } = await admin
          .from("member_reserve_accruals")
          .select("id").eq("stripe_invoice_id", inv.id).limit(1).maybeSingle();
        if (!existingReserve) {
          const monthlyReserve = Number(plan.reserve_portion ?? 0);
          const monthsCovered = m.billing_interval === "year" ? 12 : 1;
          const nowR = new Date();
          if (monthlyReserve > 0) {
            for (let i = 0; i < monthsCovered; i++) {
              const accrualMonth = new Date(nowR.getFullYear(), nowR.getMonth() + i, 1);
              const { data: reserveRow } = await admin.from("member_reserve_accruals").insert({
                membership_id: m.id,
                user_id: m.user_id,
                accrual_month: accrualMonth.toISOString().slice(0, 10),
                amount: monthlyReserve,
                remaining_amount: monthlyReserve,
                stripe_invoice_id: inv.id,
              }).select("id").single();

              await postLedger(admin, {
                user_id: m.user_id,
                pet_id: m.pet_id ?? null,
                membership_id: m.id,
                bucket: "member_reserve",
                entry_type: "accrual",
                amount: monthlyReserve,
                accrual_id: reserveRow?.id ?? null,
                external_ref: inv.id,
                idempotency_key: `reserve_accrual:${inv.id}:${i}`,
                description: "Member Reserve accrual from membership invoice",
              });
            }
          }


          // Continuous-paid-months counter + reserve eligibility (12 consecutive months).
          // Detect a gap since last paid month: if the previous paid month is not the
          // immediately preceding calendar month, the streak is broken and we restart.
          const monthsCount = m.billing_interval === "year" ? 12 : 1;
          const thisMonthStart = new Date(nowR.getFullYear(), nowR.getMonth(), 1);
          const lastPaidMonth = thisMonthStart.toISOString().slice(0, 10);

          let priorCount = Number(m.continuous_paid_months ?? 0);
          let priorEligibleSince = m.reserve_eligible_since as string | null;

          if (m.last_paid_month) {
            const prev = new Date(m.last_paid_month + "T00:00:00Z");
            // expected previous month = thisMonthStart - 1 month (UTC-safe via year/month math)
            const expectedPrevYear = thisMonthStart.getUTCFullYear();
            const expectedPrevMonth = thisMonthStart.getUTCMonth() - 1;
            const expected = new Date(Date.UTC(expectedPrevYear, expectedPrevMonth, 1));
            // Annual subs: last_paid_month was set to first month of last cycle; allow up to 12 months back.
            const maxBackMonths = m.billing_interval === "year" ? 12 : 1;
            const monthsDiff =
              (thisMonthStart.getUTCFullYear() - prev.getUTCFullYear()) * 12 +
              (thisMonthStart.getUTCMonth() - prev.getUTCMonth());
            if (monthsDiff > maxBackMonths) {
              // Gap detected — streak broken, restart counter and clear eligibility
              priorCount = 0;
              priorEligibleSince = null;
            }
          } else {
            // No previous paid month recorded — fresh start
            priorCount = 0;
            priorEligibleSince = null;
          }

          const newCount = priorCount + monthsCount;
          const eligibleSince = !priorEligibleSince && newCount >= 12
            ? new Date().toISOString()
            : priorEligibleSince;

          await admin.from("memberships").update({
            continuous_paid_months: newCount,
            last_paid_month: lastPaidMonth,
            reserve_eligible_since: eligibleSince,
          }).eq("id", m.id);
        }

        // Update period end
        const sub = await stripe.subscriptions.retrieve(subId);
        await admin.from("memberships").update({
          status: "active",
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq("id", m.id);

        // Referral bounty accrual (best-effort; never block invoice processing)
        try {
          await accrueReferralBounty(admin, {
            userId: m.user_id,
            membershipId: m.id,
            invoiceId: inv.id,
            paidAmount: (inv.amount_paid ?? 0) / 100,
          });
        } catch (e) { console.error("referral accrual failed:", e); }
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;
        if (!subId) break;
        const { data: m } = await admin.from("memberships")
          .select("id, user_id").eq("stripe_subscription_id", subId).maybeSingle();
        if (!m) break;
        await upsertPaymentByInvoice(admin, inv.id, {
          user_id: m.user_id,
          membership_id: m.id,
          kind: "membership_invoice",
          status: "failed",
          amount: (inv.amount_due ?? 0) / 100,
          currency: inv.currency || "usd",
          description: "Membership payment failed",
          stripe_invoice_id: inv.id,
          stripe_subscription_id: subId,
          hosted_invoice_url: inv.hosted_invoice_url ?? null,
        });
        // Payment failed: lapse breaks continuous-payment streak; resets reserve eligibility clock.
        await admin.from("memberships").update({
          status: "past_due",
          continuous_paid_months: 0,
          reserve_eligible_since: null,
        }).eq("id", m.id);
        break;
      }

      case "charge.refunded": {
        const ch = event.data.object as Stripe.Charge;
        const customerId = typeof ch.customer === "string" ? ch.customer : ch.customer?.id;
        if (!customerId) break;
        const { data: m } = await admin.from("memberships")
          .select("id, user_id").eq("stripe_customer_id", customerId)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!m) break;
        await admin.from("payment_history").insert({
          user_id: m.user_id,
          membership_id: m.id,
          kind: "refund",
          status: "refunded",
          amount: (ch.amount_refunded ?? 0) / 100,
          currency: ch.currency || "usd",
          description: "Refund issued",
          stripe_charge_id: ch.id,
          stripe_payment_intent_id: typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id ?? null,
        });
        break;
      }

      // Disputes on regular charges (member remainder, BNPL repayments, donations).
      case "charge.dispute.created":
      case "charge.dispute.closed": {
        const d = event.data.object as Stripe.Dispute;
        const piId = typeof d.payment_intent === "string" ? d.payment_intent : d.payment_intent?.id ?? null;
        if (!piId) break;
        const { data: ph } = await admin.from("payment_history")
          .select("id, user_id, membership_id, vet_ticket_id, bnpl_obligation_id, amount")
          .eq("stripe_payment_intent_id", piId).maybeSingle();
        if (!ph) break;
        const amountUsd = (d.amount ?? 0) / 100;

        if (event.type === "charge.dispute.created") {
          await admin.from("payment_history").insert({
            user_id: ph.user_id,
            membership_id: ph.membership_id,
            vet_ticket_id: ph.vet_ticket_id,
            bnpl_obligation_id: ph.bnpl_obligation_id,
            kind: "dispute",
            status: "disputed",
            amount: amountUsd,
            currency: d.currency || "usd",
            description: "Payment disputed by cardholder",
            stripe_payment_intent_id: piId,
            stripe_charge_id: typeof d.charge === "string" ? d.charge : (d.charge as any)?.id ?? null,
            occurred_at: new Date().toISOString(),
          });
          // Funds are contested: unwind any ticket settlement funded by this payment.
          if (ph.vet_ticket_id) {
            await admin.rpc("reverse_ticket_settlement", {
              _ticket_id: ph.vet_ticket_id,
              _amount: amountUsd,
              _reason: "charge_dispute_opened",
              _external_ref: d.id,
            });
          }
        } else {
          await admin.from("payment_history").insert({
            user_id: ph.user_id,
            membership_id: ph.membership_id,
            vet_ticket_id: ph.vet_ticket_id,
            bnpl_obligation_id: ph.bnpl_obligation_id,
            kind: "dispute",
            status: d.status === "won" ? "dispute_won" : "dispute_lost",
            amount: amountUsd,
            currency: d.currency || "usd",
            description: `Dispute ${d.status}`,
            stripe_payment_intent_id: piId,
            stripe_charge_id: typeof d.charge === "string" ? d.charge : (d.charge as any)?.id ?? null,
            occurred_at: new Date().toISOString(),
          });
        }
        break;
      }


      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status === "active" || sub.status === "trialing" ? "active"
          : sub.status === "past_due" ? "past_due"
          : sub.status === "canceled" ? "cancelled"
          : "paused";
        const isLapse = status === "cancelled" || status === "past_due" || status === "paused";
        await admin.from("memberships").update({
          status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancelled_at: sub.cancel_at_period_end ? new Date().toISOString() : null,
          ...(isLapse ? { continuous_paid_months: 0, reserve_eligible_since: null } : {}),
        }).eq("stripe_subscription_id", sub.id);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await admin.from("memberships").update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          continuous_paid_months: 0,
          reserve_eligible_since: null,
        }).eq("stripe_subscription_id", sub.id);

        // Reverse referral bounties if cancellation occurred during the hold period
        try {
          const { data: m } = await admin.from("memberships")
            .select("id, user_id").eq("stripe_subscription_id", sub.id).maybeSingle();
          if (m) await reverseReferralIfWithinHold(admin, m.user_id);
        } catch (e) { console.error("referral reversal failed:", e); }
        break;
      }

      // ===== Stripe Issuing =====
      case "issuing_authorization.request": {
        const a = event.data.object as Stripe.Issuing.Authorization;
        const decision = await decideAuth(admin, a);
        await admin.from("issuing_authorizations").insert({
          ticket_id: decision.ticketId,
          stripe_authorization_id: a.id,
          stripe_card_id: a.card.id,
          amount: a.amount / 100,
          merchant_id: a.merchant_data?.network_id,
          merchant_category: a.merchant_data?.category,
          status: decision.approved ? "approved" : "declined",
          decline_reason: decision.reason,
          payload: a as any,
        });
        return new Response(JSON.stringify({
          approved: decision.approved,
          metadata: decision.ticketId ? { ticket_id: decision.ticketId } : undefined,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      case "issuing_authorization.created": {
        const a = event.data.object as Stripe.Issuing.Authorization;
        const ticketId = a.metadata?.ticket_id || a.card.metadata?.ticket_id;
        if (ticketId && a.merchant_data?.network_id) {
          await admin.from("vet_tickets").update({
            clinic_merchant_id: a.merchant_data.network_id,
            last_authorization_id: a.id,
          }).eq("id", ticketId).is("clinic_merchant_id", null);
        }
        break;
      }

      case "issuing_authorization.updated": {
        const a = event.data.object as Stripe.Issuing.Authorization;
        await admin.from("issuing_authorizations").insert({
          ticket_id: a.metadata?.ticket_id || a.card.metadata?.ticket_id || null,
          stripe_authorization_id: a.id,
          stripe_card_id: a.card.id,
          amount: a.amount / 100,
          status: a.status,
          payload: a as any,
        });
        break;
      }

      case "issuing_transaction.created": {
        const tx = event.data.object as Stripe.Issuing.Transaction;
        const ticketId = (tx.metadata?.ticket_id as string)
          || ((tx as any).card?.metadata?.ticket_id);
        if (ticketId) {
          const amountUsd = Math.abs(tx.amount) / 100;

          if (tx.type === "refund") {
            // Merchant refunded part or all of the captured amount — unwind the settlement.
            await admin.rpc("reverse_ticket_settlement", {
              _ticket_id: ticketId,
              _amount: amountUsd,
              _reason: "issuing_refund",
              _external_ref: tx.id,
            });
            await admin.from("vet_payouts")
              .update({ status: "reversed", notes: `Refunded ${amountUsd} (${tx.id})` })
              .eq("ticket_id", ticketId).eq("status", "settled");
            break;
          }

          // Capture
          await admin.rpc("mark_ticket_settled", {
            _ticket_id: ticketId,
            _settled_amount: amountUsd,
            _authorization_id: (tx.authorization as string) || tx.id,
          });
          // Freeze card so no further auths succeed on this ticket
          if (tx.card) {
            const cardId = typeof tx.card === "string" ? tx.card : tx.card.id;
            try {
              await stripe.issuing.cards.update(cardId, {
                spending_controls: {
                  spending_limits: [{ amount: 0, interval: "all_time" }],
                  allowed_categories: ["veterinary_services"],
                },
              });
            } catch (e) { console.error("freeze card failed:", e); }
          }
        }
        break;
      }

      // Disputes on issued-card spend: unwind the settlement while funds are contested,
      // and re-settle if the dispute is lost / funds are not reinstated.
      case "issuing_dispute.created":
      case "issuing_dispute.funds_reinstated":
      case "issuing_dispute.closed": {
        const d = event.data.object as Stripe.Issuing.Dispute;
        const txId = typeof d.transaction === "string" ? d.transaction : (d.transaction as any)?.id;
        let ticketId: string | null = (d.metadata?.ticket_id as string) || null;
        if (!ticketId && txId) {
          try {
            const tx = await stripe.issuing.transactions.retrieve(txId);
            ticketId = (tx.metadata?.ticket_id as string)
              || ((tx as any).card?.metadata?.ticket_id) || null;
          } catch (e) { console.error("dispute tx lookup failed:", e); }
        }
        if (!ticketId) break;
        const amountUsd = Math.abs(d.amount ?? 0) / 100;

        if (event.type === "issuing_dispute.created") {
          await admin.rpc("reverse_ticket_settlement", {
            _ticket_id: ticketId,
            _amount: amountUsd,
            _reason: "issuing_dispute_opened",
            _external_ref: d.id,
          });
          await admin.from("vet_payouts")
            .update({ status: "reversed", notes: `Dispute ${d.id} opened` })
            .eq("ticket_id", ticketId).eq("status", "settled");
        } else if (event.type === "issuing_dispute.funds_reinstated") {
          await admin.from("vet_payouts")
            .update({ status: "completed", notes: `Dispute ${d.id} funds reinstated` })
            .eq("ticket_id", ticketId).eq("status", "reversed");
        } else if (d.status === "lost") {
          // Dispute lost: the charge stands, so re-apply the settlement.
          await admin.rpc("mark_ticket_settled", {
            _ticket_id: ticketId,
            _settled_amount: amountUsd,
            _authorization_id: d.id,
          });
        }
        break;
      }


      case "issuing_card.updated": {
        const c = event.data.object as Stripe.Issuing.Card;
        await admin.from("issued_cards").update({
          status: c.status === "active" ? "active" : c.status === "canceled" ? "canceled" : "inactive",
          shipping_status: c.shipping?.status ?? null,
        }).eq("stripe_card_id", c.id);
        break;
      }

      case "account.updated": {
        const acct = event.data.object as Stripe.Account;
        const status = (acct.charges_enabled && acct.payouts_enabled) ? "active"
          : (acct.requirements?.disabled_reason ? "restricted" : "pending");
        await admin.from("referrers")
          .update({ stripe_connect_status: status })
          .eq("stripe_connect_account_id", acct.id);
        break;
      }

      case "transfer.paid":
      case "transfer.failed": {
        const t = event.data.object as Stripe.Transfer;
        const status = event.type === "transfer.paid" ? "paid" : "failed";
        await admin.from("referrer_payouts")
          .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
          .eq("stripe_transfer_id", t.id);
        break;
      }
    }

    await admin.from("webhook_events")
      .update({ status: "processed" })
      .eq("provider", "stripe").eq("event_id", event.id);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stripe-webhook handler error:", e);
    await admin.from("webhook_events")
      .update({ status: "failed", error: (e as Error).message })
      .eq("provider", "stripe").eq("event_id", event.id);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});

// ===== Helpers =====

/** Post an append-only ledger entry. Never throws — ledger failures are logged, not fatal. */
async function postLedger(admin: any, args: {
  user_id: string;
  bucket: "direct_pay" | "member_reserve" | "community_reserve" | "bnpl";
  entry_type: string;
  amount: number;
  idempotency_key: string;
  pet_id?: string | null;
  membership_id?: string | null;
  ticket_id?: string | null;
  obligation_id?: string | null;
  accrual_id?: string | null;
  external_ref?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { error } = await admin.rpc("post_ledger_entry", {
      _user_id: args.user_id,
      _bucket: args.bucket,
      _entry_type: args.entry_type,
      _amount: args.amount,
      _idempotency_key: args.idempotency_key,
      _pet_id: args.pet_id ?? null,
      _membership_id: args.membership_id ?? null,
      _ticket_id: args.ticket_id ?? null,
      _obligation_id: args.obligation_id ?? null,
      _accrual_id: args.accrual_id ?? null,
      _external_ref: args.external_ref ?? null,
      _description: args.description ?? null,
      _metadata: args.metadata ?? {},
    });
    if (error) console.error("post_ledger_entry failed:", args.idempotency_key, error);
  } catch (e) {
    console.error("post_ledger_entry threw:", args.idempotency_key, e);
  }
}



async function upsertPaymentByInvoice(admin: any, invoiceId: string, row: Record<string, unknown>) {
  const { data: existing } = await admin
    .from("payment_history")
    .select("id")
    .eq("stripe_invoice_id", invoiceId)
    .maybeSingle();
  if (existing) {
    const { error } = await admin.from("payment_history").update(row).eq("id", existing.id);
    if (error) console.error("update payment_history failed:", error);
  } else {
    const { error } = await admin.from("payment_history").insert(row);
    if (error) console.error("insert payment_history failed:", error);
  }
}

async function invokeIssueCard(ticketId: string) {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/issue-vet-card`;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        ticket_id: ticketId,
        internal_secret: Deno.env.get("INTERNAL_FUNCTION_SECRET"),
      }),
    });
  } catch (e) { console.error("invokeIssueCard failed:", e); }
}

async function decideAuth(admin: any, a: Stripe.Issuing.Authorization)
  : Promise<{ approved: boolean; reason?: string; ticketId?: string }> {
  const ticketId = (a.metadata?.ticket_id as string)
    || (a.card?.metadata?.ticket_id as string);
  if (!ticketId) return { approved: false, reason: "no_ticket_metadata" };

  const { data: t } = await admin.from("vet_tickets")
    .select("status, approved_amount, authorized_until, clinic_merchant_id, merchant_lock_type")
    .eq("id", ticketId).maybeSingle();
  if (!t) return { approved: false, reason: "ticket_not_found", ticketId };
  if (t.status !== "card_issued") return { approved: false, reason: `ticket_status_${t.status}`, ticketId };
  if (new Date(t.authorized_until) < new Date()) return { approved: false, reason: "auth_window_expired", ticketId };
  if (a.amount > Math.round(Number(t.approved_amount) * 100)) {
    return { approved: false, reason: "exceeds_approved_amount", ticketId };
  }
  if (t.merchant_lock_type === "merchant_id" && t.clinic_merchant_id
    && a.merchant_data?.network_id !== t.clinic_merchant_id) {
    return { approved: false, reason: "merchant_mismatch", ticketId };
  }
  return { approved: true, ticketId };
}

// ===== Referral bounty helpers =====

async function accrueReferralBounty(admin: any, args: {
  userId: string; membershipId: string; invoiceId: string; paidAmount: number;
}) {
  if (!args.paidAmount || args.paidAmount <= 0) return;

  const { data: ref } = await admin
    .from("referrals")
    .select("id, referrer_id, status, activated_at, membership_id")
    .eq("referred_user_id", args.userId)
    .maybeSingle();
  if (!ref || ref.status === "reversed" || ref.status === "inactive") return;

  const { data: referrer } = await admin
    .from("referrers")
    .select("id, type, is_active, fear_free_certified")
    .eq("id", ref.referrer_id)
    .maybeSingle();
  if (!referrer || !referrer.is_active) return;
  // Shelters earn through milestones, not subscription %
  if (referrer.type === "shelter") {
    if (ref.status === "pending_signup") {
      await admin.from("referrals").update({
        status: "active", activated_at: new Date().toISOString(), membership_id: args.membershipId,
      }).eq("id", ref.id);
    }
    return;
  }
  if (referrer.type === "vet" && !referrer.fear_free_certified) {
    // still mark activation but no bounty
    if (ref.status === "pending_signup") {
      await admin.from("referrals").update({
        status: "active", activated_at: new Date().toISOString(), membership_id: args.membershipId,
      }).eq("id", ref.id);
    }
    return;
  }

  // Activate referral on first paid invoice
  let activatedAt = ref.activated_at;
  if (ref.status === "pending_signup" || !activatedAt) {
    activatedAt = new Date().toISOString();
    await admin.from("referrals").update({
      status: "active", activated_at: activatedAt, membership_id: args.membershipId,
    }).eq("id", ref.id);
  }

  // Find payment_history row for this invoice
  const { data: ph } = await admin.from("payment_history")
    .select("id").eq("stripe_invoice_id", args.invoiceId).maybeSingle();

  // Idempotency: skip if a bounty already exists for this payment
  if (ph?.id) {
    const { data: existing } = await admin.from("referral_bounties")
      .select("id").eq("payment_history_id", ph.id).maybeSingle();
    if (existing) return;
  }

  // Settings
  const { data: settings } = await admin.from("referral_program_settings")
    .select("intro_rate, intro_months, ongoing_rate, hold_days").limit(1).maybeSingle();
  const introRate = Number(settings?.intro_rate ?? 0.05);
  const introMonths = Number(settings?.intro_months ?? 6);
  const ongoingRate = Number(settings?.ongoing_rate ?? 0.02);
  const holdDays = Number(settings?.hold_days ?? 30);

  const monthsElapsed = Math.floor(
    (Date.now() - new Date(activatedAt).getTime()) / (1000 * 60 * 60 * 24 * 30.4375)
  );
  const inIntro = monthsElapsed < introMonths;
  const rate = inIntro ? introRate : ongoingRate;
  const bounty = Math.round(args.paidAmount * rate * 100) / 100;
  if (bounty <= 0) return;

  const holdUntil = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000).toISOString();

  await admin.from("referral_bounties").insert({
    referral_id: ref.id,
    referrer_id: referrer.id,
    payment_history_id: ph?.id ?? null,
    membership_id: args.membershipId,
    period: inIntro ? "intro" : "ongoing",
    rate,
    gross_membership_amount: args.paidAmount,
    bounty_amount: bounty,
    hold_until: holdUntil,
    status: "pending",
  });
}

async function reverseReferralIfWithinHold(admin: any, userId: string) {
  const { data: ref } = await admin
    .from("referrals")
    .select("id, activated_at, status")
    .eq("referred_user_id", userId)
    .maybeSingle();
  if (!ref || !ref.activated_at) return;

  const cutoff = new Date(new Date(ref.activated_at).getTime() + 30 * 24 * 60 * 60 * 1000);
  if (new Date() > cutoff) return; // outside 30-day reversal window

  await admin.from("referral_bounties")
    .update({ status: "reversed" })
    .eq("referral_id", ref.id)
    .in("status", ["pending", "available"]);
  await admin.from("referrals").update({ status: "reversed" }).eq("id", ref.id);
}
