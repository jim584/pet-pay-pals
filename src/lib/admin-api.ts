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
