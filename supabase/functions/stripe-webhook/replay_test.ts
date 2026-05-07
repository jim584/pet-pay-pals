// Replay-protection test for the stripe-webhook function.
//
// Sends the same Stripe event payload to the deployed webhook three times
// and confirms that only the first call is processed. Subsequent replays
// must be flagged as duplicates by the function (`{duplicate: true}` in the
// JSON response), which is proof that the `webhook_events` unique constraint
// short-circuited the handler before any bounty/payout side effects ran.
//
// Run with: supabase--test_edge_functions { "functions": ["stripe-webhook"] }
//
// Optional: if SUPABASE_SERVICE_ROLE_KEY is available in the test env, we
// additionally verify that exactly one `webhook_events` row exists for the
// event_id and that no duplicate `referrer_payouts` row was created.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/stripe-webhook`;

function uniqueId(prefix: string) {
  return `${prefix}_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function postEvent(body: string) {
  // No `stripe-signature` header — the function falls back to JSON.parse so
  // we can replay synthetic events without producing a real Stripe signature.
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANON_KEY}`,
    },
    body,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

Deno.test("stripe-webhook: replaying transfer.paid is idempotent", async () => {
  const eventId = uniqueId("evt");
  const transferId = uniqueId("tr");

  const event = {
    id: eventId,
    object: "event",
    type: "transfer.paid",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: transferId,
        object: "transfer",
        amount: 1000,
        currency: "usd",
        destination: "acct_test_replay",
        created: Math.floor(Date.now() / 1000),
      },
    },
  };
  const body = JSON.stringify(event);

  // Fire the same event 3 times.
  const r1 = await postEvent(body);
  const r2 = await postEvent(body);
  const r3 = await postEvent(body);

  assertEquals(r1.status, 200, `first call should succeed, got ${r1.status}`);
  assertEquals(r2.status, 200, `second call should succeed, got ${r2.status}`);
  assertEquals(r3.status, 200, `third call should succeed, got ${r3.status}`);

  assert(!r1.json.duplicate, "first call must NOT be flagged duplicate");
  assertEquals(r2.json.duplicate, true, "second call must be flagged duplicate");
  assertEquals(r3.json.duplicate, true, "third call must be flagged duplicate");

  if (SERVICE_KEY) {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    try {
      const { data: events } = await admin
        .from("webhook_events")
        .select("id")
        .eq("provider", "stripe")
        .eq("event_id", eventId);
      assertEquals(events?.length, 1, `expected 1 webhook_events row, got ${events?.length}`);

      const { data: payouts } = await admin
        .from("referrer_payouts")
        .select("id")
        .eq("stripe_transfer_id", transferId);
      assert(
        (payouts?.length ?? 0) <= 1,
        `expected ≤1 referrer_payouts rows, got ${payouts?.length}`,
      );
    } finally {
      await admin.from("webhook_events").delete()
        .eq("provider", "stripe").eq("event_id", eventId);
      await admin.from("referrer_payouts").delete()
        .eq("stripe_transfer_id", transferId);
    }
  }
});

Deno.test("stripe-webhook: replaying invoice.paid is idempotent", async () => {
  const eventId = uniqueId("evt");
  const invoiceId = uniqueId("in");
  const subId = uniqueId("sub_missing"); // intentionally not in DB

  const event = {
    id: eventId,
    object: "event",
    type: "invoice.paid",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: invoiceId,
        object: "invoice",
        subscription: subId,
        amount_paid: 2000,
        currency: "usd",
        status: "paid",
        created: Math.floor(Date.now() / 1000),
        lines: { data: [] },
      },
    },
  };
  const body = JSON.stringify(event);

  const responses = [];
  for (let i = 0; i < 3; i++) responses.push(await postEvent(body));
  for (let i = 0; i < responses.length; i++) {
    assertEquals(responses[i].status, 200, `call ${i + 1} expected 200`);
  }
  assert(!responses[0].json.duplicate, "first call must NOT be flagged duplicate");
  assertEquals(responses[1].json.duplicate, true, "second call must be duplicate");
  assertEquals(responses[2].json.duplicate, true, "third call must be duplicate");

  if (SERVICE_KEY) {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    try {
      const { data: events } = await admin
        .from("webhook_events")
        .select("id")
        .eq("provider", "stripe")
        .eq("event_id", eventId);
      assertEquals(events?.length, 1, "exactly one webhook_events row expected");

      // No payment_history was created (subscription doesn't exist), so no
      // bounty rows could possibly be tied to this invoice.
      const { data: ph } = await admin
        .from("payment_history")
        .select("id")
        .eq("stripe_invoice_id", invoiceId);
      assertEquals(ph?.length ?? 0, 0, "no payment_history for unmatched subscription");
    } finally {
      await admin.from("webhook_events").delete()
        .eq("provider", "stripe").eq("event_id", eventId);
    }
  }
});
