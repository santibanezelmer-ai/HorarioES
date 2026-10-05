import { handleDbError } from "@/lib/db-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/db-retry";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { ColorPicker } from "@/components/ColorPicker";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/asignaturas")({
  head: () => ({ meta: [{ title: "Asignaturas — HorarioES" }] }),
  component: AsignaturasPage,
});

const CICLOS = ["prebásica", "1er ciclo", "2do ciclo"] as const;

interface Asignatura {
  id: string;
  nombre: string;
  color: string;
  ciclos: string[];
  orden: number;
}

function AsignaturasPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Asignatura | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Asignatura | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["asignaturas", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase
          .from("asignaturas")
          .select("*")
          .eq("colegio_id", colegioId!)
          .order("orden", { ascending: true })
          .order("nombre", { ascending: true })
      );
      if (error) throw error;
      return data as Asignatura[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (form: Partial<Asignatura>) => {
      if (editing) {
        const { error } = await supabase.from("asignaturas").update({
          nombre: form.nombre, color: form.color, ciclos: form.ciclos,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("asignaturas").insert({
          colegio_id: colegioId!,
          nombre: form.nombre!,
          color: form.color!,
          ciclos: form.ciclos!,
          orden: items.length,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asignaturas", colegioId] });
      setOpen(false); setEditing(null);
      toast.success(editing ? "Asignatura actualizada" : "Asignatura creada");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("asignaturas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asignaturas", colegioId] });
      setToDelete(null);
      toast.success("Asignatura eliminada");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  return (
    <div>
      <PageHeader
        title="Asignaturas"
        subtitle="Materias que se imparten en tu colegio"
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nueva
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Sin asignaturas"
          description="Crea tu primera asignatura para empezar a armar horarios."
          action={<Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Crear asignatura</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((a) => (
            <div key={a.id} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg shrink-0" style={{ background: a.color }} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{a.nombre}</div>
                <div className="text-xs text-muted-foreground truncate">{a.ciclos.join(" · ") || "Sin ciclos"}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setToDelete(a)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AsignaturaDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        initial={editing}
        onSubmit={(f) => upsert.mutate(f)}
        loading={upsert.isPending}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{toDelete?.nombre}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. También se podrían afectar horarios que la utilicen.
            </AlertDialogDescription>
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

function AsignaturaDialog({
  open, onOpenChange, initial, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Asignatura | null;
  onSubmit: (f: Partial<Asignatura>) => void;
  loading: boolean;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [color, setColor] = useState(initial?.color ?? "#4f8ef7");
  const [ciclos, setCiclos] = useState<string[]>(initial?.ciclos ?? [...CICLOS]);

  const toggleCiclo = (c: string) => {
    setCiclos((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar asignatura" : "Nueva asignatura"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nombre.trim()) return;
            onSubmit({ nombre: nombre.trim(), color, ciclos });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Matemática" autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="space-y-2">
            <Label>Ciclos</Label>
            <div className="flex flex-col gap-2">
              {CICLOS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={ciclos.includes(c)} onCheckedChange={() => toggleCiclo(c)} />
                  <span className="capitalize">{c}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading || !nombre.trim()}>
              {loading ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
