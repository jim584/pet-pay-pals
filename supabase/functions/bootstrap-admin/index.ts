import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMAIL = "admin@helpapet.com";
const PASSWORD = "Emirates@1234";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Try to find an existing user with this email
    let userId: string | null = null;
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw listErr;
    const existing = list.users.find(
      (u) => u.email?.toLowerCase() === EMAIL.toLowerCase(),
    );

    if (existing) {
      userId = existing.id;
      // Make sure password & confirmed status are set as requested
      const { error: updErr } = await supabase.auth.admin.updateUserById(
        existing.id,
        { password: PASSWORD, email_confirm: true },
      );
      if (updErr) throw updErr;
    } else {
      const { data: created, error: createErr } =
        await supabase.auth.admin.createUser({
          email: EMAIL,
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: "Admin" },
        });
      if (createErr) throw createErr;
      userId = created.user!.id;
    }

    // Ensure profile row exists (handle_new_user trigger should create it,
    // but be defensive in case the user pre-existed without one).
    await supabase
      .from("profiles")
      .upsert({ user_id: userId, full_name: "Admin" }, { onConflict: "user_id" });

    // Grant admin role (idempotent)
    const { error: roleErr } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleErr) throw roleErr;

    return new Response(
      JSON.stringify({ success: true, user_id: userId, email: EMAIL }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (e) {
    console.error("bootstrap-admin error", e);
    return new Response(
      JSON.stringify({ success: false, error: String(e?.message ?? e) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
