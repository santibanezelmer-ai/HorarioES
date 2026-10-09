import { Link, useLocation } from "@tanstack/react-router";
import {
  CalendarRange,
  LogOut,
  ChevronDown,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useUserRoles } from "@/lib/use-role";
import {
  MODULES,
  MENU_GROUPS,
  canAccessModule,
  isPlatformOnly,
  primaryRole,
  ROLE_LABEL,
  type ModuleDef,
} from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppSidebar() {
  const location = useLocation();
  const { profile, user, signOut } = useAuth();
  const { data: roles = [], isLoading: rolesLoading } = useUserRoles();

  // Modo compacto persistido en localStorage para escritorio
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("horarioes-sidebar-collapsed") === "true";
    }
    return false;
  });

  // Drawer para dispositivos móviles
  const [mobileOpen, setMobileOpen] = useState(false);

  // Cerrar drawer móvil al navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("horarioes-sidebar-collapsed", String(next));
      }
      return next;
    });
  };

  const name = profile?.display_name || user?.email || "";
  const initial = (name || "?")[0]?.toUpperCase();

  const visibleModules = rolesLoading
    ? []
    : MODULES.filter((m) => canAccessModule(roles, m));

  const role = primaryRole(roles);
  const roleLabel = ROLE_LABEL[role];

  // Acordeón inteligente para módulos con subítems
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  const isOpen = (id: string) => {
    if (openIds[id] !== undefined) return openIds[id];
    // Auto-expandir el módulo si contiene la ruta activa
    const m = visibleModules.find((mm) => mm.id === id);
    if (!m?.items) return false;
    return m.items.some((it) => location.pathname.startsWith(it.to));
  };

  const handleToggleModule = (id: string) => {
    setOpenIds((prev) => {
      const currentlyOpen = isOpen(id);
      // Al abrir uno, mantenemos una navegación limpia
      return {
        ...prev,
        [id]: !currentlyOpen,
      };
    });
  };

  // Filtrar grupos que tengan módulos visibles
  const populatedGroups = MENU_GROUPS.map((group) => {
    const modulesInGroup = visibleModules.filter((m) => m.group === group.id);
    return {
      ...group,
      modules: modulesInGroup,
    };
  }).filter((g) => g.modules.length > 0);

  const canAccessSettings = roles.some((r) =>
    ["admin", "superadmin", "direccion"].includes(r)
  );

  // Renderizador unificado del contenido de navegación
  const renderNavContent = (collapsed: boolean) => (
    <div className="flex flex-col h-full select-none">
      {/* Encabezado Institucional */}
      <div
        className={cn(
          "h-16 flex items-center border-b border-sidebar-border px-3.5 transition-all duration-200",
          collapsed ? "justify-center px-2" : "justify-between"
        )}
      >
        <Link
          to="/dashboard"
          className="flex items-center gap-2.5 overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg p-1"
          title="HorarioES — Inicio"
        >
          <div className="w-9 h-9 rounded-[10px] bg-gradient-primary flex items-center justify-center text-base shadow-elegant shrink-0 group-hover:scale-105 transition-transform">
            <CalendarRange className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="leading-tight overflow-hidden">
              <div className="text-[15px] font-bold tracking-tight truncate">
                HorarioES
              </div>
              <div className="text-[11px] text-muted-foreground font-medium truncate">
                {rolesLoading ? "Cargando…" : roleLabel}
              </div>
            </div>
          )}
        </Link>

        {/* Botón colapsar (solo visible en escritorio) */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
          className={cn(
            "hidden md:flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors",
            collapsed && "hidden"
          )}
          title="Contraer menú lateral"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Navegación por Grupos */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 scrollbar-thin">
        {populatedGroups.map((group) => (
          <div key={group.id} className="space-y-1">
            {/* Título de Grupo Discreto */}
            {!collapsed && group.id !== "principal" && (
              <div className="px-2 pt-2 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/70 select-none">
                {group.label}
              </div>
            )}
            {collapsed && group.id !== "principal" && (
              <div className="my-2 border-t border-sidebar-border/60 mx-1" />
            )}

            {/* Módulos en el grupo */}
            <div className="space-y-0.5">
              {group.modules.map((mod) => {
                const Icon = mod.icon;
                const activeSelf = location.pathname === mod.to;
                const activeChild = mod.items?.some(
                  (it) => location.pathname === it.to || location.pathname.startsWith(it.to + "/")
                );
                const isCurrentActive = activeSelf || activeChild;
                const opened = isOpen(mod.id);

                // --- MODO COMPACTO (ESCRITORIO) ---
                if (collapsed) {
                  // Módulo con subitems en modo compacto -> Dropdown flotante
                  if (mod.items && mod.items.length > 0) {
                    const accessibleItems = mod.items.filter(
                      (it) =>
                        !it.roles ||
                        (roles.includes("superadmin") && !isPlatformOnly(roles)) ||
                        it.roles.some((r) => roles.includes(r))
                    );

                    return (
                      <DropdownMenu key={mod.id}>
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={mod.label}
                                className={cn(
                                  "w-full h-10 flex items-center justify-center rounded-lg transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                  isCurrentActive
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                                )}
                              >
                                {isCurrentActive && (
                                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary rounded-r" />
                                )}
                                <Icon className="w-4 h-4 shrink-0" />
                              </button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={10}>
                            {mod.label}
                          </TooltipContent>
                        </Tooltip>

                        <DropdownMenuContent
                          side="right"
                          sideOffset={12}
                          align="start"
                          className="w-56 bg-sidebar border border-sidebar-border shadow-xl p-1 z-50 rounded-lg"
                        >
                          <DropdownMenuLabel className="text-xs font-bold text-foreground px-2 py-1.5">
                            {mod.label}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-sidebar-border/60" />
                          {accessibleItems.map((it) => {
                            const isSubActive = location.pathname === it.to;

                            if (it.comingSoon) {
                              return (
                                <DropdownMenuItem
                                  key={it.to}
                                  disabled
                                  className="flex items-center justify-between text-xs text-muted-foreground/50 cursor-not-allowed"
                                >
                                  <span>{it.label}</span>
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                                    Pronto
                                  </span>
                                </DropdownMenuItem>
                              );
                            }

                            return (
                              <DropdownMenuItem key={it.to} asChild>
                                <Link
                                  to={it.to}
                                  className={cn(
                                    "flex items-center justify-between text-xs cursor-pointer rounded-md px-2 py-1.5 font-medium transition-colors",
                                    isSubActive
                                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40"
                                  )}
                                >
                                  <span>{it.label}</span>
                                </Link>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  }

                  // Módulo sin subitems en modo compacto
                  if (mod.comingSoon) {
                    return (
                      <Tooltip key={mod.id} delayDuration={200}>
                        <TooltipTrigger asChild>
                          <div
                            className="w-full h-10 flex items-center justify-center rounded-lg text-muted-foreground/40 cursor-not-allowed select-none"
                            aria-label={`${mod.label} (Pronto)`}
                          >
                            <Icon className="w-4 h-4 shrink-0 opacity-40" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={10}>
                          {mod.label} (Próximamente)
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <Tooltip key={mod.id} delayDuration={200}>
                      <TooltipTrigger asChild>
                        <Link
                          to={mod.to}
                          aria-label={mod.label}
                          className={cn(
                            "w-full h-10 flex items-center justify-center rounded-lg transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            isCurrentActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                          )}
                        >
                          {isCurrentActive && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary rounded-r" />
                          )}
                          <Icon className="w-4 h-4 shrink-0" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={10}>
                        {mod.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                // --- MODO EXPANDIDO (ESTÁNDAR) ---
                if (!mod.items || mod.items.length === 0) {
                  if (mod.comingSoon) {
                    return (
                      <div
                        key={mod.id}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-muted-foreground/50 cursor-not-allowed select-none"
                        title="Módulo en desarrollo (próximamente)"
                      >
                        <Icon className="w-4 h-4 shrink-0 opacity-50" />
                        <span className="truncate flex-1">{mod.label}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground font-semibold">
                          Pronto
                        </span>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={mod.id}
                      to={mod.to}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isCurrentActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      {isCurrentActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary rounded-r" />
                      )}
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate flex-1">{mod.label}</span>
                    </Link>
                  );
                }

                // Módulo desplegable con subítems
                const accessibleSubitems = mod.items.filter(
                  (it) =>
                    !it.roles ||
                    (roles.includes("superadmin") && !isPlatformOnly(roles)) ||
                    it.roles.some((r) => roles.includes(r))
                );

                return (
                  <div key={mod.id} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => handleToggleModule(mod.id)}
                      aria-expanded={opened}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isCurrentActive
                          ? "bg-sidebar-accent/50 text-sidebar-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      {isCurrentActive && !opened && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary rounded-r" />
                      )}
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate flex-1 text-left">{mod.label}</span>
                      <ChevronDown
                        className={cn(
                          "w-3.5 h-3.5 shrink-0 transition-transform duration-200 text-muted-foreground",
                          opened && "rotate-180 text-foreground"
                        )}
                      />
                    </button>

                    {opened && (
                      <div className="ml-6 mt-0.5 mb-1.5 border-l-2 border-sidebar-border/80 pl-2.5 space-y-0.5">
                        {accessibleSubitems.map((it) => {
                          const active =
                            location.pathname === it.to ||
                            location.pathname.startsWith(it.to + "/");

                          if (it.comingSoon) {
                            return (
                              <div
                                key={it.to}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-muted-foreground/45 cursor-not-allowed select-none"
                                title="Próximamente disponible"
                              >
                                <span className="truncate flex-1">{it.label}</span>
                                <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                                  Pronto
                                </span>
                              </div>
                            );
                          }

                          return (
                            <Link
                              key={it.to}
                              to={it.to}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                active
                                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold before:absolute before:-left-[12px] before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-4 before:bg-primary before:rounded-r"
                                  : "text-muted-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/30"
                              )}
                            >
                              <span className="truncate flex-1">{it.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pie de Página: Perfil, Ajustes y Sesión */}
      <div className="border-t border-sidebar-border p-2.5">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <div
                  className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shadow-xs cursor-default"
                  title={name}
                >
                  {initial}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <div className="font-semibold">{name}</div>
                <div className="text-[10px] text-muted-foreground">{roleLabel}</div>
              </TooltipContent>
            </Tooltip>

            {canAccessSettings && (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Link
                    to="/ajustes"
                    aria-label="Ajustes de cuenta y colegio"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  Ajustes
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => signOut()}
                  aria-label="Cerrar sesión"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Cerrar sesión
              </TooltipContent>
            </Tooltip>

            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expandir menú lateral"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors mt-1"
              title="Expandir menú lateral"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-surface-2/60 border border-border/40">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0 shadow-xs">
                {initial}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate leading-tight text-foreground">
                {name}
              </div>
              <div className="text-[10px] text-muted-foreground truncate leading-tight">
                {user?.email}
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {canAccessSettings && (
                <Link
                  to="/ajustes"
                  title="Ajustes de cuenta y colegio"
                  aria-label="Ajustes de cuenta y colegio"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <Settings className="w-3.5 h-3.5" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => signOut()}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      {/* --- BOTÓN TRIGGER MÓVIL (TOP BAR EN MÓVILES) --- */}
      <div className="md:hidden fixed top-3 left-3 z-40">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú de navegación"
          className="p-2 rounded-lg bg-surface-2 border border-sidebar-border shadow-md text-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* --- OVERLAY Y DRAWER MÓVIL --- */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navegación principal"
          className="md:hidden fixed inset-0 z-50 flex"
        >
          {/* Backdrop con desenfoque suave */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Panel móvil */}
          <div className="relative w-[280px] max-w-[85vw] bg-sidebar border-r border-sidebar-border h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
              className="absolute top-4 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
            >
              <X className="w-5 h-5" />
            </button>
            {renderNavContent(false)}
          </div>
        </div>
      )}

      {/* --- ASIDE DE ESCRITORIO --- */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-sidebar border-r border-sidebar-border h-screen transition-[width] duration-200 shrink-0",
          isCollapsed ? "w-[68px] min-w-[68px]" : "w-[248px] min-w-[248px]"
        )}
      >
        {renderNavContent(isCollapsed)}
      </aside>
    </TooltipProvider>
  );
}
