import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Users, GraduationCap, BookOpen, MapPin, Clock, CalendarRange,
  ClipboardList, AlertTriangle, BookMarked, BarChart3, ShieldCheck,
  CalendarCheck, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/db-retry";
import { useAuth } from "@/lib/auth-context";
import { useUserRoles } from "@/lib/use-role";
import { primaryRole, ROLE_LABEL } from "@/lib/roles";
import { PageHeader } from "@/components/PageHeader";
import { NotificacionesPanel } from "@/components/NotificacionesPanel";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — HorarioES" }] }),
  component: Dashboard,
});

function StatCard({
  icon: Icon, label, value, color, to,
}: {
  icon: typeof Users; label: string; value: number | string; color: string; to?: string;
}) {
  const inner = (
    <div className="bg-surface border border-border rounded-xl p-5 hover:border-primary/50 transition-colors h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, color }}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
  if (to) return <Link to={to}>{inner}</Link>;
  return inner;
}

function QuickAction({
  icon: Icon, label, to, color,
}: { icon: typeof Users; label: string; to: string; color: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface hover:border-primary/50 hover:bg-surface-2 transition-colors"
    >
      <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: `${color}20`, color }}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function Dashboard() {
  const { profile, user } = useAuth();
  const colegioId = profile?.colegio_id;
  const navigate = useNavigate();
  const { data: roles = [], isLoading: rolesLoading } = useUserRoles();
  const role = primaryRole(roles);
  const isPlatformOnly = roles.includes("superadmin") && roles.every((r) => r === "superadmin");
  const isDocenteOnly =
    roles.includes("docente") &&
    !roles.some((r) => ["admin", "utp", "editor", "viewer", "direccion", "inspectoria", "superadmin"].includes(r));

  useEffect(() => {
    if (rolesLoading) return;
    if (isPlatformOnly) {
      navigate({ to: "/superadmin", replace: true });
    } else if (isDocenteOnly) {
      navigate({ to: "/mis-clases", replace: true });
    }
  }, [isDocenteOnly, isPlatformOnly, rolesLoading, navigate]);


  const { data: counts, isLoading } = useQuery({
    queryKey: ["dashboard-counts", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const tables = ["docentes", "cursos", "asignaturas", "espacios", "bloques", "schedule_slots", "alumnos"] as const;
      const results = await Promise.all(
        tables.map((t) =>
          withRetry(() =>
            supabase.from(t).select("id", { count: "exact", head: true }).eq("colegio_id", colegioId!)
          )
        )
      );
      return Object.fromEntries(tables.map((t, i) => [t, (results[i] as { count?: number | null }).count ?? 0]));
    },
  });

  const greeting = `Hola, ${profile?.display_name || user?.email || "👋"}`;
  const roleLabel = ROLE_LABEL[role];

  // Variantes por rol
  const renderUtp = () => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={BookMarked} label="Planificaciones" value="—" color="#7c6af7" to="/planificaciones" />
        <StatCard icon={ClipboardList} label="Cobertura curricular" value="—" color="#34d399" to="/academico" />
        <StatCard icon={CalendarCheck} label="Cumplimiento docente" value="—" color="#4f8ef7" to="/estadisticas" />
        <StatCard icon={BarChart3} label="Rendimiento" value="—" color="#fbbf24" to="/academico" />
      </div>
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-3">Accesos rápidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <QuickAction icon={FileText} label="Planificaciones" to="/planificaciones" color="#7c6af7" />
          <QuickAction icon={ClipboardList} label="Resumen académico" to="/academico" color="#34d399" />
          <QuickAction icon={BarChart3} label="Estadísticas" to="/estadisticas" color="#4f8ef7" />
          <QuickAction icon={Users} label="Docentes" to="/docentes" color="#fbbf24" />
        </div>
      </div>
    </>
  );

  const renderDireccion = () => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Estudiantes" value={isLoading ? "…" : counts?.alumnos ?? 0} color="#4f8ef7" />
        <StatCard icon={GraduationCap} label="Cursos" value={isLoading ? "…" : counts?.cursos ?? 0} color="#7c6af7" />
        <StatCard icon={Users} label="Docentes" value={isLoading ? "…" : counts?.docentes ?? 0} color="#34d399" />
        <StatCard icon={BarChart3} label="Indicadores" value="—" color="#fbbf24" to="/estadisticas" />
      </div>
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-3">Vistas ejecutivas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <QuickAction icon={BarChart3} label="Estadísticas" to="/estadisticas" color="#4f8ef7" />
          <QuickAction icon={ClipboardList} label="Académico" to="/academico" color="#34d399" />
          <QuickAction icon={CalendarRange} label="Horarios" to="/horarios" color="#7c6af7" />
          <QuickAction icon={ShieldCheck} label="Inspectoría" to="/inspectoria" color="#fbbf24" />
        </div>
      </div>
    </>
  );

  const renderInspectoria = () => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={ClipboardList} label="Asistencia del día" value="—" color="#4f8ef7" to="/asistencia" />
        <StatCard icon={Clock} label="Atrasos" value="—" color="#fbbf24" />
        <StatCard icon={AlertTriangle} label="Retiros" value="—" color="#f87171" />
        <StatCard icon={ShieldCheck} label="Convivencia" value="—" color="#7c6af7" />
      </div>
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-3">Accesos rápidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <QuickAction icon={ClipboardList} label="Asistencia" to="/asistencia" color="#4f8ef7" />
          <QuickAction icon={Users} label="Estudiantes" to="/estudiantes" color="#34d399" />
        </div>
      </div>
    </>
  );

  const renderAdmin = () => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Users} label="Docentes" value={isLoading ? "…" : counts?.docentes ?? 0} color="#4f8ef7" to="/docentes" />
        <StatCard icon={GraduationCap} label="Cursos" value={isLoading ? "…" : counts?.cursos ?? 0} color="#7c6af7" to="/cursos" />
        <StatCard icon={BookOpen} label="Asignaturas" value={isLoading ? "…" : counts?.asignaturas ?? 0} color="#34d399" to="/asignaturas" />
        <StatCard icon={MapPin} label="Espacios" value={isLoading ? "…" : counts?.espacios ?? 0} color="#fbbf24" to="/espacios" />
        <StatCard icon={Clock} label="Bloques" value={isLoading ? "…" : counts?.bloques ?? 0} color="#f87171" to="/bloques" />
        <StatCard icon={CalendarRange} label="Celdas asignadas" value={isLoading ? "…" : counts?.schedule_slots ?? 0} color="#818cf8" to="/horarios" />
      </div>
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-3">Accesos rápidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <QuickAction icon={Users} label="Docentes" to="/docentes" color="#4f8ef7" />
          <QuickAction icon={CalendarRange} label="Horarios" to="/horarios" color="#7c6af7" />
          <QuickAction icon={ClipboardList} label="Resumen académico" to="/academico" color="#34d399" />
          <QuickAction icon={BarChart3} label="Analítica" to="/estadisticas" color="#fbbf24" />
        </div>
      </div>
    </>
  );

  return (
    <div>
      <PageHeader title={greeting} subtitle={`Vista ${roleLabel}`} />
      <div className="mb-6"><NotificacionesPanel /></div>
      {role === "utp" && renderUtp()}
      {role === "direccion" && renderDireccion()}
      {role === "inspectoria" && renderInspectoria()}
      {(role === "admin" || role === "superadmin" || role === "editor" || role === "viewer") && renderAdmin()}
      {role === "docente" && renderAdmin()}
    </div>
  );
}
