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

async function attemptAutoCharge(installmentId: string): Promise<{ ok: boolean; skipped?: string }> {
  try {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/charge-bnpl-installment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ installment_id: installmentId }),
    });
    const json = await res.json().catch(() => ({}));
    if (json?.skipped) return { ok: false, skipped: json.skipped };
    return { ok: !!json?.ok };
  } catch (e) {
    console.error("auto-charge dispatch failed", installmentId, e);
    return { ok: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Determine triggering user (if any)
  let triggeredBy: string | null = null;
  let triggerSource = "cron";
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token && token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
    try {
      const { data } = await admin.auth.getUser(token);
      if (data?.user) {
        triggeredBy = data.user.id;
        triggerSource = "manual";
      }
    } catch { /* ignore */ }
  }

  // Create run row
  const { data: runRow } = await admin.from("bnpl_processor_runs").insert({
    triggered_by: triggeredBy,
    trigger_source: triggerSource,
    status: "running",
  }).select("id").maybeSingle();
  const runId = runRow?.id as string | undefined;

  let dueCount = 0;
  let missedCount = 0;
  let defaultedCount = 0;
  let remindersSent = 0;
  let autoAttempted = 0;
  let autoSucceeded = 0;
  let autoFailed = 0;

  try {
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const upcomingISO = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10);
    const grace = new Date(today.getTime() - GRACE_DAYS * 86400000).toISOString().slice(0, 10);

    // 1. scheduled past due → due
    const dueRes = await admin.from("bnpl_installments")
      .update({ status: "due" })
      .eq("status", "scheduled")
      .lte("due_date", todayISO)
      .select("id");
    dueCount = dueRes.data?.length ?? 0;

    // 1b. Attempt autopay for any due installment with autopay enabled and a saved card
    const { data: dueForAutopay } = await admin
      .from("bnpl_installments")
      .select("id, obligation_id, auto_charge_attempts, bnpl_obligations!inner(auto_pay_enabled, owner_id, status)")
      .eq("status", "due")
      .lte("due_date", todayISO)
      .lt("auto_charge_attempts", 3);
    const eligibleAutopay = (dueForAutopay ?? []).filter((r: any) =>
      r.bnpl_obligations?.auto_pay_enabled
      && ["pending", "active"].includes(r.bnpl_obligations?.status));
    for (const row of eligibleAutopay) {
      autoAttempted++;
      const r = await attemptAutoCharge(row.id);
      if (r.ok) autoSucceeded++;
      else if (!r.skipped) autoFailed++;
    }

    // 2. due past grace → missed (re-run after autopay so paid ones are excluded)
    const missedRes = await admin.from("bnpl_installments")
      .update({ status: "missed" })
      .eq("status", "due")
      .lt("due_date", grace)
      .select("id");
    missedCount = missedRes.data?.length ?? 0;

    // 3. Mark obligations defaulted
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
          defaultedCount++;
          const { data: latest } = await admin.from("bnpl_installments")
            .select("id").eq("obligation_id", obId).eq("status", "missed")
            .order("due_date", { ascending: true }).limit(1).maybeSingle();
          if (latest) { await sendReminder(latest.id, "default"); remindersSent++; }
        }
      }
    }

    // 4. Reminders (skip already-paid; autopay may have cleared some)
    const fetchToRemind = async (filter: (q: any) => any, stage: string) => {
      const { data } = await filter(admin.from("bnpl_installments").select("id, last_reminded_at, reminder_stage, status"));
      return (data ?? []).filter((r: any) => r.reminder_stage !== stage && r.status !== "paid");
    };

    const upcoming = await fetchToRemind(
      (q) => q.eq("status", "scheduled").eq("due_date", upcomingISO), "upcoming",
    );
    const dueToday = await fetchToRemind(
      (q) => q.eq("status", "due").eq("due_date", todayISO), "due",
    );
    const missed = await fetchToRemind(
      (q) => q.eq("status", "missed"), "missed",
    );

    for (const r of upcoming) { await sendReminder(r.id, "upcoming"); remindersSent++; }
    for (const r of dueToday) { await sendReminder(r.id, "due"); remindersSent++; }
    for (const r of missed) { await sendReminder(r.id, "missed"); remindersSent++; }

    if (runId) {
      await admin.from("bnpl_processor_runs").update({
        status: "success",
        finished_at: new Date().toISOString(),
        installments_marked_due: dueCount,
        installments_marked_missed: missedCount,
        obligations_defaulted: defaultedCount,
        reminders_sent: remindersSent,
        auto_charges_attempted: autoAttempted,
        auto_charges_succeeded: autoSucceeded,
        auto_charges_failed: autoFailed,
      }).eq("id", runId);
    }

    return new Response(JSON.stringify({
      ok: true,
      run_id: runId,
      installments_marked_due: dueCount,
      installments_marked_missed: missedCount,
      obligations_defaulted: defaultedCount,
      reminders_sent: remindersSent,
      auto_charges_attempted: autoAttempted,
      auto_charges_succeeded: autoSucceeded,
      auto_charges_failed: autoFailed,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error("process-bnpl-overdue error:", e);
    if (runId) {
      await admin.from("bnpl_processor_runs").update({
        status: "error",
        finished_at: new Date().toISOString(),
        installments_marked_due: dueCount,
        installments_marked_missed: missedCount,
        obligations_defaulted: defaultedCount,
        reminders_sent: remindersSent,
        auto_charges_attempted: autoAttempted,
        auto_charges_succeeded: autoSucceeded,
        auto_charges_failed: autoFailed,
        error_message: msg,
      }).eq("id", runId);
    }
    return new Response(JSON.stringify({ error: msg, run_id: runId }), { status: 500, headers: corsHeaders });
  }
});
