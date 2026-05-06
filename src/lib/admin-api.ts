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

  const [profiles, roles, memberships, tickets, pets, signups, payments] = await Promise.all([
    supabase.from("profiles").select("user_id", { count: "exact", head: true }),
    supabase.from("user_roles").select("role"),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("vet_tickets").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"]),
    supabase.from("pets").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("user_id", { count: "exact", head: true }).gte("created_at", since7d),
    supabase.from("payment_history").select("amount").eq("status", "paid").gte("occurred_at", since30d),
  ]);

  const roleCounts = { pet_owner: 0, vet: 0, admin: 0 };
  (roles.data ?? []).forEach((r: any) => {
    if (r.role in roleCounts) roleCounts[r.role as keyof typeof roleCounts]++;
  });

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
  };
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
    .select("*, profiles:user_id(full_name, avatar_url)")
    .order("created_at", { ascending: false });

  if (filter === "pending") q = q.eq("is_approved", false);
  if (filter === "approved") q = q.eq("is_approved", true);

  const { data, error } = await q;
  if (error) throw error;

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
    owner_full_name: v.profiles?.full_name ?? null,
    owner_avatar_url: v.profiles?.avatar_url ?? null,
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
    .select("*, profiles:user_id(full_name, avatar_url)")
    .eq("id", vetProfileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const v: any = data;
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
    owner_full_name: v.profiles?.full_name ?? null,
    owner_avatar_url: v.profiles?.avatar_url ?? null,
  };
}

export async function setVetApproval(vetProfileId: string, approved: boolean) {
  const { error } = await supabase
    .from("vet_profiles")
    .update({ is_approved: approved })
    .eq("id", vetProfileId);
  if (error) throw error;
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
    .select("*, pets(name, species), profiles:owner_id(full_name), services(name, price)")
    .eq("vet_id", vetProfileId)
    .order("scheduled_at", { ascending: false });
  if (statusFilter && statusFilter !== "all") q = q.eq("status", statusFilter);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((a: any) => ({
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
    owner_full_name: a.profiles?.full_name ?? null,
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
    .select(
      "*, profiles:owner_id(full_name, avatar_url), pets(name), vet_tickets:ticket_id(clinic_name)"
    )
    .order("created_at", { ascending: false });
  if (filter !== "all") q = q.eq("status", filter);

  const { data, error } = await q;
  if (error) throw error;

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
    owner_full_name: b.profiles?.full_name ?? null,
    owner_avatar_url: b.profiles?.avatar_url ?? null,
    pet_name: b.pets?.name ?? null,
    ticket_clinic_name: b.vet_tickets?.clinic_name ?? null,
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
