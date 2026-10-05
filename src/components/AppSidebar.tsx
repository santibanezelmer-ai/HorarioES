import { Link, useLocation } from "@tanstack/react-router";
import { CalendarRange, LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useUserRoles } from "@/lib/use-role";
import { MODULES, canAccessModule, isPlatformOnly, primaryRole, ROLE_LABEL } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const location = useLocation();
  const { profile, user, signOut } = useAuth();
  const { data: roles = [], isLoading: rolesLoading } = useUserRoles();

  const name = profile?.display_name || user?.email || "";
  const initial = (name || "?")[0]?.toUpperCase();

  const visibleModules = rolesLoading
    ? []
    : MODULES.filter((m) => canAccessModule(roles, m));

  const role = primaryRole(roles);
  const roleLabel = ROLE_LABEL[role];

  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => {
    if (openIds[id] !== undefined) return openIds[id];
    // Auto-open the module containing the active path.
    const m = visibleModules.find((mm) => mm.id === id);
    if (!m?.items) return false;
    return m.items.some((it) => location.pathname.startsWith(it.to));
  };

  return (
    <aside className="w-[240px] min-w-[240px] bg-sidebar border-r border-sidebar-border flex flex-col h-screen">
      <div className="px-4 pt-5 pb-4 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-gradient-primary flex items-center justify-center text-base shadow-elegant">
            <CalendarRange className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold">HorarioES</div>
            <div className="text-[11px] text-muted-foreground">
              {rolesLoading ? "Cargando…" : roleLabel}
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {visibleModules.map((mod) => {
          const Icon = mod.icon;
          const activeSelf = location.pathname === mod.to;
          const activeChild = mod.items?.some((it) => location.pathname === it.to);
          const opened = isOpen(mod.id);

          if (!mod.items || mod.items.length === 0) {
            return (
              <Link
                key={mod.id}
                to={mod.to}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors",
                  (activeSelf || activeChild)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1">{mod.label}</span>
                {mod.comingSoon && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    Pronto
                  </span>
                )}
              </Link>
            );
          }

          return (
            <div key={mod.id}>
              <button
                onClick={() =>
                  setOpenIds((prev) => ({ ...prev, [mod.id]: !opened }))
                }
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors",
                  activeChild
                    ? "bg-sidebar-accent/40 text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1 text-left">{mod.label}</span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    opened && "rotate-180"
                  )}
                />
              </button>
              {opened && (
                <div className="ml-6 mt-0.5 mb-1 border-l border-sidebar-border pl-2 space-y-0.5">
                  {mod.items.filter((it) => !it.roles || (roles.includes("superadmin") && !isPlatformOnly(roles)) || it.roles.some((r) => roles.includes(r))).map((it) => {
                    const active = location.pathname === it.to;
                    return (
                      <Link
                        key={it.to}
                        to={it.to}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded text-[12.5px] transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-muted-foreground hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <span className="truncate flex-1">{it.label}</span>
                        {it.comingSoon && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
                            Pronto
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 p-2 rounded-md bg-surface-2">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
              {initial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate">{name}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {user?.email}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            title="Salir"
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
