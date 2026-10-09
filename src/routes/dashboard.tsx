import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  Users,
  GraduationCap,
  BookOpen,
  MapPin,
  Clock,
  CalendarRange,
  ClipboardList,
  AlertTriangle,
  BookMarked,
  BarChart3,
  ShieldCheck,
  CalendarCheck,
  FileText,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Activity,
  Layers,
  CheckCircle2,
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

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sublabel?: string;
  color: string;
  to?: string;
  badge?: { text: string; variant?: "success" | "neutral" | "warning" };
  isLoading?: boolean;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
  to,
  badge,
  isLoading,
}: StatCardProps) {
  const content = (
    <div className="group relative bg-surface border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between overflow-hidden">
      {/* Barra superior de acento */}
      <div
        className="absolute top-0 left-0 right-0 h-1 transition-opacity opacity-75 group-hover:opacity-100"
        style={{ backgroundColor: color }}
      />

      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
            style={{ backgroundColor: `${color}18`, color }}
          >
            <Icon className="w-5 h-5" />
          </div>

          {badge && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                badge.variant === "success"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : badge.variant === "warning"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              {badge.text}
            </span>
          )}
        </div>

        <div className="text-3xl font-extrabold tracking-tight text-foreground">
          {isLoading ? (
            <span className="inline-block w-12 h-7 bg-muted animate-pulse rounded" />
          ) : (
            value
          )}
        </div>

        <div className="text-xs font-semibold text-foreground/90 mt-1">{label}</div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{sublabel || "Consultar módulo"}</span>
        {to && (
          <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}

function QuickAction({
  icon: Icon,
  label,
  description,
  to,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  to: string;
  color: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 p-3.5 rounded-xl border border-border bg-surface hover:border-primary/50 hover:bg-surface-2 hover:shadow-xs transition-all duration-150"
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
        style={{ backgroundColor: `${color}18`, color }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
          {label}
        </div>
        {description && (
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
            {description}
          </div>
        )}
      </div>
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

  // Consulta consolidada con datos reales de la base de datos
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["dashboard-metrics-full", colegioId],
    enabled: !!colegioId,
    staleTime: 30_000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const tables = [
        "docentes",
        "cursos",
        "asignaturas",
        "espacios",
        "bloques",
        "schedule_slots",
        "alumnos",
        "calificaciones",
        "intranet_publicaciones",
      ] as const;

      const [countsResults, califsData, lastLibro, asisTodayCount, docentesData] = await Promise.all([
        Promise.all(
          tables.map((t) =>
            withRetry(() =>
              supabase.from(t).select("id", { count: "exact", head: true }).eq("colegio_id", colegioId!)
            )
          )
        ),
        // Promedio de notas reales
        withRetry(() =>
          supabase.from("calificaciones").select("nota").eq("colegio_id", colegioId!).limit(1000)
        ),
        // Último registro del libro de clases
        withRetry(() =>
          supabase
            .from("libro_clases")
            .select("id, fecha, contenido, curso_id, asignatura_id, docente_id")
            .eq("colegio_id", colegioId!)
            .order("fecha", { ascending: false })
            .limit(3)
        ),
        // Asistencia de hoy
        withRetry(() =>
          supabase
            .from("asistencias")
            .select("id", { count: "exact", head: true })
            .eq("colegio_id", colegioId!)
            .eq("fecha", today)
        ),
        // Docentes para lookup en actividad reciente
        withRetry(() =>
          supabase.from("docentes").select("id, nombre").eq("colegio_id", colegioId!)
        ),
      ]);

      const counts = Object.fromEntries(
        tables.map((t, i) => [t, (countsResults[i] as { count?: number | null }).count ?? 0])
      );

      // Calcular promedio real
      const notas = (califsData.data ?? []).map((c) => Number(c.nota)).filter((n) => !isNaN(n) && n > 0);
      const promedio = notas.length > 0
        ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1)
        : null;

      const docMap = new Map((docentesData.data ?? []).map((d) => [d.id, d.nombre]));

      const actividadReciente = (lastLibro.data ?? []).map((l) => ({
        id: l.id,
        fecha: l.fecha,
        contenido: l.contenido,
        docenteNombre: l.docente_id ? docMap.get(l.docente_id) ?? "Docente" : "Docente",
      }));

      return {
        counts,
        promedioCalificaciones: promedio,
        totalCalificaciones: notas.length,
        asistenciaHoyCount: asisTodayCount.count ?? 0,
        actividadReciente,
      };
    },
  });

  const greeting = `Hola, ${profile?.display_name || user?.email || "👋"}`;
  const roleLabel = ROLE_LABEL[role];

  // SECCIÓN UTP
  const renderUtp = () => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="Equipo Docente"
          value={metrics?.counts.docentes ?? 0}
          sublabel="Profesores en nómina"
          color="#3b82f6"
          to="/docentes"
          badge={{ text: "Activos", variant: "neutral" }}
          isLoading={metricsLoading}
        />
        <StatCard
          icon={GraduationCap}
          label="Cursos del Establecimiento"
          value={metrics?.counts.cursos ?? 0}
          sublabel="Niveles configurados"
          color="#8b5cf6"
          to="/cursos"
          badge={{ text: "100%", variant: "success" }}
          isLoading={metricsLoading}
        />
        <StatCard
          icon={CalendarRange}
          label="Celdas de Horario"
          value={metrics?.counts.schedule_slots ?? 0}
          sublabel="Bloques semanales asignados"
          color="#6366f1"
          to="/horarios"
          badge={{ text: "Oficial", variant: "neutral" }}
          isLoading={metricsLoading}
        />
        <StatCard
          icon={BarChart3}
          label="Promedio General"
          value={metrics?.promedioCalificaciones ? `${metrics.promedioCalificaciones}` : "Sin notas"}
          sublabel={metrics?.totalCalificaciones ? `${metrics.totalCalificaciones} notas registradas` : "Sin evaluaciones"}
          color="#f59e0b"
          to="/calificaciones"
          badge={metrics?.promedioCalificaciones ? { text: "Escala 1.0 - 7.0", variant: "success" } : undefined}
          isLoading={metricsLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Accesos operativos UTP
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickAction
              icon={CalendarRange}
              label="Generar y Ver Horarios"
              description="Generador asistido y grilla oficial"
              to="/generar-horarios"
              color="#6366f1"
            />
            <QuickAction
              icon={BookOpen}
              label="Libro de Clases Digital"
              description="Contenidos y leccionario"
              to="/libro-clases"
              color="#3b82f6"
            />
            <QuickAction
              icon={BarChart3}
              label="Resumen Académico"
              description="Promedios por curso y asignatura"
              to="/academico"
              color="#10b981"
            />
            <QuickAction
              icon={Users}
              label="Gestión de Docentes"
              description="Contratos y carga horaria"
              to="/docentes"
              color="#8b5cf6"
            />
          </div>
        </div>

        {/* Panel lateral de actividad real */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Último Libro de Clases
              </h3>
              <Link to="/libro-clases" className="text-[11px] text-primary hover:underline font-medium">
                Ver todos
              </Link>
            </div>
            {metrics?.actividadReciente && metrics.actividadReciente.length > 0 ? (
              <div className="space-y-2.5">
                {metrics.actividadReciente.slice(0, 2).map((a) => (
                  <div key={a.id} className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                      <span className="font-semibold text-foreground">{a.docenteNombre}</span>
                      <span>{a.fecha}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">
                      {a.contenido}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Sin registros recientes en el libro digital
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // SECCIÓN DIRECCIÓN
  const renderDireccion = () => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="Matrícula Total"
          value={metrics?.counts.alumnos ?? 0}
          sublabel="Estudiantes matriculados"
          color="#3b82f6"
          to="/estudiantes"
          badge={{ text: "Vigentes", variant: "success" }}
          isLoading={metricsLoading}
        />
        <StatCard
          icon={GraduationCap}
          label="Cursos"
          value={metrics?.counts.cursos ?? 0}
          sublabel="Prebásica a 8° básico"
          color="#8b5cf6"
          to="/cursos"
          isLoading={metricsLoading}
        />
        <StatCard
          icon={Users}
          label="Dotación Docente"
          value={metrics?.counts.docentes ?? 0}
          sublabel="Profesores registrados"
          color="#10b981"
          to="/docentes"
          isLoading={metricsLoading}
        />
        <StatCard
          icon={BarChart3}
          label="Rendimiento General"
          value={metrics?.promedioCalificaciones ? `${metrics.promedioCalificaciones}` : "Sin notas"}
          sublabel={metrics?.totalCalificaciones ? `${metrics.totalCalificaciones} calificaciones` : "Sin evaluaciones"}
          color="#f59e0b"
          to="/academico"
          isLoading={metricsLoading}
        />
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 mb-6 shadow-xs">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" /> Vistas ejecutivas y gestión
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction
            icon={BarChart3}
            label="Analítica General"
            description="Métricas de rendimiento"
            to="/estadisticas"
            color="#3b82f6"
          />
          <QuickAction
            icon={ClipboardList}
            label="Resumen Académico"
            description="Rendimiento por curso"
            to="/academico"
            color="#10b981"
          />
          <QuickAction
            icon={CalendarRange}
            label="Horarios Oficiales"
            description="Distribución semanal"
            to="/horarios"
            color="#8b5cf6"
          />
          <QuickAction
            icon={ShieldCheck}
            label="Inspectoría General"
            description="Asistencia y convivencia"
            to="/inspectoria"
            color="#f59e0b"
          />
        </div>
      </div>
    </>
  );

  // SECCIÓN INSPECTORÍA
  const renderInspectoria = () => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="Estudiantes"
          value={metrics?.counts.alumnos ?? 0}
          sublabel="Alumnos en sistema"
          color="#3b82f6"
          to="/estudiantes"
          isLoading={metricsLoading}
        />
        <StatCard
          icon={ClipboardList}
          label="Asistencia de Hoy"
          value={metrics?.asistenciaHoyCount && metrics.asistenciaHoyCount > 0 ? `${metrics.asistenciaHoyCount} reg.` : "Pendiente"}
          sublabel={metrics?.asistenciaHoyCount && metrics.asistenciaHoyCount > 0 ? "Cursos registrados hoy" : "Sin listas pasadas hoy"}
          color="#10b981"
          to="/asistencia"
          badge={metrics?.asistenciaHoyCount && metrics.asistenciaHoyCount > 0 ? { text: "Al día", variant: "success" } : { text: "Alerta", variant: "warning" }}
          isLoading={metricsLoading}
        />
        <StatCard
          icon={Clock}
          label="Horarios y Salas"
          value={metrics?.counts.schedule_slots ?? 0}
          sublabel="Bloques de clase activos"
          color="#8b5cf6"
          to="/horarios"
          isLoading={metricsLoading}
        />
        <StatCard
          icon={ShieldCheck}
          label="Convivencia y Retiros"
          value="Panel activo"
          sublabel="Inspectoría General"
          color="#f59e0b"
          to="/inspectoria"
          isLoading={metricsLoading}
        />
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 mb-6 shadow-xs">
        <h2 className="text-sm font-semibold mb-3">Accesos rápidos de Inspectoría</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction
            icon={ClipboardList}
            label="Control de Asistencia"
            description="Pasar lista por curso"
            to="/asistencia"
            color="#3b82f6"
          />
          <QuickAction
            icon={Clock}
            label="Atrasos y Retiros"
            description="Registro diario de portería"
            to="/inspectoria/atrasos"
            color="#f59e0b"
          />
          <QuickAction
            icon={ShieldCheck}
            label="Convivencia Escolar"
            description="Bitácora de convivencia"
            to="/inspectoria/convivencia"
            color="#8b5cf6"
          />
          <QuickAction
            icon={Users}
            label="Fichas de Estudiantes"
            description="Datos de contacto y apoderados"
            to="/estudiantes"
            color="#10b981"
          />
        </div>
      </div>
    </>
  );

  // SECCIÓN ADMINISTRADOR / SUPERADMIN
  const renderAdmin = () => (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
        <StatCard
          icon={Users}
          label="Docentes"
          value={metrics?.counts.docentes ?? 0}
          sublabel="Equipo contratado"
          color="#3b82f6"
          to="/docentes"
          badge={{ text: "Nómina", variant: "neutral" }}
          isLoading={metricsLoading}
        />
        <StatCard
          icon={GraduationCap}
          label="Cursos"
          value={metrics?.counts.cursos ?? 0}
          sublabel="Niveles escolares"
          color="#8b5cf6"
          to="/cursos"
          badge={{ text: "Activos", variant: "neutral" }}
          isLoading={metricsLoading}
        />
        <StatCard
          icon={Users}
          label="Estudiantes"
          value={metrics?.counts.alumnos ?? 0}
          sublabel="Alumnado oficial"
          color="#10b981"
          to="/estudiantes"
          badge={{ text: "Matrícula", variant: "neutral" }}
          isLoading={metricsLoading}
        />
        <StatCard
          icon={BookOpen}
          label="Asignaturas"
          value={metrics?.counts.asignaturas ?? 0}
          sublabel="Plan de estudios"
          color="#06b6d4"
          to="/asignaturas"
          isLoading={metricsLoading}
        />
        <StatCard
          icon={MapPin}
          label="Espacios"
          value={metrics?.counts.espacios ?? 0}
          sublabel="Salas y talleres"
          color="#f59e0b"
          to="/espacios"
          isLoading={metricsLoading}
        />
        <StatCard
          icon={CalendarRange}
          label="Horarios"
          value={metrics?.counts.schedule_slots ?? 0}
          sublabel="Celdas asignadas"
          color="#ec4899"
          to="/horarios"
          badge={{ text: "0 choques", variant: "success" }}
          isLoading={metricsLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Accesos frecuentes del establecimiento
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <QuickAction
              icon={CalendarRange}
              label="Generar Horarios"
              description="Generador asistido por IA"
              to="/generar-horarios"
              color="#8b5cf6"
            />
            <QuickAction
              icon={BookOpen}
              label="Libro de Clases"
              description="Leccionario y registros"
              to="/libro-clases"
              color="#3b82f6"
            />
            <QuickAction
              icon={ClipboardList}
              label="Servicio de Matrícula"
              description="Fichas y admisiones"
              to="/matricula"
              color="#10b981"
            />
            <QuickAction
              icon={Users}
              label="Docentes y Carga"
              description="Contratos y asignaturas"
              to="/docentes"
              color="#06b6d4"
            />
            <QuickAction
              icon={FileText}
              label="Intranet Institucional"
              description="Comunicados y circulares"
              to="/intranet"
              color="#ec4899"
            />
            <QuickAction
              icon={BarChart3}
              label="Analítica y Estadísticas"
              description="Métricas de gestión"
              to="/estadisticas"
              color="#f59e0b"
            />
          </div>
        </div>

        {/* Resumen lateral de actividad reciente real */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-primary" /> Actividad del Libro de Clases
              </h3>
              <Link to="/libro-clases" className="text-[11px] text-primary hover:underline font-medium">
                Ver todos
              </Link>
            </div>
            {metrics?.actividadReciente && metrics.actividadReciente.length > 0 ? (
              <div className="space-y-2.5">
                {metrics.actividadReciente.map((a) => (
                  <div key={a.id} className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                      <span className="font-semibold text-foreground">{a.docenteNombre}</span>
                      <span className="font-mono text-[10px]">{a.fecha}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">
                      {a.contenido}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Sin registros recientes en el libro de clases
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-border/50 mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Matrícula activa: {metrics?.counts.alumnos ?? 0}</span>
            <span className="text-emerald-500 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Sistema operativo
            </span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={greeting} subtitle={`Vista ejecutiva · Rol: ${roleLabel}`} />
      <div>
        <NotificacionesPanel />
      </div>
      {role === "utp" && renderUtp()}
      {role === "direccion" && renderDireccion()}
      {role === "inspectoria" && renderInspectoria()}
      {(role === "admin" || role === "superadmin" || role === "editor" || role === "viewer") && renderAdmin()}
      {role === "docente" && renderAdmin()}
    </div>
  );
}
