import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/db-retry";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/pie")({
  head: () => ({ meta: [{ title: "Panel PIE — HorarioES" }] }),
  component: PiePage,
});

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie"];

interface Plan {
  id: string;
  dia: number;
  slot: number;
  tipo: string;
  docente_id: string;
  docente_titular_id: string | null;
  curso_id: string | null;
  asignatura_id: string | null;
}

function PiePage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;

  const { data, isLoading } = useQuery({
    queryKey: ["pie", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const [plan, docs, cursos, asigs, bloques] = await Promise.all([
        withRetry(() => supabase.from("pie_plan").select("*").eq("colegio_id", colegioId!).order("dia").order("slot")),
        withRetry(() => supabase.from("docentes").select("id, nombre, color, es_pie").eq("colegio_id", colegioId!)),
        withRetry(() => supabase.from("cursos").select("id, nombre").eq("colegio_id", colegioId!)),
        withRetry(() => supabase.from("asignaturas").select("id, nombre, color").eq("colegio_id", colegioId!)),
        withRetry(() => supabase.from("bloques").select("id, nombre, hora, orden").eq("colegio_id", colegioId!).order("orden")),
      ]);
      return {
        plan: (plan.data ?? []) as Plan[],
        docs: docs.data ?? [],
        cursos: cursos.data ?? [],
        asigs: asigs.data ?? [],
        bloques: bloques.data ?? [],
      };
    },
  });

  const maps = useMemo(() => {
    if (!data) return null;
    return {
      doc: Object.fromEntries(data.docs.map((d: any) => [d.id, d])),
      curso: Object.fromEntries(data.cursos.map((c: any) => [c.id, c])),
      asig: Object.fromEntries(data.asigs.map((a: any) => [a.id, a])),
    };
  }, [data]);

  if (isLoading) return <div className="text-sm text-muted-foreground">Cargando PIE…</div>;
  if (!data || data.plan.length === 0) {
    return (
      <div>
        <PageHeader title="Panel PIE" subtitle="Plan de apoyo para docentes PIE" />
        <EmptyState icon={Sparkles} title="Sin plan PIE" description="Aún no hay registros del programa de integración." />
      </div>
    );
  }

  const docentesPie = data.docs.filter((d: any) => d.es_pie);

  return (
    <div>
      <PageHeader
        title="Panel PIE"
        subtitle={`${docentesPie.length} docentes PIE · ${data.plan.length} bloques planificados`}
      />

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-surface-2">
            <tr>
              <th className="text-left p-2 font-semibold">Día</th>
              <th className="text-left p-2 font-semibold">Bloque</th>
              <th className="text-left p-2 font-semibold">Docente PIE</th>
              <th className="text-left p-2 font-semibold">Tipo</th>
              <th className="text-left p-2 font-semibold">Curso</th>
              <th className="text-left p-2 font-semibold">Asignatura</th>
              <th className="text-left p-2 font-semibold">Titular</th>
            </tr>
          </thead>
          <tbody>
            {data.plan.map((p) => {
              const doc = maps!.doc[p.docente_id];
              const titular = p.docente_titular_id ? maps!.doc[p.docente_titular_id] : null;
              const curso = p.curso_id ? maps!.curso[p.curso_id] : null;
              const asig = p.asignatura_id ? maps!.asig[p.asignatura_id] : null;
              const bloque = data.bloques[p.slot];
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-2">{DIAS[p.dia] ?? p.dia}</td>
                  <td className="p-2 text-muted-foreground">{bloque?.nombre ?? `B${p.slot + 1}`}</td>
                  <td className="p-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: doc?.color }} />
                      {doc?.nombre ?? "—"}
                    </span>
                  </td>
                  <td className="p-2 capitalize">{p.tipo}</td>
                  <td className="p-2">{curso?.nombre ?? "—"}</td>
                  <td className="p-2">
                    {asig ? (
                      <span className="px-1.5 py-0.5 rounded text-white text-[10px]" style={{ background: asig.color }}>
                        {asig.nombre}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="p-2 text-muted-foreground">{titular?.nombre ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
