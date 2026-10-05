import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NotebookPen, Plus, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCursosVisibles } from "@/lib/use-cursos-visibles";
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
import { handleDbError } from "@/lib/db-errors";

export const Route = createFileRoute("/calificaciones")({
  head: () => ({ meta: [{ title: "Calificaciones — HorarioES" }] }),
  component: CalificacionesPage,
});

interface Alumno { id: string; nombres: string; apellidos: string; numero_lista: number | null }
interface Asignatura { id: string; nombre: string; color: string }
interface Nota {
  id: string; alumno_id: string; nota: number;
  descripcion: string | null; fecha: string; ponderacion: number;
}

interface Evaluacion {
  key: string;
  descripcion: string;
  fecha: string;
  ponderacion: number;
  notas: Record<string, Nota>; // alumno_id -> nota
}

type DialogState =
  | { mode: "new" }
  | { mode: "edit"; evalKey: string };

const evalKeyOf = (descripcion: string, fecha: string, ponderacion: number) =>
  `${descripcion}__${fecha}__${ponderacion}`;

function CalificacionesPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const qc = useQueryClient();
  const cursos = useCursosVisibles();
  const [cursoId, setCursoId] = useState("");
  const [asigId, setAsigId] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);

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

  const alumnosQ = useQuery({
    queryKey: ["alumnos", cursoId],
    enabled: !!cursoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alumnos").select("id, nombres, apellidos, numero_lista")
        .eq("curso_id", cursoId).is("retirado_en", null)
        .order("numero_lista", { nullsFirst: false }).order("apellidos");
      if (error) throw error;
      return (data ?? []) as Alumno[];
    },
  });

  const notasQ = useQuery({
    queryKey: ["calificaciones", cursoId, asigId],
    enabled: !!cursoId && !!asigId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calificaciones")
        .select("id, alumno_id, nota, descripcion, fecha, ponderacion")
        .eq("curso_id", cursoId).eq("asignatura_id", asigId)
        .order("fecha", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Nota[];
    },
  });

  // Agrupa notas en evaluaciones (columnas)
  const evaluaciones = useMemo<Evaluacion[]>(() => {
    const map = new Map<string, Evaluacion>();
    (notasQ.data ?? []).forEach((n) => {
      const desc = n.descripcion ?? "Sin descripción";
      const pond = Number(n.ponderacion ?? 1);
      const key = evalKeyOf(desc, n.fecha, pond);
      let ev = map.get(key);
      if (!ev) {
        ev = { key, descripcion: desc, fecha: n.fecha, ponderacion: pond, notas: {} };
        map.set(key, ev);
      }
      ev.notas[n.alumno_id] = n;
    });
    return Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [notasQ.data]);

  const evalByKey = useMemo(() => {
    const m: Record<string, Evaluacion> = {};
    evaluaciones.forEach((e) => { m[e.key] = e; });
    return m;
  }, [evaluaciones]);

  const invalidateNotas = () => qc.invalidateQueries({ queryKey: ["calificaciones", cursoId, asigId] });

  // Promedio ponderado por alumno
  const promedio = (alumnoId: string) => {
    let sum = 0, w = 0;
    evaluaciones.forEach((ev) => {
      const n = ev.notas[alumnoId];
      if (!n) return;
      sum += Number(n.nota) * ev.ponderacion;
      w += ev.ponderacion;
    });
    return w ? (sum / w).toFixed(1) : "—";
  };

  const shortFecha = (f: string) => {
    const [, m, d] = f.split("-");
    return d && m ? `${d}/${m}` : f;
  };

  const saveEval = useMutation({
    mutationFn: async (payload: {
      original?: Evaluacion;
      descripcion: string;
      fecha: string;
      ponderacion: number;
      notas: Record<string, number | null>; // alumno_id -> nota (null = eliminar/sin nota)
    }) => {
      if (!colegioId) throw new Error("Sin colegio");
      const { original, descripcion, fecha, ponderacion, notas } = payload;

      const toInsert: Array<{
        colegio_id: string; curso_id: string; alumno_id: string;
        asignatura_id: string; nota: number; descripcion: string;
        fecha: string; ponderacion: number;
      }> = [];
      const toUpdate: Array<{ id: string; nota: number; descripcion: string; fecha: string; ponderacion: number }> = [];
      const toDelete: string[] = [];

      for (const [alumnoId, nota] of Object.entries(notas)) {
        const existing = original?.notas[alumnoId];
        if (nota == null) {
          if (existing) toDelete.push(existing.id);
        } else if (existing) {
          toUpdate.push({ id: existing.id, nota, descripcion, fecha, ponderacion });
        } else {
          toInsert.push({
            colegio_id: colegioId, curso_id: cursoId, alumno_id: alumnoId,
            asignatura_id: asigId, nota, descripcion, fecha, ponderacion,
          });
        }
      }

      // Si renombran/cambian fecha/ponderación sin tocar la nota, también propagar
      if (original) {
        const metaChanged = original.descripcion !== descripcion
          || original.fecha !== fecha
          || original.ponderacion !== ponderacion;
        if (metaChanged) {
          for (const [alumnoId, existing] of Object.entries(original.notas)) {
            if (alumnoId in notas) continue; // ya manejado arriba
            toUpdate.push({
              id: existing.id, nota: Number(existing.nota),
              descripcion, fecha, ponderacion,
            });
          }
        }
      }

      if (toInsert.length) {
        const { error } = await supabase.from("calificaciones").insert(toInsert as never);
        if (error) throw error;
      }
      for (const u of toUpdate) {
        const { error } = await supabase.from("calificaciones")
          .update({ nota: u.nota, descripcion: u.descripcion, fecha: u.fecha, ponderacion: u.ponderacion } as never)
          .eq("id", u.id);
        if (error) throw error;
      }
      if (toDelete.length) {
        const { error } = await supabase.from("calificaciones").delete().in("id", toDelete);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidateNotas(); setDialog(null); toast.success("Evaluación guardada"); },
    onError: (e) => toast.error(handleDbError(e)),
  });

  const delEval = useMutation({
    mutationFn: async (ev: Evaluacion) => {
      const ids = Object.values(ev.notas).map((n) => n.id);
      if (!ids.length) return;
      const { error } = await supabase.from("calificaciones").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { invalidateNotas(); toast.success("Evaluación eliminada"); },
    onError: (e) => toast.error(handleDbError(e)),
  });

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Notas" subtitle="Escala chilena 1.0 — 7.0 con ponderación" />
        <Button
          onClick={() => setDialog({ mode: "new" })}
          disabled={!cursoId || !asigId}
          className="mt-2"
        >
          <Plus className="w-4 h-4 mr-1" /> Nueva evaluación
        </Button>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Curso</Label>
          <Select value={cursoId} onValueChange={setCursoId}>
            <SelectTrigger><SelectValue placeholder="Selecciona curso" /></SelectTrigger>
            <SelectContent>
              {(cursos.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Asignatura</Label>
          <Select value={asigId} onValueChange={setAsigId}>
            <SelectTrigger><SelectValue placeholder="Selecciona asignatura" /></SelectTrigger>
            <SelectContent>
              {(asigQ.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!cursoId || !asigId ? (
        <EmptyState icon={NotebookPen} title="Elige curso y asignatura" description="Para ver y registrar notas." />
      ) : alumnosQ.isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : (alumnosQ.data ?? []).length === 0 ? (
        <EmptyState icon={NotebookPen} title="Sin alumnos" description="Importa alumnos al curso primero." />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2 w-12 sticky left-0 bg-surface-2">N°</th>
                <th className="text-left px-3 py-2 min-w-[200px] sticky left-12 bg-surface-2">Alumno</th>
                {evaluaciones.map((ev) => (
                  <th key={ev.key} className="px-3 py-2 min-w-[140px] text-center align-top">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => setDialog({ mode: "edit", evalKey: ev.key })}
                        className="font-medium normal-case text-foreground hover:underline truncate max-w-[140px]"
                        title={ev.descripcion}
                      >
                        {ev.descripcion}
                      </button>
                      <span className="text-[10px] font-mono normal-case text-muted-foreground">
                        {ev.fecha} · x{ev.ponderacion}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setDialog({ mode: "edit", evalKey: ev.key })}
                          className="text-muted-foreground hover:text-foreground" title="Editar"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Eliminar evaluación "${ev.descripcion}"?`)) delEval.mutate(ev);
                          }}
                          className="text-muted-foreground hover:text-destructive" title="Eliminar"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2 text-right min-w-[90px]">Promedio</th>
              </tr>
            </thead>
            <tbody>
              {alumnosQ.data!.map((al) => (
                <tr key={al.id} className="border-t border-border">
                  <td className="px-3 py-2 text-muted-foreground sticky left-0 bg-surface">{al.numero_lista ?? "—"}</td>
                  <td className="px-3 py-2 font-medium sticky left-12 bg-surface">{al.apellidos}, {al.nombres}</td>
                  {evaluaciones.map((ev) => {
                    const n = ev.notas[al.id];
                    if (!n) return <td key={ev.key} className="px-3 py-2 text-center text-muted-foreground">—</td>;
                    const positive = Number(n.nota) >= 4;
                    return (
                      <td key={ev.key} className="px-3 py-2 text-center">
                        <span className={`font-mono font-semibold ${positive ? "text-emerald-500" : "text-red-500"}`}>
                          {Number(n.nota).toFixed(1)}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-mono font-semibold">{promedio(al.id)}</td>
                </tr>
              ))}
            </tbody>
            {evaluaciones.length === 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground text-xs">
                    Aún no hay evaluaciones. Crea una con “Nueva evaluación”.
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <EvaluacionDialog
        state={dialog}
        alumnos={alumnosQ.data ?? []}
        evaluacion={dialog?.mode === "edit" ? evalByKey[dialog.evalKey] : undefined}
        loading={saveEval.isPending}
        onClose={() => setDialog(null)}
        onSubmit={(payload) => saveEval.mutate(payload)}
        shortFecha={shortFecha}
      />
    </div>
  );
}

function EvaluacionDialog({
  state, alumnos, evaluacion, loading, onClose, onSubmit,
}: {
  state: DialogState | null;
  alumnos: Alumno[];
  evaluacion?: Evaluacion;
  loading: boolean;
  onClose: () => void;
  onSubmit: (p: {
    original?: Evaluacion;
    descripcion: string; fecha: string; ponderacion: number;
    notas: Record<string, number | null>;
  }) => void;
  shortFecha: (f: string) => string;
}) {
  const isEdit = state?.mode === "edit";
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [ponderacion, setPonderacion] = useState("1");
  const [notas, setNotas] = useState<Record<string, string>>({});

  // Reinicia el form al abrir
  useEffect(() => {
    if (!state) return;
    if (isEdit && evaluacion) {
      setDescripcion(evaluacion.descripcion);
      setFecha(evaluacion.fecha);
      setPonderacion(String(evaluacion.ponderacion));
      const initial: Record<string, string> = {};
      alumnos.forEach((a) => {
        const n = evaluacion.notas[a.id];
        initial[a.id] = n ? String(Number(n.nota)) : "";
      });
      setNotas(initial);
    } else {
      setDescripcion("");
      setFecha(new Date().toISOString().slice(0, 10));
      setPonderacion("1");
      const initial: Record<string, string> = {};
      alumnos.forEach((a) => { initial[a.id] = ""; });
      setNotas(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, evaluacion?.key]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const desc = descripcion.trim();
    if (!desc) { toast.error("Describe la evaluación"); return; }
    if (!fecha) { toast.error("Fecha requerida"); return; }
    const pond = Number(String(ponderacion).replace(",", "."));
    if (!Number.isFinite(pond) || pond <= 0) { toast.error("Ponderación inválida"); return; }

    const parsed: Record<string, number | null> = {};
    for (const a of alumnos) {
      const raw = (notas[a.id] ?? "").trim().replace(",", ".");
      if (!raw) { parsed[a.id] = null; continue; }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 1 || n > 7) {
        toast.error(`Nota inválida para ${a.apellidos}, ${a.nombres}`); return;
      }
      parsed[a.id] = Math.round(n * 10) / 10;
    }

    onSubmit({
      original: isEdit ? evaluacion : undefined,
      descripcion: desc, fecha, ponderacion: pond, notas: parsed,
    });
  };

  return (
    <Dialog open={!!state} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar evaluación" : "Nueva evaluación"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descripción *</Label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Prueba unidad 1" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Ponderación (peso)</Label>
              <Input type="number" step="0.1" min="0.1" value={ponderacion} onChange={(e) => setPonderacion(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notas (1.0 a 7.0) — deja vacío para eliminar</Label>
            <div className="max-h-[320px] overflow-y-auto border border-border rounded-md divide-y divide-border">
              {alumnos.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="text-xs text-muted-foreground w-6">{a.numero_lista ?? "—"}</span>
                  <span className="flex-1 text-sm">{a.apellidos}, {a.nombres}</span>
                  <Input
                    type="number" step="0.1" min="1" max="7"
                    inputMode="decimal"
                    className="w-20 h-8 text-right font-mono"
                    value={notas[a.id] ?? ""}
                    onChange={(e) => setNotas((p) => ({ ...p, [a.id]: e.target.value }))}
                    placeholder="—"
                  />
                </div>
              ))}
              {alumnos.length === 0 && (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">Sin alumnos</div>
              )}
            </div>
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
