import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "approve" | "decline" | "pause" | "cancel" | "reactivate" | "mark_active" | "extend";

const VALID_ACTIONS: Action[] = ["approve", "decline", "pause", "cancel", "reactivate", "mark_active", "extend"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const callerId = claims.claims.sub as string;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    const isAdmin = (roleRow ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: corsHeaders });
    }

    const { membership_id, action, reason, admin_notes, new_period_end } = await req.json();
    if (!membership_id || !VALID_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: corsHeaders });
    }

    const { data: m, error: mErr } = await admin.from("memberships").select("*").eq("id", membership_id).maybeSingle();
    if (mErr || !m) {
      return new Response(JSON.stringify({ error: "Membership not found" }), { status: 404, headers: corsHeaders });
    }

    await admin.rpc("set_config" as any, { setting_name: "app.status_source", new_value: "admin", is_local: false } as any).catch(() => {});
    await ensureStatusContextRpc(admin);
    await admin.rpc("set_status_context", { _source: "admin", _changer: callerId });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const subId: string | null = m.stripe_subscription_id;

    let updates: Record<string, any> = { admin_notes: admin_notes ?? m.admin_notes };

    switch (action as Action) {
      case "approve": {
        if (m.status !== "pending") {
          return errResp(`Cannot approve membership in status ${m.status}`);
        }
        if (m.requires_admin_approval && !subId) {
          updates.requires_admin_approval = false;
          updates.rejection_reason = null;
        } else {
          updates.status = "active";
          updates.started_at = m.started_at ?? new Date().toISOString();
          updates.rejection_reason = null;
        }
        break;
      }
      case "decline": {
        if (!["pending", "past_due"].includes(m.status)) {
          return errResp(`Cannot decline membership in status ${m.status}`);
        }
        updates.status = "cancelled";
        updates.rejection_reason = reason ?? "Declined by admin";
        updates.cancelled_at = new Date().toISOString();
        break;
      }
      case "pause": {
        if (m.status !== "active") return errResp("Only active memberships can be paused");
        updates.status = "paused";
        if (subId) {
          try {
            await stripe.subscriptions.update(subId, { pause_collection: { behavior: "mark_uncollectible" } });
          } catch (e) { console.error("stripe pause failed:", e); }
        }
        break;
      }
      case "cancel": {
        if (["cancelled"].includes(m.status)) return errResp("Already cancelled");
        updates.status = "cancelled";
        updates.cancelled_at = new Date().toISOString();
        if (reason) updates.rejection_reason = reason;
        if (subId) {
          try { await stripe.subscriptions.cancel(subId); }
          catch (e) { console.error("stripe cancel failed:", e); }
        }
        break;
      }
      case "reactivate": {
        if (!["paused", "cancelled"].includes(m.status)) {
          return errResp(`Cannot reactivate from ${m.status}`);
        }
        if (m.status === "paused" && subId) {
          try {
            await stripe.subscriptions.update(subId, { pause_collection: "" as any });
          } catch (e) { console.error("stripe unpause failed:", e); }
          updates.status = "active";
          updates.cancelled_at = null;
        } else {
          updates.status = "pending";
          updates.requires_admin_approval = false;
          updates.cancelled_at = null;
        }
        break;
      }
      case "mark_active": {
        updates.status = "active";
        updates.cancelled_at = null;
        break;
      }
      case "extend": {
        if (!new_period_end) return errResp("new_period_end required");
        updates.current_period_end = new Date(new_period_end).toISOString();
        break;
      }
    }

    const { error: updErr } = await admin.from("memberships").update(updates).eq("id", membership_id);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ ok: true, updates }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-update-membership error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});

function errResp(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function ensureStatusContextRpc(_admin: any) {
  return;
}
