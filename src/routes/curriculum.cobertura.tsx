import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { ExportMenu } from "@/components/ExportMenu";

export const Route = createFileRoute("/curriculum/cobertura")({
  head: () => ({ meta: [{ title: "Cobertura curricular — Currículum" }] }),
  component: CoberturaPage,
});

interface Curso { id: string; nombre: string }
interface Asignatura { id: string; nombre: string; color: string }
interface LibroRow { curso_id: string; asignatura_id: string | null; objetivo_logrado: boolean | null }

function CoberturaPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const [days, setDays] = useState(60);

  const sinceISO = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }, [days]);

  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-min", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase.from("cursos").select("id, nombre").eq("colegio_id", colegioId!).order("nombre");
      if (error) throw error;
      return data as Curso[];
    },
  });

  const { data: asignaturas = [] } = useQuery({
    queryKey: ["asignaturas-min", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase.from("asignaturas").select("id, nombre, color").eq("colegio_id", colegioId!).order("nombre");
      if (error) throw error;
      return data as Asignatura[];
    },
  });

  const { data: libro = [], isLoading } = useQuery({
    queryKey: ["libro-cobertura", colegioId, sinceISO], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase.from("libro_clases")
        .select("curso_id, asignatura_id, objetivo_logrado")
        .eq("colegio_id", colegioId!).gte("fecha", sinceISO);
      if (error) throw error;
      return data as LibroRow[];
    },
  });

  // Matrix: cursos rows × asignaturas cols; cell = { total, logrado, pct }
  const matrix = useMemo(() => {
    const m = new Map<string, { total: number; logrado: number }>();
    for (const r of libro) {
      if (!r.asignatura_id) continue;
      const k = `${r.curso_id}|${r.asignatura_id}`;
      const cell = m.get(k) ?? { total: 0, logrado: 0 };
      cell.total++;
      if (r.objetivo_logrado) cell.logrado++;
      m.set(k, cell);
    }
    return m;
  }, [libro]);

  const colorFor = (pct: number) => {
    if (pct >= 80) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
    if (pct >= 50) return "bg-amber-500/20 text-amber-700 dark:text-amber-300";
    if (pct > 0) return "bg-rose-500/20 text-rose-700 dark:text-rose-300";
    return "bg-surface-2 text-muted-foreground";
  };

  return (
    <div>
      <PageHeader
        title="Cobertura curricular"
        subtitle="Porcentaje de clases con objetivo logrado por curso y asignatura"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu
              rows={cursos.flatMap((c) => asignaturas.map((a) => {
                const cell = matrix.get(`${c.id}|${a.id}`);
                return {
                  Curso: c.nombre, Asignatura: a.nombre,
                  "% Cobertura": cell ? Math.round((cell.logrado / cell.total) * 100) : "",
                  "Logrado": cell?.logrado ?? 0, "Total": cell?.total ?? 0,
                };
              }))}
              filename={`cobertura-${days}d`} title="Cobertura curricular"
            />
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm">
              <option value={30}>Últimos 30 días</option>
              <option value={60}>Últimos 60 días</option>
              <option value={90}>Últimos 90 días</option>
              <option value={180}>Últimos 6 meses</option>
            </select>
          </div>
        }
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface-2">
              <tr>
                <th className="text-left px-3 py-2 sticky left-0 bg-surface-2 z-10">Curso</th>
                {asignaturas.map((a) => (
                  <th key={a.id} className="px-2 py-2 text-center min-w-[80px]">
                    <div className="font-semibold" style={{ color: a.color }}>{a.nombre}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cursos.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium sticky left-0 bg-surface z-10">{c.nombre}</td>
                  {asignaturas.map((a) => {
                    const cell = matrix.get(`${c.id}|${a.id}`);
                    if (!cell || cell.total === 0) {
                      return <td key={a.id} className="px-2 py-2 text-center text-muted-foreground/50">—</td>;
                    }
                    const pct = Math.round((cell.logrado / cell.total) * 100);
                    return (
                      <td key={a.id} className="px-2 py-1 text-center">
                        <div className={`rounded px-1.5 py-1 ${colorFor(pct)}`}>
                          <div className="font-bold">{pct}%</div>
                          <div className="text-[9px] opacity-80">{cell.logrado}/{cell.total}</div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        Basado en registros del libro de clases con el campo "Objetivo logrado" marcado.
      </p>
    </div>
  );
}
