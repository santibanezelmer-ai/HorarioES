import { handleDbError } from "@/lib/db-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/db-retry";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { ColorPicker } from "@/components/ColorPicker";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/espacios")({
  head: () => ({ meta: [{ title: "Espacios — HorarioES" }] }),
  component: EspaciosPage,
});

const TIPOS = ["gimnasio", "laboratorio", "biblioteca", "patio", "sala", "otro"];

interface Espacio {
  id: string;
  nombre: string;
  tipo: string;
  color: string;
}

function EspaciosPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Espacio | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Espacio | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["espacios", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase
          .from("espacios")
          .select("id, nombre, tipo, color")
          .eq("colegio_id", colegioId!)
          .order("nombre")
      );
      if (error) throw error;
      return data as Espacio[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (form: Partial<Espacio>) => {
      const payload = { nombre: form.nombre, tipo: form.tipo, color: form.color };
      if (editing) {
        const { error } = await supabase.from("espacios").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("espacios").insert({ ...payload, colegio_id: colegioId! } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["espacios", colegioId] });
      setOpen(false); setEditing(null);
      toast.success(editing ? "Espacio actualizado" : "Espacio creado");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("espacios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["espacios", colegioId] });
      setToDelete(null);
      toast.success("Espacio eliminado");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  return (
    <div>
      <PageHeader
        title="Espacios"
        subtitle="Salas, gimnasio, laboratorios y otros espacios físicos"
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Sin espacios"
          description="Agrega espacios para asignarlos a celdas de horario."
          action={<Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Crear espacio</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((e) => (
            <div key={e.id} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg shrink-0" style={{ background: e.color }} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{e.nombre}</div>
                <div className="text-xs text-muted-foreground capitalize">{e.tipo}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setToDelete(e)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <EspacioDialog
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
            <AlertDialogDescription>Las celdas que lo usen quedarán sin espacio asignado.</AlertDialogDescription>
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

function EspacioDialog({
  open, onOpenChange, initial, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Espacio | null;
  onSubmit: (f: Partial<Espacio>) => void;
  loading: boolean;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [tipo, setTipo] = useState(initial?.tipo ?? "gimnasio");
  const [color, setColor] = useState(initial?.color ?? "#34d399");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar espacio" : "Nuevo espacio"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nombre.trim()) return;
            onSubmit({ nombre: nombre.trim(), tipo, color });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Sala 12" autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker value={color} onChange={setColor} />
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
