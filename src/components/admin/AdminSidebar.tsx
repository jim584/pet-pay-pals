import { LayoutDashboard, Users, Stethoscope, FileCheck, Wallet, CreditCard, Shield, LogOut, Home, CalendarClock, Megaphone } from "lucide-react";
import logoDark from "@/assets/logo-dark.png";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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

const adminNav = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard, end: true },
  { title: "Users & Roles", url: "/admin/users", icon: Users },
  { title: "Vets", url: "/admin/vets", icon: Stethoscope },
  { title: "Vet Tickets", url: "/admin/vet-tickets", icon: FileCheck },
  { title: "Memberships", url: "/admin/memberships", icon: Shield },
  { title: "Payments", url: "/admin/payments", icon: CreditCard },
  { title: "Payment Plans", url: "/admin/payment-plans", icon: CalendarClock },
  { title: "Wallet & Reserve", url: "/admin/reserve", icon: Wallet },
  { title: "Referrals", url: "/admin/referrals", icon: Megaphone },
];

export function AdminSidebar() {
  const { signOut, user } = useAuth();

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="bg-white rounded-xl p-2 inline-flex items-center justify-center">
            <img src={logoDark} alt="Help A Pet" className="object-contain" style={{ width: 60, height: 84 }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground">Admin</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">Control center</p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
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
        <SidebarGroup>
          <SidebarGroupLabel>Shortcuts</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/" className="hover:bg-sidebar-accent/50">
                    <Home className="mr-2 h-4 w-4" />
                    <span>Back to site</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/dashboard" className="hover:bg-sidebar-accent/50">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    <span>User dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto p-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/60 truncate mb-2">{user?.email}</p>
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
