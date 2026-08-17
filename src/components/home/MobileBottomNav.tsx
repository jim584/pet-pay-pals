import { Link, useLocation } from "react-router-dom";
import { Heart, Infinity, FileSearch, Stethoscope, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Now", icon: Heart, to: "/" },
  { label: "Forever", icon: Infinity, to: "/help-forever" },
  { label: "Furensic", icon: FileSearch, to: "/furensic-files" },
  { label: "Vetted", icon: Stethoscope, to: "/vetted" },
  { label: "Profile", icon: User, to: "/dashboard/profile", authOnly: true, guestTo: "/auth" },
];

export function MobileBottomNav() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex items-center justify-around h-14 px-2">
        {navItems.map((item) => {
          const href = item.authOnly && !user ? (item.guestTo ?? "/auth") : item.to;
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);

          return (
            <Link
              key={item.label}
              to={href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-all duration-200 active:scale-90",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 transition-transform duration-200",
                  isActive && "scale-110"
                )}
              />
              <span
                className={cn(
                  "text-[10px] leading-none transition-all duration-200",
                  isActive ? "font-semibold" : "font-medium"
                )}
              >
                {item.label}
              </span>
              <div
                className={cn(
                  "w-1 h-1 rounded-full bg-primary transition-all duration-200",
                  isActive ? "opacity-100 scale-100" : "opacity-0 scale-0"
                )}
              />
            </Link>
          );
        })}
      </div>
      {/* Safe area padding for notched devices */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
