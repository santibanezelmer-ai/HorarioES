import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/admin/auditoria")({
  head: () => ({ meta: [{ title: "Auditoría — Administración" }] }),
  component: AuditoriaPage,
});

interface LogRow {
  id: string;
  user_id: string | null;
  descripcion: string;
  created_at: string;
}

function AuditoriaPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["change-log", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase.from("change_log")
        .select("id, user_id, descripcion, created_at")
        .eq("colegio_id", colegioId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as LogRow[];
    },
  });

  return (
    <div>
      <PageHeader title="Auditoría" subtitle="Bitácora de cambios y eventos del sistema (últimos 500)" />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="Sin eventos" description="Aún no hay actividad registrada en el sistema." />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 w-44">Fecha</th>
                <th className="text-left px-3 py-2">Descripción</th>
                <th className="text-left px-3 py-2 w-72">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{l.descripcion}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{l.user_id ?? "sistema"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
