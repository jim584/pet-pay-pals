import { supabase } from "@/integrations/supabase/client";

export type ReferrerType = "vet" | "shelter" | "influencer" | "partner";

export interface Referrer {
  id: string;
  user_id: string | null;
  type: ReferrerType;
  display_name: string;
  code: string;
  is_active: boolean;
  fear_free_certified: boolean;
  payout_email: string | null;
  payout_method: string;
  notes: string | null;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  membership_id: string | null;
  code_used: string;
  status: string;
  activated_at: string | null;
  created_at: string;
  referrer_name?: string | null;
  member_name?: string | null;
}

export interface ReferralBounty {
  id: string;
  referral_id: string;
  referrer_id: string;
  payment_history_id: string | null;
  membership_id: string | null;
  period: string;
  rate: number;
  gross_membership_amount: number;
  bounty_amount: number;
  hold_until: string;
  status: string;
  paid_at: string | null;
  payout_id: string | null;
  created_at: string;
  referrer_name?: string | null;
}

export interface ReferrerPayout {
  id: string;
  referrer_id: string;
  amount: number;
  method: string;
  status: string;
  external_ref: string | null;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  referrer_name?: string | null;
}

export interface ReferralSettings {
  id: string;
  intro_rate: number;
  intro_months: number;
  ongoing_rate: number;
  hold_days: number;
  updated_at: string;
}

export async function resolveReferralCode(code: string) {
  if (!code) return null;
  const { data, error } = await supabase.rpc("resolve_referral_code", { _code: code });
  if (error) return null;
  return (data && data[0]) || null;
}

export async function attachReferralOnSignup(userId: string, code: string) {
  const r = await resolveReferralCode(code);
  if (!r) return false;
  const { error } = await supabase.from("referrals").insert({
    referrer_id: r.referrer_id,
    referred_user_id: userId,
    code_used: code,
    status: "pending_signup",
  });
  if (error) {
    console.warn("attachReferralOnSignup:", error.message);
    return false;
  }
  return true;
}

// ---------- Admin ----------

export async function listReferrers(): Promise<Referrer[]> {
  const { data, error } = await supabase
    .from("referrers").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Referrer[];
}

