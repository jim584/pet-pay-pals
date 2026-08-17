import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ShieldCheck, Stethoscope, User, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { fetchAdminUsers, adminAssignRole, adminRemoveRole, type AdminUserRow, type AppRole } from "@/lib/admin-api";
import { useAuth } from "@/contexts/AuthContext";

const ROLE_META: Record<AppRole, { label: string; icon: any; variant: any }> = {
  admin: { label: "Admin", icon: ShieldCheck, variant: "default" },
  vet: { label: "Vet", icon: Stethoscope, variant: "secondary" },
  pet_owner: { label: "Pet owner", icon: User, variant: "outline" },
  content_editor: { label: "Content editor", icon: FileSearch, variant: "secondary" },
};

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async (q = "") => {
    setLoading(true);
    try {
      setUsers(await fetchAdminUsers(q));
    } catch (e: any) {
      toast({ title: "Failed to load users", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search);
  };

  const toggleRole = async (u: AdminUserRow, role: AppRole) => {
    setBusyId(u.user_id);
    const has = u.roles.includes(role);
    try {
      if (has) await adminRemoveRole(u.user_id, role);
      else await adminAssignRole(u.user_id, role);
      toast({ title: has ? `Removed ${role}` : `Assigned ${role}` });
      await load(search);
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Users & roles</h1>
        <p className="text-sm text-muted-foreground">Search users and manage their roles.</p>
      </div>

      <form onSubmit={onSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
        {search && (
          <Button type="button" variant="ghost" onClick={() => { setSearch(""); load(""); }}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : users.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No users found.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {users.map((u) => (
            <Card key={u.user_id}>
              <CardContent className="p-4 flex flex-wrap items-center gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={u.avatar_url ?? undefined} />
                  <AvatarFallback>{(u.full_name?.[0] ?? "?").toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.full_name || "Unnamed user"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.user_id.slice(0, 8)}… · joined {new Date(u.created_at).toLocaleDateString()}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {u.roles.length === 0 && <span className="text-xs text-muted-foreground">No role</span>}
                    {u.roles.map((r) => {
                      const meta = ROLE_META[r];
                      const Icon = meta.icon;
                      return (
                        <Badge key={r} variant={meta.variant} className="gap-1">
                          <Icon className="h-3 w-3" /> {meta.label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["pet_owner", "vet", "admin"] as AppRole[]).map((role) => {
                    const has = u.roles.includes(role);
                    const isSelfAdmin = u.user_id === me?.id && role === "admin" && has;
                    return (
                      <Button
                        key={role}
                        size="sm"
                        variant={has ? "destructive" : "outline"}
                        disabled={busyId === u.user_id || isSelfAdmin}
                        onClick={() => toggleRole(u, role)}
                        title={isSelfAdmin ? "Cannot remove your own admin role" : ""}
                      >
                        {busyId === u.user_id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        {has ? "Remove" : "Add"} {ROLE_META[role].label}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
