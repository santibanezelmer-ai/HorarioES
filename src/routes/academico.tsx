import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ClipboardList, NotebookPen, BookOpen, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ExportMenu } from "@/components/ExportMenu";

export const Route = createFileRoute("/academico")({
  head: () => ({ meta: [{ title: "Resumen académico — HorarioES" }] }),
  component: AcademicoPage,
});

type Rango = 7 | 30 | 90;

interface Curso { id: string; nombre: string; nivel: string }
interface Asistencia { curso_id: string; estado: string; fecha: string }
interface Calif { curso_id: string; asignatura_id: string; nota: number }
interface Asig { id: string; nombre: string; color: string }
interface Libro { curso_id: string; fecha: string }

function AcademicoPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const [rango, setRango] = useState<Rango>(30);

  const { data, isLoading } = useQuery({
    queryKey: ["academico", colegioId, rango],
    enabled: !!colegioId,
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - rango);
      const desdeStr = desde.toISOString().slice(0, 10);
      const [cursos, asis, califs, asigs, libro] = await Promise.all([
        supabase.from("cursos").select("id, nombre, nivel").eq("colegio_id", colegioId!).order("nombre"),
        supabase.from("asistencias").select("curso_id, estado, fecha").eq("colegio_id", colegioId!).gte("fecha", desdeStr),
        supabase.from("calificaciones").select("curso_id, asignatura_id, nota").eq("colegio_id", colegioId!).gte("fecha", desdeStr),
        supabase.from("asignaturas").select("id, nombre, color").eq("colegio_id", colegioId!),
        supabase.from("libro_clases").select("curso_id, fecha").eq("colegio_id", colegioId!).gte("fecha", desdeStr),
      ]);
      return {
        cursos: (cursos.data ?? []) as Curso[],
        asis: (asis.data ?? []) as Asistencia[],
        califs: (califs.data ?? []) as Calif[],
        asigs: (asigs.data ?? []) as Asig[],
        libro: (libro.data ?? []) as Libro[],
      };
    },
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const cursoMap = new Map(data.cursos.map((c) => [c.id, c]));
    const asigMap = new Map(data.asigs.map((a) => [a.id, a]));

    // Por curso
    const porCurso = data.cursos.map((c) => {
      const a = data.asis.filter((x) => x.curso_id === c.id);
      const total = a.length;
      const presentes = a.filter((x) => x.estado === "presente").length;
      const ausentes = a.filter((x) => x.estado === "ausente").length;
      const atrasados = a.filter((x) => x.estado === "atrasado").length;
      const asisPct = total > 0 ? (presentes / total) * 100 : null;
      const cal = data.califs.filter((x) => x.curso_id === c.id);
      const prom = cal.length > 0 ? cal.reduce((s, x) => s + Number(x.nota), 0) / cal.length : null;
      const reg = data.libro.filter((x) => x.curso_id === c.id).length;
      return { curso: c, total, presentes, ausentes, atrasados, asisPct, prom, calCount: cal.length, reg };
    });

    // Globales
    const totalAsis = data.asis.length;
    const presGlobal = data.asis.filter((x) => x.estado === "presente").length;
    const ausGlobal = data.asis.filter((x) => x.estado === "ausente").length;
    const asisPctGlobal = totalAsis > 0 ? (presGlobal / totalAsis) * 100 : null;
    const promGlobal = data.califs.length > 0 ? data.califs.reduce((s, x) => s + Number(x.nota), 0) / data.califs.length : null;

    // Por asignatura (promedio)
    const porAsig = Array.from(asigMap.values()).map((a) => {
      const cal = data.califs.filter((x) => x.asignatura_id === a.id);
      const prom = cal.length > 0 ? cal.reduce((s, x) => s + Number(x.nota), 0) / cal.length : null;
      return { asig: a, count: cal.length, prom };
    }).filter((x) => x.count > 0).sort((a, b) => (b.prom ?? 0) - (a.prom ?? 0));

    return { porCurso, porAsig, asisPctGlobal, promGlobal, totalAsis, presGlobal, ausGlobal, totalCal: data.califs.length, totalLibro: data.libro.length, cursoMap };
  }, [data]);

  const exportRows = useMemo(() => {
    if (!stats) return [];
    return stats.porCurso.map((r) => ({
      Curso: r.curso.nombre,
      Nivel: r.curso.nivel,
      "% Asistencia": r.asisPct !== null ? Number(r.asisPct.toFixed(1)) : "",
      Presentes: r.presentes,
      Ausentes: r.ausentes,
      Atrasados: r.atrasados,
      Promedio: r.prom !== null ? Number(r.prom.toFixed(2)) : "",
      Calificaciones: r.calCount,
      "Registros libro": r.reg,
    }));
  }, [stats]);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Resumen académico"
        subtitle="Asistencia, calificaciones y libro de clases — vista agregada"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu rows={exportRows} filename={`academico-${rango}d`} title="Resumen académico" />
            <div className="flex gap-1 bg-surface-2 rounded-md p-1">
              {([7, 30, 90] as Rango[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRango(r)}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    rango === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r} días
                </button>
              ))}
            </div>
          </div>
        }
      />

      {isLoading && <div className="text-sm text-muted-foreground">Cargando…</div>}

      {!isLoading && stats && (
        <>
          {/* KPIs globales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <KpiCard
              icon={ClipboardList}
              label="% asistencia"
              value={stats.asisPctGlobal !== null ? `${stats.asisPctGlobal.toFixed(1)}%` : "—"}
              hint={`${stats.presGlobal} de ${stats.totalAsis} registros`}
              tone={stats.asisPctGlobal !== null ? (stats.asisPctGlobal >= 90 ? "ok" : stats.asisPctGlobal >= 80 ? "warn" : "bad") : "neutral"}
            />
            <KpiCard
              icon={NotebookPen}
              label="Promedio general"
              value={stats.promGlobal !== null ? stats.promGlobal.toFixed(2) : "—"}
              hint={`${stats.totalCal} calificaciones`}
              tone={stats.promGlobal !== null ? (stats.promGlobal >= 5.5 ? "ok" : stats.promGlobal >= 4.0 ? "warn" : "bad") : "neutral"}
            />
            <KpiCard
              icon={TrendingDown}
              label="Ausencias"
              value={String(stats.ausGlobal)}
              hint="en el rango"
              tone="neutral"
            />
            <KpiCard
              icon={BookOpen}
              label="Registros libro"
              value={String(stats.totalLibro)}
              hint="clases registradas"
              tone="neutral"
            />
          </div>

          {/* Por curso */}
          <div className="bg-card border rounded-lg overflow-hidden mb-6">
            <div className="px-4 py-3 border-b bg-surface-2">
              <h3 className="text-sm font-semibold">Por curso</h3>
            </div>
            {stats.porCurso.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Sin cursos" description="Aún no hay cursos creados." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Curso</th>
                      <th className="text-right px-3 py-2 font-medium">% asistencia</th>
                      <th className="text-right px-3 py-2 font-medium">Presentes</th>
                      <th className="text-right px-3 py-2 font-medium">Ausentes</th>
                      <th className="text-right px-3 py-2 font-medium">Atrasados</th>
                      <th className="text-right px-3 py-2 font-medium">Promedio</th>
                      <th className="text-right px-3 py-2 font-medium">Calif.</th>
                      <th className="text-right px-3 py-2 font-medium">Libro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.porCurso.map((r) => (
                      <tr key={r.curso.id} className="border-t hover:bg-surface-2/40">
                        <td className="px-4 py-2">
                          <div className="font-medium">{r.curso.nombre}</div>
                          <div className="text-[11px] text-muted-foreground">{r.curso.nivel}</div>
                        </td>
                        <td className="text-right px-3 py-2">
                          {r.asisPct !== null ? (
                            <span className={asisColor(r.asisPct)}>{r.asisPct.toFixed(1)}%</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="text-right px-3 py-2">{r.presentes}</td>
                        <td className="text-right px-3 py-2">{r.ausentes}</td>
                        <td className="text-right px-3 py-2">{r.atrasados}</td>
                        <td className="text-right px-3 py-2">
                          {r.prom !== null ? (
                            <span className={notaColor(r.prom)}>{r.prom.toFixed(2)}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="text-right px-3 py-2 text-muted-foreground">{r.calCount}</td>
                        <td className="text-right px-3 py-2 text-muted-foreground">{r.reg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Por asignatura */}
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b bg-surface-2">
              <h3 className="text-sm font-semibold">Promedios por asignatura</h3>
            </div>
            {stats.porAsig.length === 0 ? (
              <EmptyState icon={NotebookPen} title="Sin calificaciones" description="No hay notas registradas en el rango." />
            ) : (
              <div className="divide-y">
                {stats.porAsig.map((a) => (
                  <div key={a.asig.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: a.asig.color }} />
                    <div className="flex-1 text-sm font-medium">{a.asig.nombre}</div>
                    <div className="text-xs text-muted-foreground">{a.count} notas</div>
                    <div className={`text-sm font-semibold w-14 text-right ${notaColor(a.prom!)}`}>
                      {a.prom!.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, hint, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; hint?: string;
  tone: "ok" | "warn" | "bad" | "neutral";
}) {
  const toneCls = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className={`text-2xl font-bold ${toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function asisColor(p: number) {
  if (p >= 90) return "text-emerald-600 font-semibold";
  if (p >= 80) return "text-amber-600 font-semibold";
  return "text-destructive font-semibold";
}
function notaColor(n: number) {
  if (n >= 5.5) return "text-emerald-600";
  if (n >= 4.0) return "text-amber-600";
  return "text-destructive";
}
