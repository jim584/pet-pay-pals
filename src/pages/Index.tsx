import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PawPrint, LogOut } from "lucide-react";

export default function Index() {
  const { user, role, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!role) return <Navigate to="/select-role" replace />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="text-center space-y-6 max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <PawPrint className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to PetCare</h1>
        <p className="text-muted-foreground">
          You're signed in as <span className="font-semibold text-foreground">{user.email}</span>
          {" "}with role <span className="font-semibold text-primary capitalize">{role.replace("_", " ")}</span>.
        </p>
        <p className="text-sm text-muted-foreground">
          Dashboards are coming in Phase 2. Stay tuned! 🚀
        </p>
        <Button variant="outline" onClick={signOut} className="gap-2">
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>
    </div>
  );
}
