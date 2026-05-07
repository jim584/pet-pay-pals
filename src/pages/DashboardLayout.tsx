import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Button } from "@/components/ui/button";

export default function DashboardLayout() {
  const { user, role, loading, roleLoading } = useAuth();
  const location = useLocation();
  const [slow, setSlow] = useState(false);

  const isLoading = loading || (!!user && roleLoading);

  useEffect(() => {
    if (!isLoading) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="animate-pulse text-muted-foreground">Loading your account…</div>
        {slow && (
          <div className="space-y-3 max-w-sm">
            <p className="text-sm text-muted-foreground">
              This is taking longer than expected. Try reloading or signing in again.
            </p>
            <div className="flex justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Reload</Button>
              <Button size="sm" asChild>
                <a href={`/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`}>Sign in</a>
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?redirect=${redirect}`} replace />;
  }
  if (!role) return <Navigate to="/select-role" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <DashboardSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b px-4 bg-background">
            <SidebarTrigger />
          </header>
          <div className="flex-1 p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
