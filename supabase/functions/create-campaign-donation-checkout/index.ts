import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";
import { remainingEligibleAmount } from "../_shared/help-now-cap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Donation checkout for a Help a Pet Now campaign. The campaign's raised amount
 * is only moved by the Stripe webhook once the charge actually completes, and a
 * per-donation record is written so the money stays auditable — including if it
 * is later redirected under Requirement 13.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const campaignId = typeof body?.campaign_id === "string" ? body.campaign_id : "";
    const amount = Number(body?.amount);
    const donorName = typeof body?.donor_name === "string" ? body.donor_name.slice(0, 100) : "";
    const donorEmail = typeof body?.donor_email === "string" ? body.donor_email.slice(0, 120) : "";
    const message = typeof body?.message === "string" ? body.message.slice(0, 250) : "";

    if (!campaignId) return json({ error: "campaign_id is required" }, 400);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "A positive amount is required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: campaign } = await admin
      .from("help_now_campaigns")
      .select("id, pet_id, title, status, goal_amount, raised_amount, document_basis, expires_at, clock_paused_at")
      .eq("id", campaignId)
      .maybeSingle();
    if (!campaign) return json({ error: "Campaign not found" }, 404);

    const remaining = remainingEligibleAmount(campaign as any);
    if (remaining <= 0) {
      return json({ error: "This campaign is no longer accepting donations" }, 400);
    }
    if (amount > remaining) {
      return json({ error: `This campaign can only accept up to $${remaining.toFixed(2)} more` }, 400);
    }

    // Optional auth — signed-in donors get their donation linked to their account.
    let userId: string | null = null;
    let customerEmail: string | undefined = donorEmail || undefined;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: u } = await userClient.auth.getUser();
      if (u?.user) {
        userId = u.user.id;
        customerEmail = customerEmail || u.user.email || undefined;
      }
    }

    const { data: pet } = await admin.from("pets").select("name").eq("id", campaign.pet_id).maybeSingle();
    const petName = pet?.name ?? "this pet";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const origin = req.headers.get("origin")
      || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
      || "";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customerEmail,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `Help a Pet Now — ${campaign.title ?? `Help ${petName}`}`,
            description:
              "Funds a verified veterinary expense. If this case is not verified in time, "
              + "your donation is redirected to another verified case rather than paid out as cash.",
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      metadata: {
        kind: "help_now_donation",
        campaign_id: campaignId,
        donor_user_id: userId ?? "",
        donor_name: donorName,
        donor_email: donorEmail || customerEmail || "",
        message,
      },
      success_url: `${origin}/?donation=success`,
      cancel_url: `${origin}/?donation=cancelled`,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error("create-campaign-donation-checkout error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
