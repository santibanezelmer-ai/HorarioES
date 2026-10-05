import { handleDbError } from "@/lib/db-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GraduationCap } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { deleteCurso, getCursosData, saveCurso } from "@/lib/school.functions";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/cursos")({
  head: () => ({ meta: [{ title: "Cursos — HorarioES" }] }),
  component: CursosPage,
});

const NIVELES = ["prebásica", "1er ciclo", "2do ciclo"] as const;
type Nivel = typeof NIVELES[number];

interface Curso {
  id: string;
  nombre: string;
  nivel: Nivel;
  prof_jefe_id: string | null;
}

interface Docente { id: string; nombre: string; color: string; }

function CursosPage() {
  const { profile, session } = useAuth();
  const colegioId = profile?.colegio_id;
  const accessToken = session?.access_token;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Curso | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Curso | null>(null);

  const cursosQuery = useQuery({
    queryKey: ["cursos-data", colegioId],
    enabled: !!accessToken,
    retry: false,
    queryFn: async () => getCursosData({ data: { accessToken: accessToken! } }),
  });

  const items = (cursosQuery.data?.cursos ?? []) as Curso[];
  const docentes = (cursosQuery.data?.docentes ?? []) as Docente[];

  const docentesMap = Object.fromEntries(docentes.map((d) => [d.id, d]));

  const upsert = useMutation({
    mutationFn: async (form: Partial<Curso>) => {
      if (!accessToken) throw new Error("Sesión no disponible");
      await saveCurso({
        data: {
          accessToken,
          curso: {
            id: editing?.id,
            nombre: form.nombre ?? "",
            nivel: form.nivel ?? "1er ciclo",
            prof_jefe_id: form.prof_jefe_id ?? null,
          },
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cursos-data", colegioId] });
      setOpen(false); setEditing(null);
      toast.success(editing ? "Curso actualizado" : "Curso creado");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) throw new Error("Sesión no disponible");
      await deleteCurso({ data: { accessToken, id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cursos-data", colegioId] });
      setToDelete(null);
      toast.success("Curso eliminado");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  return (
    <div>
      <PageHeader
        title="Cursos"
        subtitle="Cursos del colegio con su nivel y profesor jefe"
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo
          </Button>
        }
      />

      {cursosQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Sin cursos"
          description="Crea cursos para luego armar sus horarios."
          action={<Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Crear curso</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((c) => {
            const jefe = c.prof_jefe_id ? docentesMap[c.prof_jefe_id] : null;
            return (
              <div key={c.id} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-semibold">
                  {c.nombre.slice(0, 3).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.nombre}</div>
                  <div className="text-xs text-muted-foreground truncate capitalize">
                    {c.nivel}{jefe ? ` · ${jefe.nombre}` : " · sin profe jefe"}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setToDelete(c)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <CursoDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        initial={editing}
        docentes={docentes}
        onSubmit={(f) => upsert.mutate(f)}
        loading={upsert.isPending}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{toDelete?.nombre}”?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminarán también las celdas de horario del curso.</AlertDialogDescription>
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

function CursoDialog({
  open, onOpenChange, initial, docentes, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Curso | null;
  docentes: Docente[];
  onSubmit: (f: Partial<Curso>) => void;
  loading: boolean;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [nivel, setNivel] = useState<Nivel>(initial?.nivel ?? "1er ciclo");
  const [jefeId, setJefeId] = useState<string>(initial?.prof_jefe_id ?? "__none__");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar curso" : "Nuevo curso"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nombre.trim()) return;
            onSubmit({
              nombre: nombre.trim(),
              nivel,
              prof_jefe_id: jefeId === "__none__" ? null : jefeId,
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="3°A" autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Nivel</Label>
            <Select value={nivel} onValueChange={(v) => setNivel(v as Nivel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NIVELES.map((n) => <SelectItem key={n} value={n} className="capitalize">{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Profesor jefe</Label>
            <Select value={jefeId} onValueChange={setJefeId}>
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin asignar</SelectItem>
                {docentes.map((d) => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
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
