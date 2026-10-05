import { handleDbError } from "@/lib/db-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Clock, ChevronUp, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/db-retry";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
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

export const Route = createFileRoute("/bloques")({
  head: () => ({ meta: [{ title: "Bloques — HorarioES" }] }),
  component: BloquesPage,
});

const TIPOS = ["clase", "recreo", "almuerzo"] as const;
type Tipo = typeof TIPOS[number];

interface Bloque {
  id: string;
  nombre: string;
  hora: string;
  duracion: number;
  tipo: Tipo;
  orden: number;
}

const TIPO_COLORS: Record<Tipo, string> = {
  clase: "bg-primary/15 text-primary",
  recreo: "bg-amber-500/15 text-amber-400",
  almuerzo: "bg-emerald-500/15 text-emerald-400",
};

function BloquesPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Bloque | null>(null);
  const [open, setOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["bloques", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase
          .from("bloques")
          .select("*")
          .eq("colegio_id", colegioId!)
          .order("orden")
      );
      if (error) throw error;
      return data as Bloque[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (form: Partial<Bloque>) => {
      if (editing) {
        const { error } = await supabase.from("bloques").update({
          nombre: form.nombre, hora: form.hora, duracion: form.duracion, tipo: form.tipo,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bloques").insert([{
          colegio_id: colegioId!,
          nombre: form.nombre!, hora: form.hora!, duracion: form.duracion ?? 45,
          tipo: form.tipo ?? "clase", orden: items.length,
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bloques", colegioId] });
      setOpen(false); setEditing(null);
      toast.success(editing ? "Bloque actualizado" : "Bloque creado");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bloques").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bloques", colegioId] });
      toast.success("Bloque eliminado");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  const swapOrder = useMutation({
    mutationFn: async ({ a, b }: { a: Bloque; b: Bloque }) => {
      const { error: e1 } = await supabase.from("bloques").update({ orden: b.orden }).eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("bloques").update({ orden: a.orden }).eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bloques", colegioId] }),
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  return (
    <div>
      <PageHeader
        title="Bloques horarios"
        subtitle="Define los bloques de la jornada (clases, recreos, almuerzo)"
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
          icon={Clock}
          title="Sin bloques"
          description="Configura los bloques horarios de tu jornada escolar."
          action={<Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Crear bloque</Button>}
        />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {items.map((b, i) => (
            <div key={b.id} className="flex items-center gap-3 p-3 border-b border-border last:border-0">
              <div className="flex flex-col">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => swapOrder.mutate({ a: b, b: items[i - 1] })}
                ><ChevronUp className="w-4 h-4" /></button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === items.length - 1}
                  onClick={() => swapOrder.mutate({ a: b, b: items[i + 1] })}
                ><ChevronDown className="w-4 h-4" /></button>
              </div>
              <div className="font-mono text-sm text-muted-foreground w-16">{b.hora}</div>
              <div className="flex-1">
                <div className="font-medium">{b.nombre}</div>
                <div className="text-xs text-muted-foreground">{b.duracion} min</div>
              </div>
              <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded ${TIPO_COLORS[b.tipo]}`}>
                {b.tipo}
              </span>
              <Button size="icon" variant="ghost" onClick={() => { setEditing(b); setOpen(true); }}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove.mutate(b.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <BloqueDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        initial={editing}
        onSubmit={(f) => upsert.mutate(f)}
        loading={upsert.isPending}
      />
    </div>
  );
}

function BloqueDialog({
  open, onOpenChange, initial, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Bloque | null;
  onSubmit: (f: Partial<Bloque>) => void;
  loading: boolean;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [hora, setHora] = useState(initial?.hora ?? "08:00");
  const [duracion, setDuracion] = useState<string>(initial?.duracion?.toString() ?? "45");
  const [tipo, setTipo] = useState<Tipo>(initial?.tipo ?? "clase");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar bloque" : "Nuevo bloque"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nombre.trim()) return;
            onSubmit({ nombre: nombre.trim(), hora, duracion: Number(duracion) || 45, tipo });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Bloque 1" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora">Hora</Label>
              <Input id="hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dur">Duración (min)</Label>
              <Input id="dur" type="number" min={1} value={duracion} onChange={(e) => setDuracion(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
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
