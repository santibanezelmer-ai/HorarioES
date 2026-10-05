import { handleDbError } from "@/lib/db-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileSignature, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/db-retry";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/contratos")({
  head: () => ({ meta: [{ title: "Contratos — HorarioES" }] }),
  component: ContratosPage,
});

interface Docente { id: string; nombre: string; color: string; horas_utp: number | null; }

function ContratosPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Docente | null>(null);

  const { data: docentes = [], isLoading } = useQuery({
    queryKey: ["contratos", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase
          .from("docentes")
          .select("id, nombre, color, horas_utp")
          .eq("colegio_id", colegioId!)
          .order("nombre")
      );
      if (error) throw error;
      return data as Docente[];
    },
  });

  const { data: slots = [] } = useQuery({
    queryKey: ["contratos-slots", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase
          .from("schedule_slots")
          .select("docente_id")
          .eq("colegio_id", colegioId!)
      );
      if (error) throw error;
      return data as { docente_id: string | null }[];
    },
  });

  const horasPorDocente = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of slots) if (s.docente_id) m[s.docente_id] = (m[s.docente_id] ?? 0) + 1;
    return m;
  }, [slots]);

  const update = useMutation({
    mutationFn: async ({ id, horas }: { id: string; horas: number | null }) => {
      const { error } = await supabase.from("docentes").update({ horas_utp: horas }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contratos", colegioId] });
      setEditing(null);
      toast.success("Contrato actualizado");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Cargando…</div>;
  if (docentes.length === 0) {
    return (
      <div>
        <PageHeader title="Contratos" subtitle="Horas contratadas vs horas asignadas" />
        <EmptyState icon={FileSignature} title="Sin docentes" description="Crea docentes primero." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Contratos" subtitle="Horas contratadas vs asignadas en el horario" />

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs">
            <tr>
              <th className="text-left p-3 font-semibold">Docente</th>
              <th className="text-right p-3 font-semibold">Asignadas</th>
              <th className="text-right p-3 font-semibold">Contrato</th>
              <th className="text-right p-3 font-semibold">Diferencia</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {docentes.map((d) => {
              const asignadas = horasPorDocente[d.id] ?? 0;
              const contrato = d.horas_utp ?? 0;
              const diff = contrato - asignadas;
              const ok = contrato > 0 && Math.abs(diff) <= 1;
              return (
                <tr key={d.id} className="border-t border-border">
                  <td className="p-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      {d.nombre}
                    </span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{asignadas}</td>
                  <td className="p-3 text-right tabular-nums">{d.horas_utp ?? "—"}</td>
                  <td className={`p-3 text-right tabular-nums font-medium ${
                    contrato === 0 ? "text-muted-foreground" :
                    ok ? "text-green-500" :
                    diff > 0 ? "text-amber-500" : "text-red-500"
                  }`}>
                    {contrato === 0 ? "—" : (diff > 0 ? `+${diff}` : diff)}
                  </td>
                  <td className="p-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(d)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ContratoDialog
        key={editing?.id ?? "none"}
        open={!!editing}
        docente={editing}
        onClose={() => setEditing(null)}
        onSave={(horas) => editing && update.mutate({ id: editing.id, horas })}
        loading={update.isPending}
      />
    </div>
  );
}

function ContratoDialog({ open, docente, onClose, onSave, loading }: {
  open: boolean; docente: Docente | null; onClose: () => void; onSave: (horas: number | null) => void; loading: boolean;
}) {
  const [v, setV] = useState(docente?.horas_utp?.toString() ?? "");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Contrato de {docente?.nombre}</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); onSave(v.trim() === "" ? null : Number(v)); }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="h">Horas semanales contratadas</Label>
            <Input id="h" type="number" min={0} value={v} onChange={(e) => setV(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
