import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/db-retry";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/estadisticas")({
  head: () => ({ meta: [{ title: "Estadísticas UTP — HorarioES" }] }),
  component: EstadisticasPage,
});

interface Slot { docente_id: string | null; }
interface Docente { id: string; nombre: string; color: string; horas_utp: number | null; }

function EstadisticasPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;

  const { data, isLoading } = useQuery({
    queryKey: ["estadisticas", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const [slots, docentes] = await Promise.all([
        withRetry(() => supabase.from("schedule_slots").select("docente_id").eq("colegio_id", colegioId!)),
        withRetry(() => supabase.from("docentes").select("id, nombre, color, horas_utp").eq("colegio_id", colegioId!).order("nombre")),
      ]);
      return {
        slots: (slots.data ?? []) as Slot[],
        docentes: (docentes.data ?? []) as Docente[],
      };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const horas: Record<string, number> = {};
    for (const s of data.slots) if (s.docente_id) horas[s.docente_id] = (horas[s.docente_id] ?? 0) + 1;
    return data.docentes.map((d) => {
      const asignadas = horas[d.id] ?? 0;
      const contratadas = d.horas_utp ?? 0;
      const diff = asignadas - contratadas;
      let estado: "ok" | "bajo" | "sobre" | "sin" = "sin";
      if (contratadas > 0) {
        if (diff === 0) estado = "ok";
        else if (diff < 0) estado = "bajo";
        else estado = "sobre";
      }
      return { ...d, asignadas, contratadas, diff, estado };
    });
  }, [data]);

  if (isLoading) return <div className="text-sm text-muted-foreground">Cargando estadísticas…</div>;
  if (!data || data.docentes.length === 0) {
    return (
      <div>
        <PageHeader title="Estadísticas UTP" subtitle="Carga horaria por docente" />
        <EmptyState icon={BarChart3} title="Sin datos" description="Aún no hay docentes registrados." />
      </div>
    );
  }

  const totalAsig = rows.reduce((a, r) => a + r.asignadas, 0);
  const totalContr = rows.reduce((a, r) => a + r.contratadas, 0);

  return (
    <div>
      <PageHeader title="Estadísticas UTP" subtitle={`${rows.length} docentes · ${totalAsig} hrs asignadas / ${totalContr} contratadas`} />

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Docente</th>
              <th className="text-right px-4 py-2 font-medium">Asignadas</th>
              <th className="text-right px-4 py-2 font-medium">Contratadas</th>
              <th className="text-right px-4 py-2 font-medium">Diferencia</th>
              <th className="text-left px-4 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />
                    <span className="truncate">{r.nombre}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{r.asignadas}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.contratadas || "—"}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${r.diff === 0 ? "" : r.diff < 0 ? "text-amber-500" : "text-red-500"}`}>
                  {r.contratadas ? (r.diff > 0 ? `+${r.diff}` : r.diff) : "—"}
                </td>
                <td className="px-4 py-2">
                  <EstadoBadge estado={r.estado} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: "ok" | "bajo" | "sobre" | "sin" }) {
  const map = {
    ok: { label: "Completo", cls: "bg-emerald-500/15 text-emerald-500" },
    bajo: { label: "Bajo carga", cls: "bg-amber-500/15 text-amber-500" },
    sobre: { label: "Sobre carga", cls: "bg-red-500/15 text-red-500" },
    sin: { label: "Sin contrato", cls: "bg-muted text-muted-foreground" },
  }[estado];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${map.cls}`}>{map.label}</span>;
}
