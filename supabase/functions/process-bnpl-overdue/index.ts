import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRACE_DAYS = 7;
const DEFAULT_AFTER_DAYS = 30;
const MISSED_DEFAULT_THRESHOLD = 2;

async function sendReminder(installmentId: string, stage: string) {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-bnpl-reminder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ installment_id: installmentId, stage }),
    });
  } catch (e) {
    console.error("reminder dispatch failed", installmentId, stage, e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const upcomingISO = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10);
    const grace = new Date(today.getTime() - GRACE_DAYS * 86400000).toISOString().slice(0, 10);

    // 1. scheduled past due → due
    await admin.from("bnpl_installments")
      .update({ status: "due" })
      .eq("status", "scheduled")
      .lte("due_date", todayISO);

    // 2. due past grace → missed
    await admin.from("bnpl_installments")
      .update({ status: "missed" })
      .eq("status", "due")
      .lt("due_date", grace);

    // 3. Mark obligations defaulted (>=2 missed OR oldest missed > DEFAULT_AFTER_DAYS old)
    const { data: missedRows } = await admin.from("bnpl_installments")
      .select("obligation_id, due_date")
      .eq("status", "missed");
    const byOb = new Map<string, { count: number; oldest: string }>();
    for (const r of missedRows ?? []) {
      const e = byOb.get(r.obligation_id);
      if (!e) byOb.set(r.obligation_id, { count: 1, oldest: r.due_date });
      else { e.count++; if (r.due_date < e.oldest) e.oldest = r.due_date; }
    }
    const oldestCutoff = new Date(today.getTime() - DEFAULT_AFTER_DAYS * 86400000).toISOString().slice(0, 10);
    for (const [obId, info] of byOb) {
      if (info.count >= MISSED_DEFAULT_THRESHOLD || info.oldest < oldestCutoff) {
        const { data: ob } = await admin.from("bnpl_obligations")
          .select("status, default_at").eq("id", obId).maybeSingle();
        if (ob && ["pending", "active"].includes(ob.status)) {
          await admin.rpc("mark_obligation_default", { _obligation_id: obId });
          // notify
          const { data: latest } = await admin.from("bnpl_installments")
            .select("id").eq("obligation_id", obId).eq("status", "missed")
            .order("due_date", { ascending: true }).limit(1).maybeSingle();
          if (latest) await sendReminder(latest.id, "default");
        }
      }
    }

    // 4. Reminders — upcoming (3 days out), due today, missed (first time)
    const fetchToRemind = async (filter: (q: any) => any, stage: string) => {
      const { data } = await filter(admin.from("bnpl_installments").select("id, last_reminded_at, reminder_stage"));
      return (data ?? []).filter((r: any) => r.reminder_stage !== stage);
    };

    const upcoming = await fetchToRemind(
      (q) => q.eq("status", "scheduled").eq("due_date", upcomingISO),
      "upcoming",
    );
    const dueToday = await fetchToRemind(
      (q) => q.eq("status", "due").eq("due_date", todayISO),
      "due",
    );
    const missed = await fetchToRemind(
      (q) => q.eq("status", "missed"),
      "missed",
    );

    let sent = 0;
    for (const r of upcoming) { await sendReminder(r.id, "upcoming"); sent++; }
    for (const r of dueToday) { await sendReminder(r.id, "due"); sent++; }
    for (const r of missed) { await sendReminder(r.id, "missed"); sent++; }

    return new Response(JSON.stringify({
      ok: true,
      transitioned_due: undefined,
      defaults_processed: byOb.size,
      reminders_sent: sent,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("process-bnpl-overdue error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
