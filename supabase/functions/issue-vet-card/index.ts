import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ISSUING_ENABLED = (Deno.env.get("ISSUING_ENABLED") ?? "false").toLowerCase() === "true";
const AUTH_HOURS = Number(Deno.env.get("ISSUING_DEFAULT_AUTH_HOURS") ?? "6");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { ticket_id, internal_secret } = await req.json();
    if (!ticket_id) {
      return json({ error: "ticket_id required" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // AuthZ: either internal call (service-role secret) or admin/owner JWT
    const authHeader = req.headers.get("Authorization");
    const internalOk = internal_secret && internal_secret === Deno.env.get("INTERNAL_FUNCTION_SECRET");
    let callerId: string | null = null;
    if (!internalOk) {
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } });
      const { data: userData, error: userErr } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
      if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
      callerId = userData.user.id;
    }

    const { data: ticket } = await admin.from("vet_tickets").select("*").eq("id", ticket_id).maybeSingle();
    if (!ticket) return json({ error: "Ticket not found" }, 404);

    if (!internalOk && callerId) {
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", callerId);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      if (!isAdmin && ticket.owner_id !== callerId) return json({ error: "Forbidden" }, 403);
    }

    if (ticket.card_id) {
      return json({ ok: true, idempotent: true, card_id: ticket.card_id, authorized_until: ticket.authorized_until });
    }
    if (ticket.status !== "funded") {
      return json({ error: `Ticket not funded (status=${ticket.status})` }, 400);
    }
    const approvedCents = Math.round(Number(ticket.approved_amount ?? 0) * 100);
    if (approvedCents <= 0) return json({ error: "No approved amount" }, 400);

    const authorizedUntil = new Date(Date.now() + AUTH_HOURS * 3600 * 1000);

    if (!ISSUING_ENABLED) {
      // Stub mode: mark card_issued without calling Stripe
      await admin.from("vet_tickets").update({
        status: "card_issued",
        card_id: `stub_${ticket.id.slice(0, 8)}`,
        merchant_lock_type: ticket.clinic_merchant_id ? "merchant_id" : "mcc_only",
        authorized_until: authorizedUntil.toISOString(),
      }).eq("id", ticket_id);
      return json({ ok: true, stubbed: true, authorized_until: authorizedUntil.toISOString() });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

    // 1. Cardholder
    const { data: profile } = await admin.from("profiles")
      .select("id, full_name, phone, address, stripe_issuing_cardholder_id")
      .eq("user_id", ticket.owner_id).maybeSingle();
    if (!profile) return json({ error: "Owner profile not found" }, 400);

    let cardholderId = profile.stripe_issuing_cardholder_id;
    if (!cardholderId) {
      const ch = await stripe.issuing.cardholders.create({
        type: "individual",
        name: profile.full_name || "Pet Owner",
        phone_number: profile.phone || undefined,
        billing: {
          address: {
            line1: Deno.env.get("ISSUING_BUSINESS_ADDRESS_LINE1") || profile.address || "1 Main St",
            city: Deno.env.get("ISSUING_BUSINESS_ADDRESS_CITY") || "San Francisco",
            state: Deno.env.get("ISSUING_BUSINESS_ADDRESS_STATE") || "CA",
            postal_code: Deno.env.get("ISSUING_BUSINESS_ADDRESS_POSTAL") || "94103",
            country: Deno.env.get("ISSUING_BUSINESS_ADDRESS_COUNTRY") || "US",
          },
        },
      });
      cardholderId = ch.id;
      await admin.from("profiles").update({ stripe_issuing_cardholder_id: cardholderId })
        .eq("user_id", ticket.owner_id);
    }

    // 2. Reuse active virtual card if exists
    const { data: existing } = await admin.from("issued_cards")
      .select("*").eq("owner_id", ticket.owner_id)
      .eq("type", "virtual").eq("status", "active").maybeSingle();

    let stripeCard: Stripe.Issuing.Card;
    let issuedCardRowId: string;

    const merchantLockType = ticket.clinic_merchant_id ? "merchant_id" : "mcc_only";
    const spendingControls: Stripe.Issuing.CardCreateParams.SpendingControls = {
      spending_limits: [{ amount: approvedCents, interval: "all_time" }],
      ...(ticket.clinic_merchant_id
        ? { allowed_merchants: [ticket.clinic_merchant_id] }
        : { allowed_categories: ["veterinary_services"] }),
    };

    const metadata = {
      ticket_id: ticket.id,
      pet_id: ticket.pet_id,
      owner_id: ticket.owner_id,
      authorized_until: authorizedUntil.toISOString(),
    };

    if (existing) {
      stripeCard = await stripe.issuing.cards.update(existing.stripe_card_id, {
        spending_controls: spendingControls,
        metadata,
        status: "active",
      });
      issuedCardRowId = existing.id;
    } else {
      stripeCard = await stripe.issuing.cards.create({
        type: "virtual",
        cardholder: cardholderId!,
        currency: "usd",
        status: "active",
        spending_controls: spendingControls,
        metadata,
      });
      const { data: ins } = await admin.from("issued_cards").insert({
        owner_id: ticket.owner_id,
        stripe_card_id: stripeCard.id,
        type: "virtual",
        last4: stripeCard.last4,
        exp_month: stripeCard.exp_month,
        exp_year: stripeCard.exp_year,
        status: "active",
      }).select("id").single();
      issuedCardRowId = ins!.id;
    }

    await admin.from("vet_tickets").update({
      status: "card_issued",
      card_id: stripeCard.id,
      issued_card_id: issuedCardRowId,
      merchant_lock_type: merchantLockType,
      authorized_until: authorizedUntil.toISOString(),
    }).eq("id", ticket_id);

    return json({
      ok: true,
      card_id: stripeCard.id,
      last4: stripeCard.last4,
      authorized_until: authorizedUntil.toISOString(),
      merchant_lock_type: merchantLockType,
    });
  } catch (e) {
    console.error("issue-vet-card error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
