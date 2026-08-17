import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendLovableEmail } from "npm:@lovable.dev/email-js";
import { recomputeUpdateCadence, UPDATE_INTERVAL_DAYS } from "../_shared/campaign-updates.ts";
import { recomputeDisbursementEligibility } from "../_shared/disbursement.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 200;
const REMINDER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const SENDER_DOMAIN = "notify.plexaihub.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = Date.now();

    // Every live case that owes a required update — recompute, then remind.
    const { data: live, error } = await admin
      .from("help_now_campaigns")
      .select("id, owner_id, title, update_reminder_sent_at")
      .eq("status", "published")
      .limit(BATCH_SIZE);
    if (error) throw error;

    let paused = 0;
    let reminded = 0;

    for (const c of live ?? []) {
      const cadence = await recomputeUpdateCadence(admin, c.id, now);
      if (!cadence?.disbursement_paused_for_update) continue;

      // Requirement 15: pause further disbursement, never close the case.
      await recomputeDisbursementEligibility(admin, c.id);
      paused += 1;

      const lastSent = c.update_reminder_sent_at ? new Date(c.update_reminder_sent_at).getTime() : 0;
      if (now - lastSent < REMINDER_COOLDOWN_MS) continue;

      if (Deno.env.get("EMAILS_ENABLED") !== "true") {
        console.log("Emails disabled — skipping update reminder", { campaign_id: c.id });
        continue;
      }

      try {
        const { data: userResp } = await admin.auth.admin.getUserById(c.owner_id);
        const email = userResp?.user?.email;
        if (!email) continue;

        await sendLovableEmail({
          from: `Help A Pet <updates@${SENDER_DOMAIN}>`,
          to: [email],
          subject: "Help A Pet: your Help a Pet Now case needs an update",
          html: `
            <p>Your Help a Pet Now case${c.title ? ` &ldquo;${c.title}&rdquo;` : ""} is due for a community update.</p>
            <p>${cadence.pause_reason ?? `Donors expect an update at least every ${UPDATE_INTERVAL_DAYS} days.`}</p>
            <p>Further payouts on this case are paused until you post the update. Your case stays open —
            posting the update resumes the normal disbursement process.</p>
          `,
        });
        await admin.from("help_now_campaigns")
          .update({ update_reminder_sent_at: new Date(now).toISOString() })
          .eq("id", c.id);
        reminded += 1;
      } catch (e) {
        console.error("reminder failed for campaign", c.id, e);
      }
    }

    return json({ ok: true, checked: (live ?? []).length, paused, reminded });
  } catch (e) {
    console.error("help-now-update-reminders error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
