import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendLovableEmail } from "npm:@lovable.dev/email-js";
import {
  listEligibleReceivingCases, proposeAllocations, heldDonationTotal,
  type ProposedAllocation,
} from "../_shared/redirection.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENDER_DOMAIN = "notify.plexaihub.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => `$${Number(n ?? 0).toFixed(2)}`;

/**
 * Admin action for Requirement 13.
 *  - action "propose": recompute the allocation preview against current cases.
 *  - action "release": move the held donations to the chosen verified cases,
 *    write the audit trail, and email each donor where their money went.
 *  - action "cancel": close the redirection without moving money.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    const adminUser = userData?.user;
    if (!adminUser) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: adminUser.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    const body = await req.json().catch(() => ({}));
    const redirectionId = typeof body?.redirection_id === "string" ? body.redirection_id : "";
    const action = typeof body?.action === "string" ? body.action : "propose";
    if (!redirectionId) return json({ error: "redirection_id is required" }, 400);

    const { data: redirection } = await admin
      .from("campaign_redirections")
      .select("*")
      .eq("id", redirectionId)
      .maybeSingle();
    if (!redirection) return json({ error: "Redirection not found" }, 404);
    if (redirection.status !== "pending") {
      return json({ error: `This redirection is already ${redirection.status}` }, 400);
    }

    const held = await heldDonationTotal(admin, redirection.source_campaign_id);
    const cases = await listEligibleReceivingCases(admin, redirection.source_campaign_id);

    if (action === "cancel") {
      await admin.from("campaign_redirections")
        .update({ status: "cancelled", released_by: adminUser.id, released_at: new Date().toISOString() })
        .eq("id", redirectionId);
      return json({ ok: true, status: "cancelled" });
    }

    if (action === "propose") {
      const proposal = proposeAllocations(held, cases);
      await admin.from("campaign_redirections")
        .update({ total_amount: held, unallocated_amount: proposal.unallocated })
        .eq("id", redirectionId);
      return json({ ok: true, total: held, cases, ...proposal });
    }

    if (action !== "release") return json({ error: "Unsupported action" }, 400);

    // An admin may override the proposal; otherwise use the priority-ordered one.
    let allocations: ProposedAllocation[] = Array.isArray(body?.allocations)
      ? body.allocations
        .map((a: any) => ({
          receiving_campaign_id: String(a?.receiving_campaign_id ?? ""),
          amount: round2(Number(a?.amount ?? 0)),
        }))
        .filter((a: ProposedAllocation) => a.receiving_campaign_id && a.amount > 0)
      : proposeAllocations(held, cases).allocations;

    if (allocations.length === 0) {
      return json({ error: "No verified case is currently able to receive these funds" }, 400);
    }

    // Never exceed the held amount, and never push a receiving case past its cap.
    const byId = new Map(cases.map((c) => [c.id, c]));
    let budget = held;
    const applied: ProposedAllocation[] = [];
    for (const a of allocations) {
      const target = byId.get(a.receiving_campaign_id);
      if (!target) {
        return json({ error: "A chosen case is no longer eligible to receive funds" }, 400);
      }
      const amount = round2(Math.min(a.amount, target.remaining, budget));
      if (amount <= 0) continue;
      applied.push({ receiving_campaign_id: a.receiving_campaign_id, amount });
      budget = round2(budget - amount);
    }
    if (applied.length === 0) return json({ error: "Nothing could be allocated" }, 400);

    const nowIso = new Date().toISOString();

    // Apply to each receiving campaign. The funding-cap trigger is the backstop.
    for (const a of applied) {
      const target = byId.get(a.receiving_campaign_id)!;
      const { error: updErr } = await admin.from("help_now_campaigns")
        .update({ raised_amount: round2(target.raised_amount + a.amount) })
        .eq("id", a.receiving_campaign_id);
      if (updErr) throw updErr;

      const { error: allocErr } = await admin.from("campaign_redirection_allocations").insert({
        redirection_id: redirectionId,
        receiving_campaign_id: a.receiving_campaign_id,
        amount: a.amount,
        applied_at: nowIso,
      });
      if (allocErr) throw allocErr;
    }

    const allocatedTotal = round2(applied.reduce((s, a) => s + a.amount, 0));

    await admin.from("campaign_redirections").update({
      status: "released",
      allocated_amount: allocatedTotal,
      unallocated_amount: round2(held - allocatedTotal),
      released_at: nowIso,
      released_by: adminUser.id,
    }).eq("id", redirectionId);

    // Stamp the source donations pro-rata so each gift shows where it went.
    const { data: donations } = await admin
      .from("campaign_donations")
      .select("id, amount, redirected_amount, donor_email, donor_name, donor_user_id")
      .eq("campaign_id", redirection.source_campaign_id)
      .eq("status", "paid");

    let left = allocatedTotal;
    const notify: any[] = [];
    for (const d of donations ?? []) {
      if (left <= 0) break;
      const outstanding = round2(Number(d.amount) - Number(d.redirected_amount ?? 0));
      if (outstanding <= 0) continue;
      const take = round2(Math.min(outstanding, left));
      await admin.from("campaign_donations").update({
        redirection_id: redirectionId,
        redirected_amount: round2(Number(d.redirected_amount ?? 0) + take),
        redirected_at: nowIso,
      }).eq("id", d.id);
      left = round2(left - take);
      notify.push({ ...d, redirected: take });
    }

    // Tell each donor where their contribution went.
    const receivingNames: string[] = [];
    const origin = req.headers.get("origin") || "https://pet-pay-pals.lovable.app";
    for (const a of applied) {
      const { data: c } = await admin.from("help_now_campaigns")
        .select("title, pet_id").eq("id", a.receiving_campaign_id).maybeSingle();
      const { data: p } = c?.pet_id
        ? await admin.from("pets").select("name").eq("id", c.pet_id).maybeSingle()
        : { data: null };
      receivingNames.push(
        `<li><a href="${origin}/campaign/${a.receiving_campaign_id}">${c?.title ?? p?.name ?? "A verified case"}</a> — ${money(a.amount)}</li>`,
      );
    }

    const emailsOn = Deno.env.get("EMAILS_ENABLED") === "true";
    for (const d of notify) {
      let email = d.donor_email as string | null;
      if (!email && d.donor_user_id) {
        const { data: u } = await admin.auth.admin.getUserById(d.donor_user_id);
        email = u?.user?.email ?? null;
      }
      if (!email || !emailsOn) {
        await admin.from("campaign_donations")
          .update({ donor_notification_status: email ? "skipped" : "no_address" })
          .eq("id", d.id);
        continue;
      }
      try {
        await sendLovableEmail({
          from: `Help A Pet <donations@${SENDER_DOMAIN}>`,
          to: [email],
          subject: "Your Help a Pet Now donation was redirected to a verified case",
          html: `
            <div style="font-family:Arial,Helvetica,sans-serif;color:#1B2A4A;line-height:1.6">
              <h2 style="color:#1B2A4A">Your donation went to a verified veterinary need</h2>
              <p>Thank you again for your ${money(d.redirected)} gift. The campaign you supported did not
              provide the required veterinary invoice and proof of payment within its verification period,
              so the funds were not released to that member.</p>
              <p>As disclosed when you donated, your contribution has instead been applied to a
              high-priority Help a Pet Now case that already has verified documentation:</p>
              <ul>${receivingNames.join("")}</ul>
              <p>You can follow that case and its updates using the link above.</p>
              <p style="font-size:12px;color:#555">This is a redirection, not a refund — every dollar
              still funds a verified veterinary expense.</p>
            </div>`,
        });
        await admin.from("campaign_donations")
          .update({ donor_notification_status: "sent", donor_notified_at: new Date().toISOString() })
          .eq("id", d.id);
      } catch (e) {
        console.error("donor notification failed", d.id, e);
        await admin.from("campaign_donations")
          .update({ donor_notification_status: "failed" }).eq("id", d.id);
      }
    }

    return json({
      ok: true,
      status: "released",
      allocated: allocatedTotal,
      unallocated: round2(held - allocatedTotal),
      notified: notify.length,
    });
  } catch (e) {
    console.error("release-campaign-redirection error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
