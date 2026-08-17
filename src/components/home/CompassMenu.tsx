import { Heart, Infinity, FileSearch, Stethoscope, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const secondaryItems = [
  { label: "Help A Pet Forever™", icon: Infinity, to: "/help-forever", color: "text-primary" },
  { label: "Furensic Files™", icon: FileSearch, to: "/four-feet-under", color: "text-muted-foreground" },
  { label: "Vetted™", icon: Stethoscope, to: "/vetted", color: "text-accent" },
];

export function CompassMenu() {
  const { pathname } = useLocation();

  return (
    <nav className="flex flex-col gap-1 py-4">
      <h2 className="px-4 mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Explore
      </h2>

      {/* Primary launch focus */}
      <Link
        to="/"
        className={cn(
          "group mx-2 mb-2 flex items-start gap-3 rounded-xl border p-3 transition-colors",
          pathname === "/"
            ? "border-primary/40 bg-primary/10"
            : "border-border hover:bg-accent/10"
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <Heart className="h-5 w-5 text-destructive" />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-tight text-foreground">
            Help A Pet Now™
          </span>
          <span className="text-[11px] leading-snug text-muted-foreground">
            The community feed — urgent cases, updates and support
          </span>
        </div>
      </Link>

      {secondaryItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={cn(
            "group flex items-center gap-3 rounded-lg px-4 py-2.5 transition-colors hover:bg-accent/10",
            pathname.startsWith(item.to) && "bg-accent/10"
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-accent/20">
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </span>
          <span className="text-sm font-medium leading-tight text-foreground transition-colors group-hover:text-primary">
            {item.label}
          </span>
        </Link>
      ))}

      {/* Membership callout */}
      <Link
        to="/together"
        className="mx-2 mt-4 flex items-center gap-3 rounded-lg border border-dashed border-primary/30 px-3 py-3 transition-colors hover:bg-primary/5"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Users className="h-4 w-4 text-primary" />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">Help A Pet Together™</span>
          <span className="text-[11px] text-muted-foreground">Membership — learn more</span>
        </div>
      </Link>
    </nav>
  );
}
