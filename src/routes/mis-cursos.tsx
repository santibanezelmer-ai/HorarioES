import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useMyDocente } from "@/lib/use-my-docente";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { GraduationCap, Star, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { handleDbError } from "@/lib/db-errors";

export const Route = createFileRoute("/mis-cursos")({
  head: () => ({ meta: [{ title: "Mis cursos — HorarioES" }] }),
  component: MisCursosPage,
});

interface Curso { id: string; nombre: string; nivel: string; prof_jefe_id: string | null }
interface Alumno {
  id: string;
  curso_id: string;
  colegio_id: string;
  nombres: string;
  apellidos: string;
  rut: string | null;
  numero_lista: number | null;
  apoderado: string | null;
  telefono: string | null;
  fecha_ingreso: string | null;
}


function MisCursosPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const { data: docente, isLoading } = useMyDocente();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: cursos = [] } = useQuery({
    queryKey: ["mis-cursos", colegioId, docente?.id],
    enabled: !!colegioId && !!docente?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("cursos")
        .select("id, nombre, nivel, prof_jefe_id")
        .eq("colegio_id", colegioId!).order("nombre");
      if (error) throw error;
      return data as Curso[];
    },
  });

  return (
    <div>
      <PageHeader title="Mis cursos" subtitle={`${cursos.length} curso(s) asignado(s)`} />

      {!isLoading && !docente && (
        <EmptyState icon={GraduationCap} title="Cuenta no vinculada" description="Pide al administrador que vincule tu cuenta a tu ficha de docente." />
      )}

      {docente && cursos.length === 0 && (
        <EmptyState icon={GraduationCap} title="Aún no tienes cursos asignados" description="Cuando el administrador te asigne clases o un curso jefe aparecerán aquí." />
      )}

      <div className="grid grid-cols-1 gap-3">
        {cursos.map((c) => {
          const esJefe = c.prof_jefe_id === docente?.id;
          const isOpen = expanded === c.id;
          return (
            <div key={c.id} className="bg-surface border border-border rounded-xl">
              <button
                type="button"
                onClick={() => esJefe && setExpanded(isOpen ? null : c.id)}
                className="w-full p-4 flex items-start justify-between gap-2 text-left"
                disabled={!esJefe}
              >
                <div className="flex items-center gap-2">
                  {esJefe && (isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                  <div>
                    <div className="text-base font-semibold">{c.nombre}</div>
                    <div className="text-xs text-muted-foreground capitalize mt-0.5">{c.nivel}</div>
                  </div>
                </div>
                {esJefe && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                    <Star className="w-3 h-3" /> Profesor jefe
                  </span>
                )}
              </button>
              {esJefe && isOpen && colegioId && (
                <div className="border-t border-border p-4">
                  <AlumnosManager cursoId={c.id} colegioId={colegioId} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlumnosManager({ cursoId, colegioId }: { cursoId: string; colegioId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Alumno | null>(null);
  const [toDelete, setToDelete] = useState<Alumno | null>(null);

  const queryKey = ["alumnos", cursoId];
  const { data: alumnos = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("alumnos")
        .select("id, curso_id, colegio_id, nombres, apellidos, rut, numero_lista, apoderado, telefono, fecha_ingreso")
        .eq("curso_id", cursoId)
        .order("numero_lista", { ascending: true, nullsFirst: false })
        .order("apellidos");
      if (error) throw error;
      return data as Alumno[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (form: Partial<Alumno>) => {
      if (editing) {
        const { error } = await supabase.from("alumnos").update({
          nombres: form.nombres, apellidos: form.apellidos, rut: form.rut,
          numero_lista: form.numero_lista, apoderado: form.apoderado, telefono: form.telefono,
          fecha_ingreso: form.fecha_ingreso ?? null,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("alumnos").insert({
          curso_id: cursoId, colegio_id: colegioId,
          nombres: form.nombres ?? "", apellidos: form.apellidos ?? "",
          rut: form.rut ?? null, numero_lista: form.numero_lista ?? null,
          apoderado: form.apoderado ?? null, telefono: form.telefono ?? null,
          fecha_ingreso: form.fecha_ingreso ?? null,
        });
        if (error) throw error;
      }

    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setOpen(false); setEditing(null);
      toast.success(editing ? "Alumno actualizado" : "Alumno creado");
    },
    onError: (e) => toast.error(handleDbError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alumnos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setToDelete(null);
      toast.success("Alumno eliminado");
    },
    onError: (e) => toast.error(handleDbError(e)),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Alumnos ({alumnos.length})</div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Agregar
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : alumnos.length === 0 ? (
        <div className="text-sm text-muted-foreground">Sin alumnos. Agrega uno o impórtalos desde Excel.</div>
      ) : (
        <div className="divide-y divide-border border border-border rounded-lg">
          {alumnos.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-2 text-sm">
              <div className="w-8 text-center text-xs text-muted-foreground">{a.numero_lista ?? "—"}</div>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{a.apellidos}, {a.nombres}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {a.rut ?? "sin RUT"}{a.apoderado ? ` · ${a.apoderado}` : ""}{a.telefono ? ` · ${a.telefono}` : ""}
                </div>
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

      <AlumnoDialog
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
            <AlertDialogTitle>¿Eliminar alumno?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará a {toDelete?.apellidos}, {toDelete?.nombres}. Esta acción no se puede deshacer.
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

function AlumnoDialog({
  open, onOpenChange, initial, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Alumno | null;
  onSubmit: (f: Partial<Alumno>) => void;
  loading: boolean;
}) {
  const [nombres, setNombres] = useState(initial?.nombres ?? "");
  const [apellidos, setApellidos] = useState(initial?.apellidos ?? "");
  const [rut, setRut] = useState(initial?.rut ?? "");
  const [numero, setNumero] = useState<string>(initial?.numero_lista?.toString() ?? "");
  const [apoderado, setApoderado] = useState(initial?.apoderado ?? "");
  const [telefono, setTelefono] = useState(initial?.telefono ?? "");
  const [fechaIngreso, setFechaIngreso] = useState<string>(
    initial?.fecha_ingreso ?? new Date().toISOString().slice(0, 10),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar alumno" : "Nuevo alumno"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nombres.trim() || !apellidos.trim()) return;
            onSubmit({
              nombres: nombres.trim(),
              apellidos: apellidos.trim(),
              rut: rut.trim() || null,
              numero_lista: numero.trim() ? Number(numero) : null,
              apoderado: apoderado.trim() || null,
              telefono: telefono.trim() || null,
              fecha_ingreso: fechaIngreso || null,
            });
          }}

          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>N° lista</Label>
              <Input type="number" value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>RUT</Label>
              <Input value={rut} onChange={(e) => setRut(e.target.value)} placeholder="12345678-9" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Apellidos *</Label>
            <Input value={apellidos} onChange={(e) => setApellidos(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Nombres *</Label>
            <Input value={nombres} onChange={(e) => setNombres(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Apoderado</Label>
            <Input value={apoderado} onChange={(e) => setApoderado(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Teléfono</Label>
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Fecha de ingreso</Label>
            <Input type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} />
            <p className="text-xs text-muted-foreground">El estudiante aparecerá en asistencia a partir de esta fecha.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading || !nombres.trim() || !apellidos.trim()}>
              {loading ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
