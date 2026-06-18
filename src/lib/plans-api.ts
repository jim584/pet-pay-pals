import { supabase } from "@/integrations/supabase/client";

export type MembershipPlan = {
  id: string;
  plan_code: string;
  tier_label: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  species: "dog" | "cat";
  membership_fee: number;
  platform_fee: number;
  platform_fee_monthly: number | null;
  platform_fee_annual: number | null;
  transaction_fee_pct: number | null;
  direct_pay_portion: number;
  reserve_portion: number;
  admin_portion: number;
  plan_cap: number | null;
  dp_window_months: number | null;
  max_dp_amount: number | null;
  annual_price: number;
  fear_free_member_charge: number;
};

export type Membership = {
  id: string;
  user_id: string;
  pet_id: string | null;
  plan_id: string;
  status: "pending" | "active" | "past_due" | "cancelled" | "paused";
  billing_interval: "month" | "year";
  is_fear_free_member: boolean;
  current_period_end: string | null;
  started_at: string | null;
};

export async function fetchPlans(species?: "dog" | "cat"): Promise<MembershipPlan[]> {
  let q = supabase.from("membership_plans").select("*").eq("is_active", true);
  if (species) q = q.eq("species", species);
  const { data, error } = await q.order("membership_fee", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MembershipPlan[];
}

export async function fetchMyMembership(userId: string): Promise<(Membership & { plan: MembershipPlan }) | null> {
  const { data, error } = await supabase
    .from("memberships")
    .select("*, plan:membership_plans(*)")
    .eq("user_id", userId)
    .in("status", ["active", "past_due", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function fetchMyDpSummary(userId: string) {
  const { data, error } = await supabase
    .from("direct_pay_accruals")
    .select("amount, remaining_amount, expires_at, expired")
    .eq("user_id", userId)
    .eq("expired", false);
  if (error) throw error;
  const available = (data ?? []).reduce((s, r: any) => s + Number(r.remaining_amount), 0);
  const soon = (data ?? []).filter((r: any) => {
    if (!r.expires_at) return false;
    const days = (new Date(r.expires_at).getTime() - Date.now()) / 86400000;
    return days <= 60;
  }).reduce((s, r: any) => s + Number(r.remaining_amount), 0);
  return { available, expiringSoon: soon };
}

export type ReserveSummary = {
  balance: number;
  lifetimeAccrued: number;
  lifetimeConsumed: number;
  eligible: boolean;
  eligibleSince: string | null;
  continuousPaidMonths: number;
  monthsUntilEligible: number;
};

export async function fetchMyReserveSummary(userId: string): Promise<ReserveSummary> {
  const [accruals, membership] = await Promise.all([
    supabase
      .from("member_reserve_accruals")
      .select("amount, remaining_amount")
      .eq("user_id", userId),
    supabase
      .from("memberships")
      .select("reserve_eligible_since, continuous_paid_months, status")
      .eq("user_id", userId)
      .in("status", ["active", "past_due", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const rows = (accruals.data ?? []) as any[];
  const balance = rows.reduce((s, r) => s + Number(r.remaining_amount ?? 0), 0);
  const lifetimeAccrued = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const m = membership.data as any;
  const months = Number(m?.continuous_paid_months ?? 0);
  const eligibleSince = m?.reserve_eligible_since ?? null;
  return {
    balance,
    lifetimeAccrued,
    lifetimeConsumed: lifetimeAccrued - balance,
    eligible: !!eligibleSince,
    eligibleSince,
    continuousPaidMonths: months,
    monthsUntilEligible: Math.max(12 - months, 0),
  };
}

export async function openCustomerPortal(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("customer-portal", { body: {} });
  if (error) throw error;
  if (!data?.url) throw new Error("No portal URL returned");
  return data.url as string;
}

export type PaymentHistoryRow = {
  id: string;
  kind: string;
  status: string;
  amount: number;
  currency: string;
  description: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  occurred_at: string;
};

export async function fetchPaymentHistory(userId: string): Promise<PaymentHistoryRow[]> {
  const { data, error } = await supabase
    .from("payment_history")
    .select("id, kind, status, amount, currency, description, hosted_invoice_url, invoice_pdf, occurred_at")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as PaymentHistoryRow[];
}

export async function startCheckout(args: {
  plan_id: string;
  pet_id?: string | null;
  billing_interval: "month" | "year";
  /** @deprecated Server now derives Fear Free status from Vet of Record. Ignored. */
  is_fear_free_member?: boolean;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("create-checkout", { body: args });
  if (error) throw error;
  if (!data?.url) throw new Error("No checkout URL returned");
  return data.url as string;
}
