import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

    const { data: referrer, error } = await admin.from("referrers")
      .select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!referrer) return json({ error: "no referrer profile" }, 404);

    const { return_url } = await req.json().catch(() => ({}));
    const baseUrl = return_url || `${req.headers.get("origin") ?? ""}/referrer?onboarded=1`;

    let accountId = referrer.stripe_connect_account_id;
    if (!accountId) {
      const acct = await stripe.accounts.create({
        type: "express",
        email: referrer.payout_email || user.email || undefined,
        capabilities: { transfers: { requested: true } },
        metadata: { referrer_id: referrer.id, user_id: user.id },
      });
      accountId = acct.id;
      await admin.from("referrers").update({
        stripe_connect_account_id: accountId,
        stripe_connect_status: "pending",
        payout_method: "stripe_connect",
      }).eq("id", referrer.id);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: baseUrl,
      return_url: baseUrl,
      type: "account_onboarding",
    });
    return json({ url: link.url });
  } catch (e) {
    console.error("onboard error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
