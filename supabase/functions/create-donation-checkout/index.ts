import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const {
      kind = "sponsorship_donation",
      pet_id, amount, message, donor_name, donor_email,
      to_user_id, story_id,
    } = body || {};

    const amt = Number(amount);
    if (!amt || amt <= 0) return json({ error: "A positive amount is required" }, 400);
    if (!["sponsorship_donation", "wallet_donation"].includes(kind)) {
      return json({ error: "Unsupported donation kind" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Resolve auth (required for wallet donations, optional for sponsorships)
    let userId: string | null = null;
    let customerEmail: string | undefined = donor_email || undefined;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: u } = await userClient.auth.getUser();
      if (u?.user) {
        userId = u.user.id;
        customerEmail = customerEmail || u.user.email || undefined;
      }
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/") || "";

    let productName: string;
    let metadata: Record<string, string>;
    let successUrl: string;
    let cancelUrl: string;

    if (kind === "wallet_donation") {
      // Community story donation. Previously this credited the recipient's
      // wallet directly via an RPC with no proof of payment; it now requires
      // a completed Stripe charge before any balance moves.
      if (!userId) return json({ error: "Sign in to donate" }, 401);
      if (!to_user_id) return json({ error: "to_user_id required" }, 400);
      if (to_user_id === userId) return json({ error: "You cannot donate to yourself" }, 400);

      const { data: recipient } = await admin.from("profiles")
        .select("user_id, full_name").eq("user_id", to_user_id).maybeSingle();
      if (!recipient) return json({ error: "Recipient not found" }, 404);

      if (story_id) {
        const { data: story } = await admin.from("pet_stories")
          .select("id, author_id").eq("id", story_id).maybeSingle();
        if (!story || story.author_id !== to_user_id) {
          return json({ error: "Story does not belong to the recipient" }, 400);
        }
      }

      productName = `Donation to ${recipient.full_name}`;
      metadata = {
        kind: "wallet_donation",
        from_user_id: userId,
        to_user_id,
        story_id: story_id ?? "",
      };
      successUrl = `${origin}/community?donation=success`;
      cancelUrl = `${origin}/community?donation=cancelled`;
    } else {
      if (!pet_id) return json({ error: "pet_id required" }, 400);
      const { data: pet } = await admin.from("sponsorship_pets")
        .select("id, name, is_active").eq("id", pet_id).maybeSingle();
      if (!pet || !pet.is_active) return json({ error: "Pet not found" }, 404);

      productName = `Sponsor ${pet.name}`;
      metadata = {
        kind: "sponsorship_donation",
        pet_id,
        user_id: userId ?? "",
        message: (message ?? "").slice(0, 250),
        donor_name: (donor_name ?? "").slice(0, 100),
        donor_email: (donor_email ?? customerEmail ?? "").slice(0, 100),
      };
      successUrl = `${origin}/help-overcome?donation=success`;
      cancelUrl = `${origin}/help-overcome?donation=cancelled`;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customerEmail,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: productName,
            description: message ? `Message: ${message}`.slice(0, 250) : undefined,
          },
          unit_amount: Math.round(amt * 100),
        },
        quantity: 1,
      }],
      metadata,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error("create-donation-checkout error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
