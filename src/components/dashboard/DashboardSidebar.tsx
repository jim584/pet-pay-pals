import { LayoutDashboard, LogOut, Users, Wallet, Stethoscope, Briefcase, Calendar, UserCog, Home, PawPrint, Shield, ShieldCheck } from "lucide-react";
import logoDark from "@/assets/logo-dark.png";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

const ownerNav = [
  { title: "Home", url: "/", icon: Home },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Pets", url: "/dashboard/pets", icon: PawPrint },
  { title: "Community", url: "/dashboard/community", icon: Users },
  { title: "Plans", url: "/plans", icon: Shield },
  { title: "Wallet", url: "/dashboard/wallet", icon: Wallet },
  { title: "Profile", url: "/dashboard/profile", icon: UserCog },
];

const vetNav = [
  { title: "Home", url: "/", icon: Home },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Profile", url: "/dashboard/vet-profile", icon: Stethoscope },
  { title: "Services", url: "/dashboard/vet-services", icon: Briefcase },
  { title: "Community", url: "/dashboard/community", icon: Users },
  { title: "Wallet", url: "/dashboard/wallet", icon: Wallet },
  { title: "Profile", url: "/dashboard/profile", icon: UserCog },
];

export function DashboardSidebar() {
  const { signOut, user, role } = useAuth();
  const baseNav = role === "vet" ? vetNav : ownerNav;
  const navItems = role === "admin"
    ? [...baseNav, { title: "Admin", url: "/admin", icon: ShieldCheck }]
    : baseNav;

  const { data: profile } = useQuery({
    queryKey: ["sidebarProfile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, full_name")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="bg-white rounded-xl p-2 inline-flex items-center justify-center">
            <img src={logoDark} alt="Help A Pet" className="object-contain group-hover:scale-105 transition-transform" style={{ width: 80, height: 112 }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-sidebar-foreground/60 capitalize truncate">
              {role?.replace("_", " ")}
            </p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto p-4 border-t border-sidebar-border">
        <Link to="/dashboard/profile" className="flex items-center gap-2.5 mb-3 group">
          <Avatar className="h-8 w-8 ring-2 ring-sidebar-border group-hover:ring-primary/40 transition-all">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">{profile?.full_name?.[0]?.toUpperCase() || "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || "User"}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </div>
    </Sidebar>
  );
}