export async function createReferrer(input: Partial<Referrer>) {
  const { data, error } = await supabase
    .from("referrers")
    .insert({
      type: input.type!,
      display_name: input.display_name!,
      code: input.code || "",
      user_id: input.user_id ?? null,
      fear_free_certified: input.fear_free_certified ?? false,
      payout_email: input.payout_email ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Referrer;
}

export async function updateReferrer(id: string, patch: Partial<Referrer>) {
  const { error } = await supabase.from("referrers").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteReferrer(id: string) {
  const { error } = await supabase.from("referrers").delete().eq("id", id);
  if (error) throw error;
}

export async function listReferrals(filter?: string): Promise<Referral[]> {
  let q = supabase.from("referrals").select("*, referrers(display_name)").order("created_at", { ascending: false });
  if (filter && filter !== "all") q = q.eq("status", filter);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const userIds = Array.from(new Set(rows.map(r => r.referred_user_id).filter(Boolean)));
  let nameMap = new Map<string, string>();
  if (userIds.length) {
    const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
    nameMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
  }
  return rows.map(r => ({
    ...r,
    referrer_name: r.referrers?.display_name ?? null,
    member_name: nameMap.get(r.referred_user_id) ?? null,
  })) as Referral[];
}

export async function listBounties(filter?: string): Promise<ReferralBounty[]> {
  let q = supabase.from("referral_bounties").select("*, referrers(display_name)").order("created_at", { ascending: false }).limit(200);
  if (filter && filter !== "all") q = q.eq("status", filter);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((b: any) => ({ ...b, referrer_name: b.referrers?.display_name ?? null })) as ReferralBounty[];
}

export async function runReferralHoldJob() {
  const { data, error } = await supabase.functions.invoke("process-referral-bounties");
  if (error) throw error;
  return data as { promoted: number };
}

export async function listPayouts(): Promise<ReferrerPayout[]> {
  const { data, error } = await supabase
    .from("referrer_payouts").select("*, referrers(display_name)").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p: any) => ({ ...p, referrer_name: p.referrers?.display_name ?? null })) as ReferrerPayout[];
}

export async function createPayoutForReferrer(referrerId: string, externalRef?: string) {
  // Sum available bounties
  const { data: avail, error: e1 } = await supabase
    .from("referral_bounties").select("id, bounty_amount").eq("referrer_id", referrerId).eq("status", "available");
  if (e1) throw e1;
  if (!avail || avail.length === 0) throw new Error("No available bounties to pay out.");
  const total = avail.reduce((s: number, b: any) => s + Number(b.bounty_amount), 0);

  const { data: payout, error: e2 } = await supabase
    .from("referrer_payouts")
    .insert({
      referrer_id: referrerId,
      amount: total,
      method: "manual",
      status: "paid",
      external_ref: externalRef ?? null,
      paid_at: new Date().toISOString(),
    })
    .select().single();
  if (e2) throw e2;

  const ids = avail.map((b: any) => b.id);
  const { error: e3 } = await supabase.from("referral_bounties")
    .update({ status: "paid", payout_id: payout.id, paid_at: new Date().toISOString() })
    .in("id", ids);
  if (e3) throw e3;

  return { payout, count: ids.length, total };
}

export async function getReferralSettings(): Promise<ReferralSettings | null> {
  const { data, error } = await supabase.from("referral_program_settings").select("*").limit(1).maybeSingle();
  if (error) throw error;
  return (data ?? null) as ReferralSettings | null;
}

export async function updateReferralSettings(id: string, patch: Partial<ReferralSettings>) {
  const { error } = await supabase
    .from("referral_program_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ---------- Self-scoped (referrer dashboard) ----------

export interface ShelterMilestone {
  id: string;
  referrer_id: string;
  adoption_listing_id: string | null;
  pet_name: string;
  goal_amount: number;
  raised_amount: number;
  payout_amount: number;
  status: string;
  completed_at: string | null;
  created_at: string;
}

export async function getMyReferrer(): Promise<Referrer | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("referrers")
    .select("*").eq("user_id", user.id).maybeSingle();
  if (error) return null;
  return (data ?? null) as Referrer | null;
}

export async function listMyReferrals(): Promise<Referral[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("referrals").select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const userIds = Array.from(new Set(rows.map(r => r.referred_user_id).filter(Boolean)));
  let nameMap = new Map<string, string>();
  if (userIds.length) {
    const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
    nameMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
  }
  return rows.map(r => ({ ...r, member_name: nameMap.get(r.referred_user_id) ?? null })) as Referral[];
}

export async function listMyBounties(): Promise<ReferralBounty[]> {
  const { data, error } = await supabase
    .from("referral_bounties").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReferralBounty[];
}

export async function listMyPayouts(): Promise<ReferrerPayout[]> {
  const { data, error } = await supabase
    .from("referrer_payouts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReferrerPayout[];
}

// ---------- Stripe Connect ----------

export async function startConnectOnboarding(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("referrer-connect-onboard", {
    body: { return_url: `${window.location.origin}/referrer?onboarded=1` },
  });
  if (error) throw error;
  return (data as any)?.url ?? null;
}

export async function refreshConnectStatus(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("referrer-connect-status");
  if (error) throw error;
  return (data as any)?.status ?? null;
}

export async function payReferrerViaStripe(referrerId: string) {
  const { data, error } = await supabase.functions.invoke("referrer-payout", {
    body: { referrer_id: referrerId },
  });
  if (error) throw error;
  return data as { ok: boolean; transfer_id: string; amount: number; count: number };
}

// ---------- Shelter milestones ----------

export async function listMilestones(referrerId?: string): Promise<ShelterMilestone[]> {
  let q = supabase.from("shelter_referral_milestones").select("*").order("created_at", { ascending: false });
  if (referrerId) q = q.eq("referrer_id", referrerId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ShelterMilestone[];
}

export async function createMilestone(input: {
  referrer_id: string; pet_name: string; goal_amount: number; payout_amount: number;
  adoption_listing_id?: string | null;
}) {
  const { error } = await supabase.from("shelter_referral_milestones").insert(input);
  if (error) throw error;
}

export async function recordMilestoneContribution(milestoneId: string, amount: number, source = "manual") {
  const { error } = await supabase.rpc("record_milestone_contribution", {
    _milestone_id: milestoneId,
    _amount: amount,
    _source: source,
    _payment_history_id: null,
  });
  if (error) throw error;
}

export async function listMyMilestones(): Promise<ShelterMilestone[]> {
  const { data, error } = await supabase
    .from("shelter_referral_milestones").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ShelterMilestone[];
}
