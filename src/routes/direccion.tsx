import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users, ClipboardList, BookOpen, TrendingUp, Sparkles, AlertTriangle, GraduationCap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/direccion")({
  head: () => ({ meta: [{ title: "Dirección — Panel ejecutivo" }] }),
  component: DireccionPanel,
});

function DireccionPanel() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;

  const sinceISO = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["direccion-dashboard", colegioId, sinceISO], enabled: !!colegioId,
    queryFn: async () => {
      const [alumnos, asis, libro, planif, calif, pie, docentes, cursos] = await Promise.all([
        supabase.from("alumnos").select("id,retirado_en").eq("colegio_id", colegioId!),
        supabase.from("asistencias").select("estado,fecha").eq("colegio_id", colegioId!).gte("fecha", sinceISO),
        supabase.from("libro_clases").select("objetivo_logrado,docente_id,fecha,curso_id").eq("colegio_id", colegioId!).gte("fecha", sinceISO),
        supabase.from("planificaciones").select("id,docente_id").eq("colegio_id", colegioId!),
        supabase.from("calificaciones").select("nota").eq("colegio_id", colegioId!).gte("fecha", sinceISO),
        supabase.from("pie_plan").select("id").eq("colegio_id", colegioId!),
        supabase.from("docentes").select("id,nombre").eq("colegio_id", colegioId!),
        supabase.from("cursos").select("id").eq("colegio_id", colegioId!),
      ]);
      return {
        alumnos: alumnos.data ?? [], asis: asis.data ?? [], libro: libro.data ?? [],
        planif: planif.data ?? [], calif: calif.data ?? [], pie: pie.data ?? [],
        docentes: docentes.data ?? [], cursos: cursos.data ?? [],
      };
    },
  });

  const k = useMemo(() => {
    if (!data) return null;
    const matricula = data.alumnos.filter((a) => !a.retirado_en).length;
    const t = data.asis.length, p = data.asis.filter((r) => r.estado === "presente").length;
    const asisPct = t ? Math.round((p / t) * 100) : 0;
    const cob = data.libro.length ? Math.round((data.libro.filter((l) => l.objetivo_logrado).length / data.libro.length) * 100) : 0;
    const docConRegistro = new Set(data.libro.map((l) => l.docente_id).filter(Boolean));
    const cumplDocente = data.docentes.length ? Math.round((docConRegistro.size / data.docentes.length) * 100) : 0;
    const docSinPlan = data.docentes.filter((d) => !data.planif.some((p) => p.docente_id === d.id));
    const prom = data.calif.length ? (data.calif.reduce((s, c) => s + Number(c.nota), 0) / data.calif.length).toFixed(1) : "—";
    return { matricula, asisPct, cob, cumplDocente, docSinPlan, prom, pieN: data.pie.length };
  }, [data]);

  return (
    <div>
      <PageHeader title="Dirección" subtitle="Panel ejecutivo — últimos 30 días" />

      {isLoading || !k ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <Big icon={Users} label="Matrícula activa" value={k.matricula} color="#4f8ef7" />
            <Big icon={ClipboardList} label="Asistencia" value={`${k.asisPct}%`} color="#10b981" />
            <Big icon={BookOpen} label="Cobertura curricular" value={`${k.cob}%`} color="#8b5cf6" />
            <Big icon={GraduationCap} label="Promedio general" value={String(k.prom)} color="#f59e0b" />
            <Big icon={TrendingUp} label="Cumplimiento docente" value={`${k.cumplDocente}%`} color="#06b6d4" />
            <Big icon={Sparkles} label="Plan PIE" value={k.pieN} color="#ec4899" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Alertas institucionales</h3>
              {k.asisPct < 90 && <Alert text={`Asistencia por debajo del 90% (${k.asisPct}%)`} />}
              {k.cob < 70 && <Alert text={`Cobertura curricular baja (${k.cob}%)`} />}
              {k.cumplDocente < 80 && <Alert text={`Cumplimiento docente bajo (${k.cumplDocente}%)`} />}
              {k.docSinPlan.length > 0 && <Alert text={`${k.docSinPlan.length} docente(s) sin planificación registrada`} />}
              {k.asisPct >= 90 && k.cob >= 70 && k.cumplDocente >= 80 && k.docSinPlan.length === 0 && (
                <div className="text-xs text-muted-foreground">Sin alertas críticas en el período.</div>
              )}
            </div>

            <div className="bg-surface border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3">Accesos rápidos</h3>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/academico" className="text-sm p-2 rounded border border-border hover:border-primary/50">Reportes académicos</Link>
                <Link to="/inspectoria" className="text-sm p-2 rounded border border-border hover:border-primary/50">Panel inspectoría</Link>
                <Link to="/curriculum/cobertura" className="text-sm p-2 rounded border border-border hover:border-primary/50">Cobertura curricular</Link>
                <Link to="/estadisticas" className="text-sm p-2 rounded border border-border hover:border-primary/50">Estadísticas</Link>
                <Link to="/docentes" className="text-sm p-2 rounded border border-border hover:border-primary/50">Docentes</Link>
                <Link to="/admin/auditoria" className="text-sm p-2 rounded border border-border hover:border-primary/50">Auditoría</Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Big({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: `${color}20`, color }}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
function Alert({ text }: { text: string }) {
  return <div className="text-xs p-2 mb-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">{text}</div>;
}
