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
