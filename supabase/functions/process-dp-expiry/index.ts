import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Daily job: expire DP accrual rows past their expires_at and redistribute 50/30/20.
Deno.serve(async (_req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const nowIso = new Date().toISOString();

  const { data: rows, error } = await admin
    .from("direct_pay_accruals")
    .select("id, remaining_amount, expires_at")
    .eq("expired", false)
    .not("expires_at", "is", null)
    .lte("expires_at", nowIso)
    .limit(500);

  if (error) {
    console.error("query expired DP error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let processed = 0;
  let totalReserve = 0;
  for (const r of rows ?? []) {
    const remaining = Number(r.remaining_amount);
    if (remaining <= 0) {
      await admin.from("direct_pay_accruals").update({ expired: true, expired_at: nowIso }).eq("id", r.id);
      continue;
    }
    const reserve = +(remaining * 0.5).toFixed(2);
    const helpNow = +(remaining * 0.3).toFixed(2);
    const adminCut = +(remaining - reserve - helpNow).toFixed(2);

    await admin.from("dp_expiry_ledger").insert({
      accrual_id: r.id,
      expired_amount: remaining,
      community_reserve_portion: reserve,
      help_now_portion: helpNow,
      admin_portion: adminCut,
      reason: "window_expired",
    });
    await admin.from("direct_pay_accruals").update({
      expired: true, expired_at: nowIso, remaining_amount: 0,
    }).eq("id", r.id);

    totalReserve += reserve;
    processed += 1;
  }

  if (totalReserve > 0) {
    const { data: cr } = await admin.from("community_reserve").select("id, balance").limit(1).single();
    if (cr) {
      await admin.from("community_reserve")
        .update({ balance: Number(cr.balance) + totalReserve, updated_at: nowIso })
        .eq("id", cr.id);
    }
  }

  return new Response(JSON.stringify({ processed, totalReserve }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
