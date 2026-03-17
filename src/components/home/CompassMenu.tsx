import {
  Heart,
  Infinity,
  Skull,
  ShieldOff,
  Sparkles,
  Shield,
  Dog,
  Stethoscope,
} from "lucide-react";
import { Link } from "react-router-dom";

const menuItems = [
  { label: "Help A Pet Now™", icon: Heart, direction: "N", to: "/", color: "text-destructive" },
  { label: "Help A Pet Forever™", icon: Infinity, direction: "S", to: "/help-forever", color: "text-primary" },
  { label: "Four Feet Under™", icon: Skull, direction: "E", to: "/four-feet-under", color: "text-muted-foreground" },
  { label: "FearFreed™", icon: ShieldOff, direction: "W", to: "/fearfreed", color: "text-accent" },
  { label: "Help A Pet Overcome™", icon: Sparkles, direction: "NE", to: "/help-overcome", color: "text-primary" },
  { label: "Help A Pet Protect™", icon: Shield, direction: "NW", to: "/help-protect", color: "text-accent" },
  { label: "Help A Pet Behave™", icon: Dog, direction: "SE", to: "/help-behave", color: "text-primary" },
  { label: "Vetted™", icon: Stethoscope, direction: "SW", to: "/vetted", color: "text-accent" },
];

export function CompassMenu() {
  return (
    <nav className="flex flex-col gap-1 py-4">
      <h2 className="px-4 mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Explore
      </h2>
      {menuItems.map((item) => (
        <Link
          key={item.direction}
          to={item.to}
          className="group flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors hover:bg-accent/10"
        >
          <span className={`flex items-center justify-center w-8 h-8 rounded-full bg-muted group-hover:bg-accent/20 transition-colors`}>
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-tight">
              {item.label}
            </span>
            <span className="text-[10px] text-muted-foreground">{item.direction}</span>
          </div>
        </Link>
      ))}
    </nav>
  );
}
