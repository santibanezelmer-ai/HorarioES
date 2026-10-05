import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, User, GraduationCap, ClipboardList, ShieldCheck, Sparkles,
  TrendingUp, BookOpen, Clock, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/estudiantes/$id")({
  head: () => ({ meta: [{ title: "Ficha del estudiante — HorarioES" }] }),
  component: FichaEstudiante,
});

function FichaEstudiante() {
  const { id } = Route.useParams();
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;

  const { data, isLoading } = useQuery({
    queryKey: ["ficha-estudiante", id, colegioId],
    enabled: !!id && !!colegioId,
    queryFn: async () => {
      const [alumno, asis, califs, asigs, atrasos, retiros, anots, libro] = await Promise.all([
        supabase.from("alumnos").select("*, cursos(id,nombre,nivel)").eq("id", id).maybeSingle(),
        supabase.from("asistencias").select("fecha,estado").eq("alumno_id", id).order("fecha", { ascending: false }).limit(500),
        supabase.from("calificaciones").select("asignatura_id,nota,descripcion,fecha,ponderacion").eq("alumno_id", id).order("fecha", { ascending: false }),
        supabase.from("asignaturas").select("id,nombre,color").eq("colegio_id", colegioId!),
        supabase.from("atrasos").select("fecha,hora,motivo,justificado").eq("alumno_id", id).order("fecha", { ascending: false }).limit(50),
        supabase.from("retiros").select("fecha,hora,motivo,retirado_por").eq("alumno_id", id).order("fecha", { ascending: false }).limit(50),
        supabase.from("anotaciones").select("fecha,tipo,categoria,descripcion").eq("alumno_id", id).order("fecha", { ascending: false }).limit(50),
        supabase.from("libro_clases").select("fecha,contenido,asignatura_id").eq("curso_id",
          (await supabase.from("alumnos").select("curso_id").eq("id", id).maybeSingle()).data?.curso_id ?? "00000000-0000-0000-0000-000000000000"
        ).order("fecha", { ascending: false }).limit(20),
      ]);
      return {
        alumno: alumno.data,
        asis: asis.data ?? [],
        califs: califs.data ?? [],
        asigs: asigs.data ?? [],
        atrasos: atrasos.data ?? [],
        retiros: retiros.data ?? [],
        anots: anots.data ?? [],
        libro: libro.data ?? [],
      };
    },
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const total = data.asis.length;
    const presentes = data.asis.filter((a) => a.estado === "presente").length;
    const ausentes = data.asis.filter((a) => a.estado === "ausente").length;
    const pct = total ? Math.round((presentes / total) * 100) : 0;

    // promedio ponderado general
    let sumW = 0, sumWV = 0;
    for (const c of data.califs) {
      const w = Number(c.ponderacion ?? 1);
      sumW += w; sumWV += Number(c.nota) * w;
    }
    const promedio = sumW > 0 ? (sumWV / sumW).toFixed(1) : "—";

    // promedio por asignatura
    const porAsig = new Map<string, { sum: number; w: number }>();
    for (const c of data.califs) {
      if (!c.asignatura_id) continue;
      const cur = porAsig.get(c.asignatura_id) ?? { sum: 0, w: 0 };
      const w = Number(c.ponderacion ?? 1);
      cur.sum += Number(c.nota) * w; cur.w += w;
      porAsig.set(c.asignatura_id, cur);
    }

    return { total, presentes, ausentes, pct, promedio, porAsig };
  }, [data]);

  if (isLoading) return <div className="text-sm text-muted-foreground p-6">Cargando ficha…</div>;
  if (!data?.alumno) return <div className="p-6">Estudiante no encontrado.</div>;

  const a = data.alumno as unknown as { nombres: string; apellidos: string; rut: string | null; apoderado: string | null; telefono: string | null; numero_lista: number | null; retirado_en: string | null; cursos: { nombre: string; nivel: string } | null };
  const asigMap = Object.fromEntries(data.asigs.map((x) => [x.id, x]));
  const riesgo = stats && stats.pct < 85 && stats.total > 5;

  return (
    <div>
      <Link to="/estudiantes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="w-4 h-4" />Volver a estudiantes
      </Link>
      <PageHeader
        title={`${a.apellidos}, ${a.nombres}`}
        subtitle={`${a.cursos?.nombre ?? "Sin curso"} · ${a.rut ?? "Sin RUT"}${a.retirado_en ? " · Retirado" : ""}`}
      />

      {riesgo && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4" /> Asistencia bajo el 85%: riesgo de inasistencia.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi icon={ClipboardList} label="% Asistencia" value={`${stats?.pct ?? 0}%`} color="#10b981" />
        <Kpi icon={TrendingUp} label="Promedio general" value={String(stats?.promedio ?? "—")} color="#4f8ef7" />
        <Kpi icon={Clock} label="Atrasos" value={data.atrasos.length} color="#f59e0b" />
        <Kpi icon={ShieldCheck} label="Anotaciones" value={data.anots.length} color="#ef4444" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section icon={User} title="Información general">
          <Row label="Número de lista" value={a.numero_lista ?? "—"} />
          <Row label="Nivel" value={a.cursos?.nivel ?? "—"} />
          <Row label="Apoderado" value={a.apoderado ?? "—"} />
          <Row label="Teléfono" value={a.telefono ?? "—"} />
          <Row label="Estado" value={a.retirado_en ? `Retirado (${a.retirado_en})` : "Activo"} />
        </Section>

        <Section icon={GraduationCap} title="Académico">
          <Row label="Asistencia" value={`${stats?.presentes}/${stats?.total} clases (${stats?.pct}%)`} />
          <Row label="Promedio general" value={String(stats?.promedio ?? "—")} />
          <div className="mt-2 space-y-1">
            {stats && Array.from(stats.porAsig.entries()).map(([aid, v]) => {
              const asig = asigMap[aid];
              const prom = (v.sum / v.w).toFixed(1);
              return (
                <div key={aid} className="flex items-center justify-between text-xs">
                  <span className="font-medium" style={{ color: asig?.color }}>{asig?.nombre ?? "—"}</span>
                  <span className="font-mono">{prom}</span>
                </div>
              );
            })}
            {stats?.porAsig.size === 0 && <div className="text-xs text-muted-foreground">Sin calificaciones aún.</div>}
          </div>
        </Section>

        <Section icon={ShieldCheck} title="Inspectoría">
          <Row label="Atrasos" value={data.atrasos.length} />
          <Row label="Retiros" value={data.retiros.length} />
          <Row label="Anotaciones +" value={data.anots.filter((x) => x.tipo === "positiva").length} />
          <Row label="Anotaciones −" value={data.anots.filter((x) => x.tipo === "negativa").length} />
          {data.anots.slice(0, 5).map((n, i) => (
            <div key={i} className="text-xs border-t border-border pt-2 mt-2">
              <span className="text-muted-foreground">{n.fecha}</span> · <span className={n.tipo === "positiva" ? "text-emerald-500" : n.tipo === "negativa" ? "text-rose-500" : ""}>{n.tipo}</span>
              <div className="text-foreground/80">{n.descripcion}</div>
            </div>
          ))}
        </Section>

        <Section icon={Sparkles} title="PIE">
          <p className="text-xs text-muted-foreground">Información PIE, apoyos y seguimientos se cargarán desde el módulo PIE cuando exista un plan asociado al curso.</p>
        </Section>

        <Section icon={BookOpen} title="Últimas clases (libro de clases)">
          {data.libro.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin registros recientes.</p>
          ) : data.libro.slice(0, 8).map((l, i) => {
            const asig = l.asignatura_id ? asigMap[l.asignatura_id] : null;
            return (
              <div key={i} className="text-xs border-t border-border pt-2 mt-2 first:border-0 first:pt-0 first:mt-0">
                <span className="text-muted-foreground">{l.fecha}</span>
                {asig && <span className="ml-2 px-1.5 py-0.5 rounded" style={{ background: `${asig.color}25`, color: asig.color }}>{asig.nombre}</span>}
                <div className="text-foreground/80 line-clamp-2">{l.contenido}</div>
              </div>
            );
          })}
        </Section>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color }: { icon: typeof User; label: string; value: string | number; color: string }) {
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

function Section({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
