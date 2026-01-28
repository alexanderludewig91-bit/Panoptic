import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  DollarSign,
  Server,
  Users,
  KeyRound,
  Bell,
  ScrollText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "LLM Kosten", href: "/costs", icon: DollarSign },
  { name: "Infrastruktur", href: "/infrastructure", icon: Server },
  { name: "Benutzer", href: "/users", icon: Users },
  { name: "Secrets", href: "/secrets", icon: KeyRound },
  { name: "Alerts", href: "/alerts", icon: Bell },
  { name: "Audit Log", href: "/audit", icon: ScrollText },
];

const bottomNav = [
  { name: "Einstellungen", href: "/settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <img
          src="/logo.png"
          alt="Panoptic"
          className="h-9 w-9 rounded-lg"
        />
        <span className="text-lg font-semibold tracking-tight">Panoptic</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex flex-col gap-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </NavLink>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-1">
          {bottomNav.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Version */}
      <div className="border-t border-border px-6 py-4">
        <p className="text-xs text-muted-foreground">Panoptic v0.1.0</p>
      </div>
    </aside>
  );
}
