import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useMyDocente } from "@/lib/use-my-docente";
import { useCursosVisibles } from "@/lib/use-cursos-visibles";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { handleDbError } from "@/lib/db-errors";

export const Route = createFileRoute("/libro-clases")({
  head: () => ({ meta: [{ title: "Libro de clases — HorarioES" }] }),
  component: LibroClasesPage,
});

interface Asignatura { id: string; nombre: string; color: string }
interface Entrada {
  id: string; fecha: string; slot: number | null;
  contenido: string; observaciones: string | null;
  asignatura_id: string | null; docente_id: string | null;
  objetivo_logrado: boolean | null;
}

function LibroClasesPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const qc = useQueryClient();
  const cursos = useCursosVisibles();
  const { data: docente } = useMyDocente();
  const [cursoId, setCursoId] = useState("");
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Entrada | null>(null);

  const asigQ = useQuery({
    queryKey: ["asignaturas-visibles", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asignaturas").select("id, nombre, color")
        .eq("colegio_id", colegioId!).order("orden");
      if (error) throw error;
      return (data ?? []) as Asignatura[];
    },
  });

  const entradasQ = useQuery({
    queryKey: ["libro-clases", cursoId],
    enabled: !!cursoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("libro_clases")
        .select("id, fecha, slot, contenido, observaciones, asignatura_id, docente_id, objetivo_logrado")
        .eq("curso_id", cursoId)
        .order("fecha", { ascending: false }).order("slot", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Entrada[];
    },
  });

  const asigMap = Object.fromEntries((asigQ.data ?? []).map((a) => [a.id, a]));

  const add = useMutation({
    mutationFn: async (f: { fecha: string; slot: string; contenido: string; observaciones: string; asignatura_id: string; objetivo_logrado: boolean }) => {
      if (!colegioId) throw new Error("Sin colegio");
      if (!f.contenido.trim()) throw new Error("Contenido requerido");
      const { error } = await supabase.from("libro_clases").insert({
        colegio_id: colegioId, curso_id: cursoId,
        asignatura_id: f.asignatura_id || null,
        docente_id: docente?.id ?? null,
        fecha: f.fecha,
        slot: f.slot ? Number(f.slot) : null,
        contenido: f.contenido.trim(),
        observaciones: f.observaciones.trim() || null,
        objetivo_logrado: f.objetivo_logrado,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["libro-clases", cursoId] });
      setOpen(false); toast.success("Clase registrada");
    },
    onError: (e) => toast.error(handleDbError(e)),
  });

  const toggleObjetivo = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("libro_clases").update({ objetivo_logrado: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["libro-clases", cursoId] }),
    onError: (e) => toast.error(handleDbError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("libro_clases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["libro-clases", cursoId] }); setToDelete(null); toast.success("Eliminado"); },
    onError: (e) => toast.error(handleDbError(e)),
  });

  return (
    <div>
      <PageHeader
        title="Libro de clases"
        subtitle="Bitácora de contenido y observaciones por clase"
        actions={cursoId ? <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Nueva entrada</Button> : null}
      />

      <div className="bg-surface border border-border rounded-xl p-4 mb-4">
        <div className="space-y-1.5 max-w-md">
          <Label>Curso</Label>
          <Select value={cursoId} onValueChange={setCursoId}>
            <SelectTrigger><SelectValue placeholder="Selecciona curso" /></SelectTrigger>
            <SelectContent>
              {(cursos.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!cursoId ? (
        <EmptyState icon={BookOpen} title="Elige un curso" description="Para ver y registrar el libro de clases." />
      ) : entradasQ.isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : (entradasQ.data ?? []).length === 0 ? (
        <EmptyState icon={BookOpen} title="Sin entradas todavía" description="Registra la primera clase del curso." />
      ) : (
        <div className="space-y-3">
          {entradasQ.data!.map((e) => {
            const asig = e.asignatura_id ? asigMap[e.asignatura_id] : null;
            return (
              <div key={e.id} className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-1.5 self-stretch rounded-full" style={{ background: asig?.color ?? "#4f8ef7" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-surface-2">{e.fecha}</span>
                      {e.slot != null && <span className="text-xs px-2 py-0.5 rounded-md bg-surface-2">Bloque {e.slot + 1}</span>}
                      {asig && <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: `${asig.color}25`, color: asig.color }}>{asig.nombre}</span>}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{e.contenido}</div>
                    {e.observaciones && (
                      <div className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
                        <span className="font-medium">Observaciones:</span> {e.observaciones}
                      </div>
                    )}
                    <label className="mt-2 inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!e.objetivo_logrado}
                        onChange={(ev) => toggleObjetivo.mutate({ id: e.id, value: ev.target.checked })}
                        className="rounded border-border"
                      />
                      <span className={e.objetivo_logrado ? "text-emerald-400 font-medium" : "text-muted-foreground"}>
                        Objetivo de la clase logrado
                      </span>
                    </label>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setToDelete(e)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EntradaDialog
        open={open}
        onClose={() => setOpen(false)}
        asignaturas={asigQ.data ?? []}
        loading={add.isPending}
        onSubmit={(f) => add.mutate(f)}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar entrada?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && remove.mutate(toDelete.id)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EntradaDialog({
  open, onClose, asignaturas, loading, onSubmit,
}: {
  open: boolean; onClose: () => void; asignaturas: Asignatura[]; loading: boolean;
  onSubmit: (f: { fecha: string; slot: string; contenido: string; observaciones: string; asignatura_id: string; objetivo_logrado: boolean }) => void;
}) {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState("");
  const [contenido, setContenido] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [asigId, setAsigId] = useState("__none__");
  const [objetivoLogrado, setObjetivoLogrado] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva entrada del libro</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!contenido.trim()) { toast.error("Escribe el contenido de la clase"); return; }
          onSubmit({ fecha, slot, contenido, observaciones, asignatura_id: asigId === "__none__" ? "" : asigId, objetivo_logrado: objetivoLogrado });
        }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Bloque (opcional)</Label>
              <Input type="number" min="0" value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="0, 1, 2…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Asignatura</Label>
            <Select value={asigId} onValueChange={setAsigId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin asignatura</SelectItem>
                {asignaturas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Contenido de la clase</Label>
            <Textarea rows={4} value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder="OA, actividades, recursos…" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Observaciones (opcional)</Label>
            <Textarea rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
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
