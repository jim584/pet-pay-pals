import { supabase } from "@/integrations/supabase/client";

export type AppRole = "pet_owner" | "vet" | "admin";

export interface AdminKpis {
  totalUsers: number;
  petOwners: number;
  vets: number;
  admins: number;
  activeMemberships: number;
  pendingTickets: number;
  totalPets: number;
  newSignups7d: number;
  revenue30d: number;
  mrr: number;
  donations30d: number;
  lastPaymentAt: string | null;
}

export interface AdminUserRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  roles: AppRole[];
}

export async function fetchAdminKpis(): Promise<AdminKpis> {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [profiles, roles, memberships, tickets, pets, signups, payments, activeMemForMrr, donations, lastPayment] = await Promise.all([
    supabase.from("profiles").select("user_id", { count: "exact", head: true }),
    supabase.from("user_roles").select("role"),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("vet_tickets").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"]),
    supabase.from("pets").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("user_id", { count: "exact", head: true }).gte("created_at", since7d),
    supabase.from("payment_history").select("amount").eq("status", "paid").gte("occurred_at", since30d),
    supabase.from("memberships").select("billing_interval, plan:membership_plans(membership_fee, annual_price)").eq("status", "active"),
    supabase.from("sponsorship_donations").select("amount").gte("created_at", since30d),
    supabase.from("payment_history").select("occurred_at").order("occurred_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const roleCounts = { pet_owner: 0, vet: 0, admin: 0 };
  (roles.data ?? []).forEach((r: any) => {
    if (r.role in roleCounts) roleCounts[r.role as keyof typeof roleCounts]++;
  });

  const mrr = (activeMemForMrr.data ?? []).reduce((sum: number, m: any) => {
    const fee = Number(m.plan?.membership_fee ?? 0);
    const annual = Number(m.plan?.annual_price ?? 0);
    return sum + (m.billing_interval === "year" ? annual / 12 : fee);
  }, 0);

  return {
    totalUsers: profiles.count ?? 0,
    petOwners: roleCounts.pet_owner,
    vets: roleCounts.vet,
    admins: roleCounts.admin,
    activeMemberships: memberships.count ?? 0,
    pendingTickets: tickets.count ?? 0,
    totalPets: pets.count ?? 0,
    newSignups7d: signups.count ?? 0,
    revenue30d: (payments.data ?? []).reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0),
    mrr,
    donations30d: (donations.data ?? []).reduce((sum: number, d: any) => sum + Number(d.amount ?? 0), 0),
    lastPaymentAt: (lastPayment.data as any)?.occurred_at ?? null,
  };
}

export async function triggerStripeBackfill(): Promise<{ synced: number; created: number }> {
  const { data, error } = await supabase.functions.invoke("backfill-payment-history", { body: {} });
  if (error) throw error;
  return data as { synced: number; created: number };
}

export async function fetchRecentSignups(limit = 5) {
  const { data } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_url, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchRecentPayments(limit = 5) {
  const { data } = await supabase
    .from("payment_history")
    .select("id, user_id, amount, status, occurred_at, kind")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchAdminUsers(search = ""): Promise<AdminUserRow[]> {
  let q = supabase
    .from("profiles")
    .select("user_id, full_name, avatar_url, phone, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (search.trim()) {
    q = q.ilike("full_name", `%${search.trim()}%`);
  }

  const { data: profiles, error } = await q;
  if (error) throw error;

  const userIds = (profiles ?? []).map((p) => p.user_id);
  if (userIds.length === 0) return [];

  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", userIds);

  const rolesByUser: Record<string, AppRole[]> = {};
  (rolesData ?? []).forEach((r: any) => {
    if (!rolesByUser[r.user_id]) rolesByUser[r.user_id] = [];
    rolesByUser[r.user_id].push(r.role);
  });

  return (profiles ?? []).map((p) => ({
    ...p,
    roles: rolesByUser[p.user_id] ?? [],
  }));
}

export async function adminAssignRole(userId: string, role: AppRole) {
  const { data, error } = await supabase.functions.invoke("admin-assign-role", {
    body: { user_id: userId, role, action: "assign" },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export async function adminRemoveRole(userId: string, role: AppRole) {
  const { data, error } = await supabase.functions.invoke("admin-assign-role", {
    body: { user_id: userId, role, action: "remove" },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

// ===== Memberships =====

export type MembershipStatus = "pending" | "active" | "past_due" | "cancelled" | "paused";

export interface AdminMembershipRow {
  id: string;
  user_id: string;
  plan_id: string;
  status: MembershipStatus;
  billing_interval: "month" | "year";
  is_fear_free_member: boolean;
  requires_admin_approval: boolean;
  current_period_end: string | null;
  started_at: string | null;
  cancelled_at: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  created_at: string;
  stripe_subscription_id: string | null;
  user_full_name: string | null;
  user_avatar: string | null;
  plan_label: string;
  plan_species: string;
  plan_tier: string;
}

export async function fetchAdminMemberships(filter: MembershipStatus | "all" = "all", search = ""): Promise<AdminMembershipRow[]> {
  let q = supabase
    .from("memberships")
    .select("*, plan:membership_plans(tier, tier_label, species)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (filter !== "all") q = q.eq("status", filter);

  const { data, error } = await q;
  if (error) throw error;

  const userIds = Array.from(new Set((data ?? []).map((m: any) => m.user_id)));
  let profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", userIds);
    (profs ?? []).forEach((p: any) => {
      profileMap[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
    });
  }

  const rows: AdminMembershipRow[] = (data ?? []).map((m: any) => ({
    id: m.id,
    user_id: m.user_id,
    plan_id: m.plan_id,
    status: m.status,
    billing_interval: m.billing_interval,
    is_fear_free_member: m.is_fear_free_member,
    requires_admin_approval: m.requires_admin_approval ?? false,
    current_period_end: m.current_period_end,
    started_at: m.started_at,
    cancelled_at: m.cancelled_at,
    rejection_reason: m.rejection_reason,
    admin_notes: m.admin_notes,
    created_at: m.created_at,
    stripe_subscription_id: m.stripe_subscription_id,
    user_full_name: profileMap[m.user_id]?.full_name ?? null,
    user_avatar: profileMap[m.user_id]?.avatar_url ?? null,
    plan_label: m.plan?.tier_label ?? m.plan?.tier ?? "—",
    plan_species: m.plan?.species ?? "—",
    plan_tier: m.plan?.tier ?? "—",
  }));

  if (search.trim()) {
    const s = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (r.user_full_name ?? "").toLowerCase().includes(s) ||
        r.plan_label.toLowerCase().includes(s) ||
        r.plan_tier.toLowerCase().includes(s)
    );
  }
  return rows;
}

export interface MembershipHistoryRow {
  id: string;
  membership_id: string;
  from_status: string | null;
  to_status: string;
  source: string;
  changed_by: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
}

export async function fetchMembershipHistory(membershipId: string): Promise<MembershipHistoryRow[]> {
  const { data, error } = await supabase
    .from("membership_status_changes")
    .select("*")
    .eq("membership_id", membershipId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MembershipHistoryRow[];
}

export type MembershipAction = "approve" | "decline" | "pause" | "cancel" | "reactivate" | "mark_active" | "extend";

export async function adminMembershipAction(args: {
  membership_id: string;
  action: MembershipAction;
  reason?: string;
  admin_notes?: string;
  new_period_end?: string;
}) {
  const { data, error } = await supabase.functions.invoke("admin-update-membership", { body: args });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export async function requestMembershipForReview(args: {
  plan_id: string;
  pet_id?: string | null;
  billing_interval: "month" | "year";
  is_fear_free_member: boolean;
  user_id: string;
}) {
  const { data, error } = await supabase
    .from("memberships")
    .insert({
      user_id: args.user_id,
      plan_id: args.plan_id,
      pet_id: args.pet_id ?? null,
      billing_interval: args.billing_interval,
      is_fear_free_member: args.is_fear_free_member,
      status: "pending",
      requires_admin_approval: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============ Admin Vet Management ============

export interface AdminVetRow {
  id: string;
  user_id: string;
  clinic_name: string;
  specializations: string[] | null;
  location: string | null;
  phone: string | null;
  website: string | null;
  bio: string | null;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
  owner_full_name: string | null;
  owner_avatar_url: string | null;
  // Verification
  license_number: string | null;
  license_state: string | null;
  license_document_url: string | null;
  is_license_verified: boolean;
  fear_free_certified: boolean;
  fear_free_cert_number: string | null;
  fear_free_cert_url: string | null;
  fear_free_verified_at: string | null;
}

export interface AdminVetService {
  id: string;
  vet_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminVetAppointment {
  id: string;
  vet_id: string;
  owner_id: string;
  pet_id: string;
  service_id: string | null;
  scheduled_at: string;
  status: string;
  notes: string | null;
  created_at: string;
  pet_name: string | null;
  pet_species: string | null;
  owner_full_name: string | null;
  service_name: string | null;
  service_price: number | null;
}

export type VetApprovalFilter = "pending" | "approved" | "all";

export async function fetchAdminVets(filter: VetApprovalFilter = "all", search?: string): Promise<AdminVetRow[]> {
  let q = supabase
    .from("vet_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (filter === "pending") q = q.eq("is_approved", false);
  if (filter === "approved") q = q.eq("is_approved", true);

  const { data, error } = await q;
  if (error) throw error;

  const userIds = Array.from(new Set((data ?? []).map((v: any) => v.user_id).filter(Boolean)));
  let profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
  if (userIds.length > 0) {
    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", userIds);
    if (pErr) throw pErr;
    profileMap = new Map((profs ?? []).map((p: any) => [p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url }]));
  }

  let rows = (data ?? []).map((v: any) => ({
    id: v.id,
    user_id: v.user_id,
    clinic_name: v.clinic_name,
    specializations: v.specializations,
    location: v.location,
    phone: v.phone,
    website: v.website,
    bio: v.bio,
    is_approved: v.is_approved,
    created_at: v.created_at,
    updated_at: v.updated_at,
    owner_full_name: profileMap.get(v.user_id)?.full_name ?? null,
    owner_avatar_url: profileMap.get(v.user_id)?.avatar_url ?? null,
    license_number: v.license_number ?? null,
    license_state: v.license_state ?? null,
    license_document_url: v.license_document_url ?? null,
    is_license_verified: !!v.is_license_verified,
    fear_free_certified: !!v.fear_free_certified,
    fear_free_cert_number: v.fear_free_cert_number ?? null,
    fear_free_cert_url: v.fear_free_cert_url ?? null,
    fear_free_verified_at: v.fear_free_verified_at ?? null,
  })) as AdminVetRow[];

  if (search?.trim()) {
    const s = search.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.clinic_name?.toLowerCase().includes(s) ||
        (r.owner_full_name ?? "").toLowerCase().includes(s) ||
        (r.location ?? "").toLowerCase().includes(s)
    );
  }
  return rows;
}

export async function fetchAdminVetDetail(vetProfileId: string): Promise<AdminVetRow | null> {
  const { data, error } = await supabase
    .from("vet_profiles")
    .select("*")
    .eq("id", vetProfileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const v: any = data;

  let prof: { full_name: string | null; avatar_url: string | null } | null = null;
  if (v.user_id) {
    const { data: p, error: pErr } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", v.user_id)
      .maybeSingle();
    if (pErr) throw pErr;
    prof = p as any;
  }

  return {
    id: v.id,
    user_id: v.user_id,
    clinic_name: v.clinic_name,
    specializations: v.specializations,
    location: v.location,
    phone: v.phone,
    website: v.website,
    bio: v.bio,
    is_approved: v.is_approved,
    created_at: v.created_at,
    updated_at: v.updated_at,
    owner_full_name: prof?.full_name ?? null,
    owner_avatar_url: prof?.avatar_url ?? null,
    license_number: v.license_number ?? null,
    license_state: v.license_state ?? null,
    license_document_url: v.license_document_url ?? null,
    is_license_verified: !!v.is_license_verified,
    fear_free_certified: !!v.fear_free_certified,
    fear_free_cert_number: v.fear_free_cert_number ?? null,
    fear_free_cert_url: v.fear_free_cert_url ?? null,
    fear_free_verified_at: v.fear_free_verified_at ?? null,
  };
}

export async function setVetApproval(vetProfileId: string, approved: boolean) {
  const { error } = await supabase
    .from("vet_profiles")
    .update({ is_approved: approved })
    .eq("id", vetProfileId);
  if (error) throw error;
}

export async function setVetLicenseVerified(vetProfileId: string, verified: boolean) {
  const { error } = await supabase
    .from("vet_profiles")
    .update({ is_license_verified: verified })
    .eq("id", vetProfileId);
  if (error) throw error;
}

export async function setVetFearFreeVerified(vetProfileId: string, verified: boolean) {
  const { error } = await supabase
    .from("vet_profiles")
    .update({ fear_free_certified: verified })
    .eq("id", vetProfileId);
  if (error) throw error;
}

export async function getVetCredentialSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("vet-credentials")
    .createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}

export async function fetchAdminVetServices(vetProfileId: string): Promise<AdminVetService[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("vet_id", vetProfileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AdminVetService[];
}

export async function setVetServiceActive(serviceId: string, active: boolean) {
  const { error } = await supabase
    .from("services")
    .update({ is_active: active })
    .eq("id", serviceId);
  if (error) throw error;
}

export async function deleteVetService(serviceId: string) {
  const { error } = await supabase.from("services").delete().eq("id", serviceId);
  if (error) throw error;
}

export async function fetchAdminVetAppointments(
  vetProfileId: string,
  statusFilter?: string
): Promise<AdminVetAppointment[]> {
  let q = supabase
    .from("appointments")
    .select("*, pets(name, species), services(name, price)")
    .eq("vet_id", vetProfileId)
    .order("scheduled_at", { ascending: false });
  if (statusFilter && statusFilter !== "all") q = q.eq("status", statusFilter);

  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];

  const ownerIds = Array.from(new Set(rows.map((a: any) => a.owner_id).filter(Boolean)));
  let profileMap = new Map<string, string>();
  if (ownerIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ownerIds);
    profileMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
  }

  return rows.map((a: any) => ({
    id: a.id,
    vet_id: a.vet_id,
    owner_id: a.owner_id,
    pet_id: a.pet_id,
    service_id: a.service_id,
    scheduled_at: a.scheduled_at,
    status: a.status,
    notes: a.notes,
    created_at: a.created_at,
    pet_name: a.pets?.name ?? null,
    pet_species: a.pets?.species ?? null,
    owner_full_name: profileMap.get(a.owner_id) ?? null,
    service_name: a.services?.name ?? null,
    service_price: a.services?.price ?? null,
  })) as AdminVetAppointment[];
}

export async function updateAdminAppointment(id: string, updates: { status?: string; notes?: string | null }) {
  const { error } = await supabase.from("appointments").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteAdminAppointment(id: string) {
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) throw error;
}

// ============ Admin BNPL Payment Plans ============

export type BnplStatus = "pending" | "active" | "paid_off" | "defaulted" | "cancelled";
export type BnplFilter = "all" | BnplStatus;

export interface AdminBnplRow {
  id: string;
  pet_id: string;
  owner_id: string;
  ticket_id: string;
  provider: string;
  original_amount: number;
  outstanding_amount: number;
  status: BnplStatus;
  external_ref: string | null;
  created_at: string;
  updated_at: string;
  owner_full_name: string | null;
  owner_avatar_url: string | null;
  pet_name: string | null;
  ticket_clinic_name: string | null;
}

export interface BnplPaymentRow {
  id: string;
  obligation_id: string;
  amount: number;
  paid_at: string;
  method: string;
  external_ref: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface BnplStats {
  total_plans: number;
  active_count: number;
  outstanding_total: number;
  defaulted_count: number;
  paid_off_count: number;
}

export async function fetchAdminBnpl(filter: BnplFilter = "all", search?: string): Promise<AdminBnplRow[]> {
  let q = supabase
    .from("bnpl_obligations")
    .select("*")
    .order("created_at", { ascending: false });
  if (filter !== "all") q = q.eq("status", filter);

  const { data, error } = await q;
  if (error) throw error;

  const ownerIds = Array.from(new Set((data ?? []).map((b: any) => b.owner_id).filter(Boolean)));
  const petIds = Array.from(new Set((data ?? []).map((b: any) => b.pet_id).filter(Boolean)));
  const ticketIds = Array.from(new Set((data ?? []).map((b: any) => b.ticket_id).filter(Boolean)));

  const [profsRes, petsRes, ticketsRes] = await Promise.all([
    ownerIds.length
      ? supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", ownerIds)
      : Promise.resolve({ data: [], error: null } as any),
    petIds.length
      ? supabase.from("pets").select("id, name").in("id", petIds)
      : Promise.resolve({ data: [], error: null } as any),
    ticketIds.length
      ? supabase.from("vet_tickets").select("id, clinic_name").in("id", ticketIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);
  if (profsRes.error) throw profsRes.error;
  if (petsRes.error) throw petsRes.error;
  if (ticketsRes.error) throw ticketsRes.error;

  const profileMap = new Map((profsRes.data ?? []).map((p: any) => [p.user_id, p]));
  const petMap = new Map((petsRes.data ?? []).map((p: any) => [p.id, p]));
  const ticketMap = new Map((ticketsRes.data ?? []).map((t: any) => [t.id, t]));

  let rows: AdminBnplRow[] = (data ?? []).map((b: any) => ({
    id: b.id,
    pet_id: b.pet_id,
    owner_id: b.owner_id,
    ticket_id: b.ticket_id,
    provider: b.provider,
    original_amount: Number(b.original_amount),
    outstanding_amount: Number(b.outstanding_amount),
    status: b.status,
    external_ref: b.external_ref,
    created_at: b.created_at,
    updated_at: b.updated_at,
    owner_full_name: (profileMap.get(b.owner_id) as any)?.full_name ?? null,
    owner_avatar_url: (profileMap.get(b.owner_id) as any)?.avatar_url ?? null,
    pet_name: (petMap.get(b.pet_id) as any)?.name ?? null,
    ticket_clinic_name: (ticketMap.get(b.ticket_id) as any)?.clinic_name ?? null,
  }));

  if (search?.trim()) {
    const s = search.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.owner_full_name ?? "").toLowerCase().includes(s) ||
        (r.pet_name ?? "").toLowerCase().includes(s) ||
        (r.ticket_clinic_name ?? "").toLowerCase().includes(s) ||
        (r.external_ref ?? "").toLowerCase().includes(s)
    );
  }
  return rows;
}

export async function fetchAdminBnplStats(): Promise<BnplStats> {
  const { data, error } = await supabase
    .from("bnpl_obligations")
    .select("status, outstanding_amount");
  if (error) throw error;
  const rows = data ?? [];
  return {
    total_plans: rows.length,
    active_count: rows.filter((r: any) => r.status === "active" || r.status === "pending").length,
    outstanding_total: rows.reduce((s: number, r: any) => s + Number(r.outstanding_amount ?? 0), 0),
    defaulted_count: rows.filter((r: any) => r.status === "defaulted").length,
    paid_off_count: rows.filter((r: any) => r.status === "paid_off").length,
  };
}

export async function updateAdminBnpl(
  id: string,
  updates: { status?: BnplStatus; outstanding_amount?: number; external_ref?: string | null; provider?: string }
) {
  const { error } = await supabase.from("bnpl_obligations").update(updates).eq("id", id);
  if (error) throw error;
}

export async function fetchBnplPayments(obligationId: string): Promise<BnplPaymentRow[]> {
  const { data, error } = await supabase
    .from("bnpl_payments")
    .select("*")
    .eq("obligation_id", obligationId)
    .order("paid_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BnplPaymentRow[];
}

export async function recordBnplPayment(
  obligationId: string,
  payment: { amount: number; method?: string; external_ref?: string | null; notes?: string | null }
) {
  const user = (await supabase.auth.getUser()).data.user;
  const { error } = await supabase.from("bnpl_payments").insert({
    obligation_id: obligationId,
    amount: payment.amount,
    method: payment.method ?? "manual",
    external_ref: payment.external_ref ?? null,
    notes: payment.notes ?? null,
    recorded_by: user?.id ?? null,
  });
  if (error) throw error;
}

export async function deleteBnplPayment(paymentId: string) {
  const { error } = await supabase.from("bnpl_payments").delete().eq("id", paymentId);
  if (error) throw error;
}

export interface AdminBnplInstallment {
  id: string;
  obligation_id: string;
  seq: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: string;
  paid_at: string | null;
  last_reminded_at: string | null;
}

export async function fetchAdminBnplInstallments(obligationId: string): Promise<AdminBnplInstallment[]> {
  const { data, error } = await supabase
    .from("bnpl_installments")
    .select("*")
    .eq("obligation_id", obligationId)
    .order("seq", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AdminBnplInstallment[];
}

export async function regenerateBnplInstallments(obligationId: string) {
  // Wipe existing rows then call generator via a no-op update to trigger regeneration.
  const del = await supabase.from("bnpl_installments").delete().eq("obligation_id", obligationId);
  if (del.error) throw del.error;
  // Re-run generation by toggling updated_at; the trigger only fires on insert.
  // Use RPC fallback: call the PostgREST function via a direct rpc call.
  const { error } = await supabase.rpc("generate_bnpl_installments" as any, { _obligation_id: obligationId });
  if (error) throw error;
}

export async function runProcessBnplOverdue(): Promise<{ processed?: number } & Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke("process-bnpl-overdue", { body: {} });
  if (error) throw error;
  return (data ?? {}) as any;
}

export interface BnplProcessorRun {
  id: string;
  triggered_by: string | null;
  trigger_source: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  installments_marked_due: number;
  installments_marked_missed: number;
  obligations_defaulted: number;
  reminders_sent: number;
  error_message: string | null;
}

export async function fetchBnplProcessorRuns(limit = 25): Promise<BnplProcessorRun[]> {
  const { data, error } = await supabase
    .from("bnpl_processor_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BnplProcessorRun[];
}

// ============ Wallet & Reserve ============

export interface ReserveKpis {
  reserveBalance: number;
  activeOutstanding: number;
  expiringSoon: number;
  lifetimeExpired: number;
  lifetimeReserveIn: number;
  lifetimeHelpNow: number;
  lifetimeAdmin: number;
}

export async function fetchReserveKpis(): Promise<ReserveKpis> {
  const soon = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const [reserve, accruals, ledger] = await Promise.all([
    supabase.from("community_reserve").select("balance").limit(1).maybeSingle(),
    supabase.from("direct_pay_accruals").select("remaining_amount, expires_at").eq("expired", false),
    supabase.from("dp_expiry_ledger").select("expired_amount, community_reserve_portion, help_now_portion, admin_portion"),
  ]);
  const activeOutstanding = (accruals.data ?? []).reduce((s: number, a: any) => s + Number(a.remaining_amount ?? 0), 0);
  const expiringSoon = (accruals.data ?? [])
    .filter((a: any) => a.expires_at && a.expires_at <= soon)
    .reduce((s: number, a: any) => s + Number(a.remaining_amount ?? 0), 0);
  const lifetimeExpired = (ledger.data ?? []).reduce((s: number, l: any) => s + Number(l.expired_amount ?? 0), 0);
  const lifetimeReserveIn = (ledger.data ?? []).reduce((s: number, l: any) => s + Number(l.community_reserve_portion ?? 0), 0);
  const lifetimeHelpNow = (ledger.data ?? []).reduce((s: number, l: any) => s + Number(l.help_now_portion ?? 0), 0);
  const lifetimeAdmin = (ledger.data ?? []).reduce((s: number, l: any) => s + Number(l.admin_portion ?? 0), 0);
  return {
    reserveBalance: Number((reserve.data as any)?.balance ?? 0),
    activeOutstanding,
    expiringSoon,
    lifetimeExpired,
    lifetimeReserveIn,
    lifetimeHelpNow,
    lifetimeAdmin,
  };
}

export interface AdminAccrualRow {
  id: string;
  user_id: string;
  membership_id: string | null;
  amount: number;
  remaining_amount: number;
  accrual_month: string;
  expires_at: string | null;
  expired: boolean;
  expired_at: string | null;
  created_at: string;
  user_full_name: string | null;
}

export async function fetchAdminAccruals(filter: "all" | "active" | "expired" = "active"): Promise<AdminAccrualRow[]> {
  let q = supabase.from("direct_pay_accruals").select("*").order("created_at", { ascending: false }).limit(100);
  if (filter === "active") q = q.eq("expired", false);
  if (filter === "expired") q = q.eq("expired", true);
  const { data, error } = await q;
  if (error) throw error;
  const userIds = Array.from(new Set((data ?? []).map((a: any) => a.user_id).filter(Boolean)));
  const profileMap: Record<string, string | null> = {};
  if (userIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
    (profs ?? []).forEach((p: any) => { profileMap[p.user_id] = p.full_name; });
  }
  return (data ?? []).map((a: any) => ({
    id: a.id,
    user_id: a.user_id,
    membership_id: a.membership_id,
    amount: Number(a.amount ?? 0),
    remaining_amount: Number(a.remaining_amount ?? 0),
    accrual_month: a.accrual_month,
    expires_at: a.expires_at,
    expired: a.expired,
    expired_at: a.expired_at,
    created_at: a.created_at,
    user_full_name: profileMap[a.user_id] ?? null,
  }));
}

export interface AdminDpLedgerRow {
  id: string;
  accrual_id: string;
  expired_amount: number;
  community_reserve_portion: number;
  help_now_portion: number;
  admin_portion: number;
  reason: string;
  created_at: string;
  help_now_case_id: string | null;
}

export async function fetchAdminDpExpiryLedger(): Promise<AdminDpLedgerRow[]> {
  const { data, error } = await supabase
    .from("dp_expiry_ledger")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((l: any) => ({
    id: l.id,
    accrual_id: l.accrual_id,
    expired_amount: Number(l.expired_amount ?? 0),
    community_reserve_portion: Number(l.community_reserve_portion ?? 0),
    help_now_portion: Number(l.help_now_portion ?? 0),
    admin_portion: Number(l.admin_portion ?? 0),
    reason: l.reason,
    created_at: l.created_at,
    help_now_case_id: l.help_now_case_id,
  }));
}

export async function runDpExpiryJob(): Promise<{ processed: number; reserve_added: number }> {
  const { data, error } = await supabase.functions.invoke("process-dp-expiry", { body: {} });
  if (error) throw error;
  return data as { processed: number; reserve_added: number };
}
