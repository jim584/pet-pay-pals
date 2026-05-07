/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { sendLovableEmail } from 'npm:@lovable.dev/email-js'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { BnplReminderEmail, type BnplStage } from '../_shared/email-templates/bnpl-reminder.tsx'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_NAME = "Help A Pet";
const SENDER_DOMAIN = "notify.plexaihub.com";
const SUBJECT: Record<BnplStage, string> = {
  upcoming: `${SITE_NAME}: your installment is coming up`,
  due: `${SITE_NAME}: your installment is due today`,
  missed: `${SITE_NAME}: a payment was missed`,
  default: `${SITE_NAME}: your payment plan is in default`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Internal-only: must be called with service-role key.
    const authHeader = req.headers.get("Authorization") ?? "";
    const expected = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
    if (authHeader !== expected) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { installment_id, stage } = await req.json() as { installment_id: string; stage: BnplStage };
    if (!installment_id || !stage) {
      return new Response(JSON.stringify({ error: "installment_id and stage required" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: inst } = await admin.from("bnpl_installments").select("*").eq("id", installment_id).maybeSingle();
    if (!inst) return new Response(JSON.stringify({ error: "Installment not found" }), { status: 404, headers: corsHeaders });

    const { data: ob } = await admin.from("bnpl_obligations").select("*").eq("id", inst.obligation_id).maybeSingle();
    if (!ob) return new Response(JSON.stringify({ error: "Obligation not found" }), { status: 404, headers: corsHeaders });

    // Recipient
    const { data: userResp } = await admin.auth.admin.getUserById(ob.owner_id);
    const recipientEmail = userResp?.user?.email;
    if (!recipientEmail) return new Response(JSON.stringify({ error: "No recipient email" }), { status: 400, headers: corsHeaders });

    const { data: profile } = await admin.from("profiles").select("full_name").eq("user_id", ob.owner_id).maybeSingle();

    const { data: ticket } = await admin.from("vet_tickets").select("clinic_name").eq("id", ob.ticket_id).maybeSingle();

    const props = {
      stage,
      recipientName: profile?.full_name || undefined,
      clinicName: ticket?.clinic_name ?? "your clinic",
      installmentSeq: Number(inst.seq),
      totalInstallments: Number(ob.installment_count),
      amount: Number(inst.amount).toFixed(2),
      dueDate: new Date(inst.due_date).toLocaleDateString(),
      outstandingAmount: Number(ob.outstanding_amount).toFixed(2),
      payUrl: `https://${"plexaihub.com"}/dashboard/payment-plans`,
    };

    const html = await renderAsync(React.createElement(BnplReminderEmail, props));

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY missing');

    await sendLovableEmail({
      apiKey,
      from: `${SITE_NAME} <noreply@${SENDER_DOMAIN}>`,
      to: recipientEmail,
      subject: SUBJECT[stage],
      html,
    });

    await admin.from("bnpl_installments")
      .update({ last_reminded_at: new Date().toISOString(), reminder_stage: stage })
      .eq("id", installment_id);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("send-bnpl-reminder error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
