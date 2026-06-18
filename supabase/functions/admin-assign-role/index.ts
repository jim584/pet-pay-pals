import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ROLES = new Set(["pet_owner", "vet", "admin"]);

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
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const callerId = userData.user.id;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    const isAdmin = (roleRow ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: corsHeaders });
    }

    const { user_id, role, action } = await req.json();
    if (!user_id || !role || !VALID_ROLES.has(role) || !["assign", "remove"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: corsHeaders });
    }

    // Prevent admin from removing their own admin role (avoid lockout)
    if (action === "remove" && user_id === callerId && role === "admin") {
      return new Response(JSON.stringify({ error: "Cannot remove your own admin role" }), { status: 400, headers: corsHeaders });
    }

    if (action === "assign") {
      const { error } = await admin
        .from("user_roles")
        .upsert({ user_id, role }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (error) throw error;
    } else {
      const { error } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", user_id)
        .eq("role", role);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-assign-role error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
