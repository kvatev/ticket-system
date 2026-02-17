import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Ticket,
  PlusCircle,
  Users,
  Building2,
  BarChart3,
  Shield,
  LogOut,
  Menu,
  X,
  School,
  Inbox,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: Array<"admin" | "staff" | "user" | "maintenance" | "support">;
}

const navItems: NavItem[] = [
  { to: "/", label: "Табло", icon: LayoutDashboard, roles: ["admin", "staff", "user", "maintenance", "support"] },
  { to: "/tickets", label: "Моите заявки", icon: Ticket, roles: ["user"] },
  { to: "/tickets", label: "Заявки", icon: Ticket, roles: ["admin"] },
  { to: "/tickets/assigned", label: "Възложени на мен", icon: Inbox, roles: ["staff", "maintenance", "support"] },
  { to: "/tickets/department", label: "Опашка на отдела", icon: FolderOpen, roles: ["staff", "maintenance", "support"] },
  { to: "/tickets/new", label: "Нова заявка", icon: PlusCircle, roles: ["admin", "staff", "user", "maintenance", "support"] },
  { to: "/admin/users", label: "Потребители", icon: Users, roles: ["admin"] },
  { to: "/admin/departments", label: "Отдели", icon: Building2, roles: ["admin"] },
  { to: "/admin/roles", label: "Роли и права", icon: Shield, roles: ["admin"] },
  { to: "/admin/reports", label: "Отчети", icon: BarChart3, roles: ["admin"] },
];

export default function AppLayout() {
  const { user, profile, role, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [customRoleName, setCustomRoleName] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const fetchRoleName = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("custom_role_id, custom_roles(name)")
        .eq("user_id", user.id)
        .single();
      if (data && (data as any).custom_roles?.name) {
        setCustomRoleName((data as any).custom_roles.name);
      }
    };
    fetchRoleName();
  }, [user]);

  const filteredNav = navItems.filter((item) => role && item.roles.includes(role));

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <School className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">СУ „К. Петканов"</p>
            <p className="text-xs text-sidebar-muted">Система за заявки</p>
          </div>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5 text-sidebar-muted" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {filteredNav.map((item) => (
            <NavLink
              key={item.to + item.label}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">
              {profile?.full_name?.charAt(0) ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {profile?.full_name ?? "..."}
              </p>
              <p className="text-xs text-sidebar-muted">
                {customRoleName || "..."}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Изход
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-sm font-semibold text-foreground">СУ „К. Петканов"</h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
