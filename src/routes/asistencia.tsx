import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Check, X, Clock, FileText, Plus, Trash2, LogOut, AlertCircle } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { handleDbError } from "@/lib/db-errors";

export const Route = createFileRoute("/asistencia")({
  head: () => ({ meta: [{ title: "Asistencia — HorarioES" }] }),
  component: AsistenciaPage,
});

type Estado = "presente" | "ausente" | "atrasado" | "justificado";
const ESTADOS: { v: Estado; label: string; icon: typeof Check; cls: string }[] = [
  { v: "presente", label: "P", icon: Check, cls: "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" },
  { v: "ausente", label: "A", icon: X, cls: "bg-red-500/15 text-red-400 hover:bg-red-500/25" },
  { v: "atrasado", label: "T", icon: Clock, cls: "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25" },
  { v: "justificado", label: "J", icon: FileText, cls: "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25" },
];

interface Alumno {
  id: string;
  nombres: string;
  apellidos: string;
  numero_lista: number | null;
  fecha_ingreso: string | null;
}
interface Asistencia { id: string; alumno_id: string; estado: Estado; observacion: string | null }


function AsistenciaPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const qc = useQueryClient();
  const cursos = useCursosVisibles();
  const [cursoId, setCursoId] = useState<string>("");
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const alumnosQ = useQuery({
    queryKey: ["alumnos", cursoId, fecha],
    enabled: !!cursoId && !!fecha,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alumnos")
        .select("id, nombres, apellidos, numero_lista, fecha_ingreso")
        .eq("curso_id", cursoId)
        .is("retirado_en", null)
        .or(`fecha_ingreso.is.null,fecha_ingreso.lte.${fecha}`)
        .order("numero_lista", { nullsFirst: false })
        .order("apellidos");
      if (error) throw error;
      return (data ?? []) as Alumno[];
    },
  });


  const asistQ = useQuery({
    queryKey: ["asistencias", cursoId, fecha],
    enabled: !!cursoId && !!fecha,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asistencias")
        .select("id, alumno_id, estado, observacion")
        .eq("curso_id", cursoId)
        .eq("fecha", fecha);
      if (error) throw error;
      return (data ?? []) as Asistencia[];
    },
  });

  const mapByAlumno = useMemo(
    () => Object.fromEntries((asistQ.data ?? []).map((a) => [a.alumno_id, a])),
    [asistQ.data],
  );

  const setEstado = useMutation({
    mutationFn: async ({ alumnoId, estado, observacion }: { alumnoId: string; estado: Estado; observacion?: string }) => {
      if (!colegioId) throw new Error("Sin colegio");
      const existing = mapByAlumno[alumnoId];
      if (existing) {
        const { error } = await supabase
          .from("asistencias")
          .update({ estado, observacion: observacion ?? existing.observacion })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("asistencias").insert({
          colegio_id: colegioId, curso_id: cursoId, alumno_id: alumnoId, fecha, estado, observacion: observacion ?? null,
        } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asistencias", cursoId, fecha] }),
    onError: (e) => toast.error(handleDbError(e)),
  });

  const marcarTodosPresente = useMutation({
    mutationFn: async () => {
      if (!colegioId || !alumnosQ.data) return;
      const sinRegistro = alumnosQ.data.filter((al) => !mapByAlumno[al.id]);
      if (!sinRegistro.length) return;
      const rows = sinRegistro.map((al) => ({
        colegio_id: colegioId, curso_id: cursoId, alumno_id: al.id, fecha, estado: "presente" as Estado,
      }));
      const { error } = await supabase.from("asistencias").insert(rows as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asistencias", cursoId, fecha] });
      toast.success("Marcados como presentes");
    },
    onError: (e) => toast.error(handleDbError(e)),
  });

  const counts = useMemo(() => {
    const c = { presente: 0, ausente: 0, atrasado: 0, justificado: 0, sin: 0 };
    (alumnosQ.data ?? []).forEach((al) => {
      const r = mapByAlumno[al.id];
      if (r) c[r.estado] += 1; else c.sin += 1;
    });
    return c;
  }, [alumnosQ.data, mapByAlumno]);

  return (
    <div>
      <PageHeader title="Asistencia" subtitle="Registro diario por curso" />

      <div className="bg-surface border border-border rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div className="space-y-1.5">
          <Label>Curso</Label>
          <Select value={cursoId} onValueChange={setCursoId}>
            <SelectTrigger><SelectValue placeholder="Selecciona un curso" /></SelectTrigger>
            <SelectContent>
              {(cursos.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Fecha</Label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <Button
          variant="secondary"
          disabled={!cursoId || marcarTodosPresente.isPending || !alumnosQ.data?.length}
          onClick={() => marcarTodosPresente.mutate()}
        >
          Marcar todos presentes
        </Button>
      </div>

      {!cursoId ? (
        <EmptyState icon={ClipboardList} title="Elige un curso" description="Selecciona un curso para registrar asistencia." />
      ) : alumnosQ.isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando alumnos…</div>
      ) : (alumnosQ.data ?? []).length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sin alumnos en este curso" description="Importa o agrega alumnos al curso desde Importar datos." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-3 text-xs">
            <Badge color="emerald" label={`Presentes ${counts.presente}`} />
            <Badge color="red" label={`Ausentes ${counts.ausente}`} />
            <Badge color="amber" label={`Atrasados ${counts.atrasado}`} />
            <Badge color="blue" label={`Justificados ${counts.justificado}`} />
            {counts.sin > 0 && <Badge color="muted" label={`Sin registro ${counts.sin}`} />}
          </div>

          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2 w-12">N°</th>
                  <th className="text-left px-3 py-2">Alumno</th>
                  <th className="text-right px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {alumnosQ.data!.map((al) => {
                  const reg = mapByAlumno[al.id];
                  return (
                    <tr key={al.id} className="border-t border-border">
                      <td className="px-3 py-2 text-muted-foreground">{al.numero_lista ?? "—"}</td>
                      <td className="px-3 py-2 font-medium">{al.apellidos}, {al.nombres}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1.5 justify-end">
                          {ESTADOS.map((e) => {
                            const Icon = e.icon;
                            const active = reg?.estado === e.v;
                            return (
                              <button
                                key={e.v}
                                onClick={() => setEstado.mutate({ alumnoId: al.id, estado: e.v })}
                                className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                                  active ? `${e.cls} ring-2 ring-current` : "bg-surface-2 text-muted-foreground hover:bg-sidebar-accent"
                                }`}
                                title={e.v}
                              >
                                <Icon className="w-4 h-4" />
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <EventosBloque
            colegioId={colegioId!}
            cursoId={cursoId}
            fecha={fecha}
            alumnos={alumnosQ.data ?? []}
          />
        </>
      )}
    </div>
  );
}

function Badge({ color, label }: { color: "emerald" | "red" | "amber" | "blue" | "muted"; label: string }) {
  const cls = {
    emerald: "bg-emerald-500/15 text-emerald-400",
    red: "bg-red-500/15 text-red-400",
    amber: "bg-amber-500/15 text-amber-400",
    blue: "bg-blue-500/15 text-blue-400",
    muted: "bg-surface-2 text-muted-foreground",
  }[color];
  return <span className={`px-2.5 py-1 rounded-full font-medium ${cls}`}>{label}</span>;
}

type EventoTipo = "retiro" | "atraso" | "salida_temprana" | "observacion" | "ausencia_parcial";
const EVENTO_LABELS: Record<EventoTipo, string> = {
  retiro: "Retiro",
  atraso: "Atraso",
  salida_temprana: "Salida temprana",
  ausencia_parcial: "Ausencia parcial",
  observacion: "Observación",
};

interface SlotMio { id: string; slot: number; asignatura_id: string | null; docente_id: string | null; asistente_id: string | null }
interface Bloque { id: string; nombre: string; hora: string; orden: number }
interface Evento {
  id: string; alumno_id: string; slot: number; tipo: EventoTipo; observacion: string | null;
  docente_id: string | null; asignatura_id: string | null;
}

function EventosBloque({ colegioId, cursoId, fecha, alumnos }: {
  colegioId: string; cursoId: string; fecha: string;
  alumnos: { id: string; nombres: string; apellidos: string; numero_lista: number | null }[];
}) {
  const qc = useQueryClient();
  const { data: docente } = useMyDocente();
  const [dialogOpen, setDialogOpen] = useState(false);
  const jsDay = new Date(fecha + "T12:00:00").getDay();
  const dia = jsDay === 0 ? 0 : jsDay - 1;

  const bloquesQ = useQuery({
    queryKey: ["bloques", colegioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bloques").select("id, nombre, hora, orden").eq("colegio_id", colegioId).order("orden");
      if (error) throw error;
      return (data ?? []) as Bloque[];
    },
  });

  const misSlotsQ = useQuery({
    queryKey: ["mis-slots-curso", cursoId, docente?.id, dia],
    enabled: !!docente?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_slots")
        .select("id, slot, asignatura_id, docente_id, asistente_id")
        .eq("curso_id", cursoId)
        .eq("dia", dia)
        .or(`docente_id.eq.${docente!.id},asistente_id.eq.${docente!.id}`);
      if (error) throw error;
      return (data ?? []) as SlotMio[];
    },
  });

  const eventosQ = useQuery({
    queryKey: ["eventos-bloque", cursoId, fecha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos_bloque")
        .select("id, alumno_id, slot, tipo, observacion, docente_id, asignatura_id")
        .eq("curso_id", cursoId).eq("fecha", fecha)
        .order("slot");
      if (error) throw error;
      return (data ?? []) as Evento[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eventos_bloque").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eventos-bloque", cursoId, fecha] }),
    onError: (e) => toast.error(handleDbError(e)),
  });

  const slotsDisponibles = misSlotsQ.data ?? [];
  const bMap = Object.fromEntries((bloquesQ.data ?? []).map((b) => [b.orden, b]));
  const aMap = Object.fromEntries(alumnos.map((a) => [a.id, a]));

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Eventos por bloque</h3>
          <p className="text-xs text-muted-foreground">Retiros, atrasos y observaciones que NO modifican la asistencia oficial del día.</p>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          disabled={slotsDisponibles.length === 0 || alumnos.length === 0}
          title={slotsDisponibles.length === 0 ? "No tienes clases asignadas a este curso este día" : undefined}
        >
          <Plus className="w-4 h-4 mr-1.5" /> Nuevo evento
        </Button>
      </div>

      {(eventosQ.data ?? []).length === 0 ? (
        <div className="text-xs text-muted-foreground bg-surface border border-border rounded-xl p-4">
          Sin eventos registrados este día.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Bloque</th>
                <th className="text-left px-3 py-2">Alumno</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Observación</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {(eventosQ.data ?? []).map((ev) => (
                <tr key={ev.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs">{bMap[ev.slot]?.hora ?? `Bloque ${ev.slot + 1}`}</td>
                  <td className="px-3 py-2">{aMap[ev.alumno_id] ? `${aMap[ev.alumno_id].apellidos}, ${aMap[ev.alumno_id].nombres}` : "—"}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-surface-2">{EVENTO_LABELS[ev.tipo]}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{ev.observacion ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(ev.id)}><Trash2 className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {slotsDisponibles.length === 0 && docente && (
        <div className="mt-2 text-xs text-amber-400 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> No tienes bloques asignados a este curso este día.
        </div>
      )}

      <EventoDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        slots={slotsDisponibles}
        bloques={bloquesQ.data ?? []}
        alumnos={alumnos}
        onSubmit={async (payload) => {
          try {
            const { error } = await supabase.from("eventos_bloque").insert({
              colegio_id: colegioId, curso_id: cursoId, fecha,
              alumno_id: payload.alumno_id, slot: payload.slot, tipo: payload.tipo,
              asignatura_id: payload.asignatura_id, docente_id: docente?.id ?? null,
              observacion: payload.observacion || null, registrado_por: docente?.id ?? null,
            } as never);
            if (error) throw error;
            toast.success("Evento registrado");
            setDialogOpen(false);
            qc.invalidateQueries({ queryKey: ["eventos-bloque", cursoId, fecha] });
          } catch (e) { toast.error(handleDbError(e)); }
        }}
      />
    </div>
  );
}

function EventoDialog({ open, onClose, slots, bloques, alumnos, onSubmit }: {
  open: boolean; onClose: () => void;
  slots: SlotMio[]; bloques: Bloque[];
  alumnos: { id: string; nombres: string; apellidos: string; numero_lista: number | null }[];
  onSubmit: (p: { alumno_id: string; slot: number; tipo: EventoTipo; asignatura_id: string | null; observacion: string }) => void;
}) {
  const [alumnoId, setAlumnoId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [tipo, setTipo] = useState<EventoTipo>("retiro");
  const [obs, setObs] = useState("");
  const bMap = Object.fromEntries(bloques.map((b) => [b.orden, b]));
  const selected = slots.find((s) => s.id === slotId);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setAlumnoId(""); setSlotId(""); setObs(""); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo evento de bloque</DialogTitle></DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!alumnoId || !selected) return;
            onSubmit({ alumno_id: alumnoId, slot: selected.slot, tipo, asignatura_id: selected.asignatura_id, observacion: obs });
          }}
        >
          <div className="space-y-1.5">
            <Label>Bloque</Label>
            <Select value={slotId} onValueChange={setSlotId}>
              <SelectTrigger><SelectValue placeholder="Selecciona un bloque" /></SelectTrigger>
              <SelectContent>
                {slots.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {bMap[s.slot]?.hora ?? `Bloque ${s.slot + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Alumno</Label>
            <Select value={alumnoId} onValueChange={setAlumnoId}>
              <SelectTrigger><SelectValue placeholder="Selecciona un alumno" /></SelectTrigger>
              <SelectContent>
                {alumnos.map((a) => <SelectItem key={a.id} value={a.id}>{a.apellidos}, {a.nombres}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as EventoTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(EVENTO_LABELS) as EventoTipo[]).map((t) => (
                  <SelectItem key={t} value={t}>{EVENTO_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Observación</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!alumnoId || !slotId}>Registrar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
