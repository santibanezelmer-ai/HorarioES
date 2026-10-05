import { handleDbError } from "@/lib/db-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Trash2, Printer, CalendarDays, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/db-retry";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { printFit } from "@/lib/print";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { GeneradorHorarioModal } from "@/components/GeneradorHorarioModal";
import type { DocenteBlockInfo } from "@/lib/horario-generator";

export const Route = createFileRoute("/horarios")({
  head: () => ({ meta: [{ title: "Horarios — HorarioES" }] }),
  component: HorariosPage,
});

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const NONE = "__none__";

interface Bloque {
  id: string; nombre: string; hora: string; orden: number;
  tipo: "clase" | "recreo" | "almuerzo";
}
interface Curso {
  id: string;
  nombre: string;
  nivel: string;
  prof_jefe_id: string | null;
  asignaturas?: Record<string, number> | null;
  titulares?: Record<string, string> | null;
}
interface Docente {
  id: string;
  nombre: string;
  color: string;
  dias?: number[];
  horas_utp?: number | null;
}
interface Asignatura { id: string; nombre: string; color: string; }
interface Espacio { id: string; nombre: string; color: string; }
interface Slot {
  id: string;
  curso_id: string;
  dia: number;
  slot: number;
  docente_id: string | null;
  asignatura_id: string | null;
  espacio_id: string | null;
}

function HorariosPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<"curso" | "docente">("curso");
  const [cursoId, setCursoId] = useState<string>("");
  const [docenteViewId, setDocenteViewId] = useState<string>("");
  const [editing, setEditing] = useState<{ dia: number; slot: number; current?: Slot } | null>(null);
  const [printScope, setPrintScope] = useState<"current" | "all">("current");
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);

  const { data: colegio } = useQuery({
    queryKey: ["colegio-print", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase.from("colegios").select("id, nombre, logo_url, viernes_max_slot").eq("id", colegioId!).maybeSingle()
      );
      if (error) throw error;
      return data as { id: string; nombre: string; logo_url: string | null; viernes_max_slot: number | null } | null;
    },
  });

  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-min", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase.from("cursos")
          .select("id, nombre, nivel, prof_jefe_id, asignaturas, titulares").eq("colegio_id", colegioId!).order("nombre")
      );
      if (error) throw error;
      return data as Curso[];
    },
  });

  const { data: bloques = [] } = useQuery({
    queryKey: ["bloques", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase.from("bloques")
          .select("id, nombre, hora, orden, tipo").eq("colegio_id", colegioId!).order("orden")
      );
      if (error) throw error;
      return data as Bloque[];
    },
  });

  const { data: docentes = [] } = useQuery({
    queryKey: ["docentes-min", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase.from("docentes")
          .select("id, nombre, color, dias, horas_utp").eq("colegio_id", colegioId!).order("nombre")
      );
      if (error) throw error;
      return data as Docente[];
    },
  });

  const { data: docenteBlocks = [] } = useQuery({
    queryKey: ["docente-blocks", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase.from("docente_blocks")
          .select("docente_id, dia, slot, motivo")
          .eq("colegio_id", colegioId!)
      );
      if (error) throw error;
      return data as DocenteBlockInfo[];
    },
  });

  const { data: asignaturas = [] } = useQuery({
    queryKey: ["asignaturas-min", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase.from("asignaturas")
          .select("id, nombre, color").eq("colegio_id", colegioId!).order("nombre")
      );
      if (error) throw error;
      return data as Asignatura[];
    },
  });

  const { data: espacios = [] } = useQuery({
    queryKey: ["espacios-min", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase.from("espacios")
          .select("id, nombre, color").eq("colegio_id", colegioId!).order("nombre")
      );
      if (error) throw error;
      return data as Espacio[];
    },
  });

  // Todos los slots del colegio (para detectar conflictos cruzando cursos)
  const { data: allSlots = [] } = useQuery({
    queryKey: ["schedule-slots", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase.from("schedule_slots")
          .select("id, curso_id, dia, slot, docente_id, asignatura_id, espacio_id")
          .eq("colegio_id", colegioId!)
      );
      if (error) throw error;
      return data as Slot[];
    },
  });

  // Auto-seleccionar primer curso
  useEffect(() => {
    if (!cursoId && cursos.length > 0) setCursoId(cursos[0].id);
  }, [cursoId, cursos]);

  // Auto-seleccionar primer docente
  useEffect(() => {
    if (!docenteViewId && docentes.length > 0) setDocenteViewId(docentes[0].id);
  }, [docenteViewId, docentes]);

  const slotsByCell = useMemo(() => {
    const m = new Map<string, Slot>();
    for (const s of allSlots) {
      if (s.curso_id === cursoId) m.set(`${s.dia}-${s.slot}`, s);
    }
    return m;
  }, [allSlots, cursoId]);

  // Slots agrupados por celda para el docente seleccionado (puede haber colisiones → array)
  const slotsByCellDocente = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of allSlots) {
      if (s.docente_id === docenteViewId) {
        const k = `${s.dia}-${s.slot}`;
        const arr = m.get(k) ?? [];
        arr.push(s);
        m.set(k, arr);
      }
    }
    return m;
  }, [allSlots, docenteViewId]);

  // Conflictos: mismo (dia, slot) con mismo docente o mismo espacio en distintos cursos
  const conflicts = useMemo(() => {
    const docMap = new Map<string, Slot[]>();
    const espMap = new Map<string, Slot[]>();
    for (const s of allSlots) {
      if (s.docente_id) {
        const k = `D-${s.dia}-${s.slot}-${s.docente_id}`;
        const arr = docMap.get(k) ?? []; arr.push(s); docMap.set(k, arr);
      }
      if (s.espacio_id) {
        const k = `E-${s.dia}-${s.slot}-${s.espacio_id}`;
        const arr = espMap.get(k) ?? []; arr.push(s); espMap.set(k, arr);
      }
    }
    const conflictedSlotIds = new Set<string>();
    for (const arr of docMap.values()) if (arr.length > 1) arr.forEach((s) => conflictedSlotIds.add(s.id));
    for (const arr of espMap.values()) if (arr.length > 1) arr.forEach((s) => conflictedSlotIds.add(s.id));
    return conflictedSlotIds;
  }, [allSlots]);

  const upsertSlot = useMutation({
    mutationFn: async (payload: {
      dia: number; slot: number;
      docente_id: string | null; asignatura_id: string | null; espacio_id: string | null;
      existingId?: string;
    }) => {
      if (payload.existingId) {
        const { error } = await supabase.from("schedule_slots").update({
          docente_id: payload.docente_id,
          asignatura_id: payload.asignatura_id,
          espacio_id: payload.espacio_id,
        }).eq("id", payload.existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("schedule_slots").insert({
          colegio_id: colegioId!,
          curso_id: cursoId,
          dia: payload.dia,
          slot: payload.slot,
          docente_id: payload.docente_id,
          asignatura_id: payload.asignatura_id,
          espacio_id: payload.espacio_id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule-slots", colegioId] });
      setEditing(null);
      toast.success("Asignación guardada");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  const removeSlot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule-slots", colegioId] });
      setEditing(null);
      toast.success("Asignación eliminada");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  const docMap = useMemo(() => Object.fromEntries(docentes.map((d) => [d.id, d])), [docentes]);
  const asgMap = useMemo(() => Object.fromEntries(asignaturas.map((a) => [a.id, a])), [asignaturas]);
  const espMap = useMemo(() => Object.fromEntries(espacios.map((e) => [e.id, e])), [espacios]);
  const cursoMap = useMemo(() => Object.fromEntries(cursos.map((c) => [c.id, c])), [cursos]);

  const conflictCount = useMemo(() => {
    return new Set(allSlots.filter((s) => conflicts.has(s.id)).map((s) => `${s.dia}-${s.slot}-${s.docente_id ?? ""}-${s.espacio_id ?? ""}`)).size;
  }, [allSlots, conflicts]);

  if (cursos.length === 0 || bloques.length === 0) {
    return (
      <div>
        <PageHeader title="Horarios" subtitle="Grilla curso × día × bloque" />
        <EmptyState
          icon={CalendarDays}
          title="Faltan datos"
          description="Necesitas al menos un curso y un bloque horario configurados antes de armar la grilla."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Horarios"
        subtitle="Asigna docente, asignatura y espacio en cada celda"
        actions={
          <div className="flex items-center gap-2 no-print">
            {conflictCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-400 px-2 py-1 rounded-md bg-amber-500/10">
                <AlertTriangle className="w-3.5 h-3.5" /> {conflictCount} conflicto{conflictCount === 1 ? "" : "s"}
              </span>
            )}
            {viewMode === "curso" && (
              <div className="w-40">
                <Select value={printScope} onValueChange={(v) => setPrintScope(v as "current" | "all")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Solo curso actual</SelectItem>
                    <SelectItem value="all">Todos los cursos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => printFit("print-area", "landscape")}>
              <Printer className="w-4 h-4 mr-2" /> Imprimir
            </Button>
            <Button
              size="sm"
              onClick={() => setIsGenModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm font-medium"
            >
              <Wand2 className="w-4 h-4" /> Generar Horario
            </Button>
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("curso")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "curso" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              >
                Por curso
              </button>
              <button
                type="button"
                onClick={() => setViewMode("docente")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "docente" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              >
                Por docente
              </button>
            </div>
            {viewMode === "curso" ? (
              <div className="w-56">
                <Select value={cursoId} onValueChange={setCursoId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {cursos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre} <span className="text-muted-foreground capitalize">· {c.nivel}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="w-56">
                <Select value={docenteViewId} onValueChange={setDocenteViewId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona docente" /></SelectTrigger>
                  <SelectContent>
                    {docentes.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: d.color }} />
                        {d.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        }
      />

      {viewMode === "curso" ? (
        <div className="overflow-x-auto bg-surface border border-border rounded-xl no-print">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-xs font-medium text-muted-foreground p-2 text-left w-32 border-b border-border">Bloque</th>
                {DIAS.map((d) => (
                  <th key={d} className="text-xs font-medium text-muted-foreground p-2 text-left border-b border-border">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloques.map((b, slotIdx) => {
                const isClase = b.tipo === "clase";
                return (
                  <tr key={b.id} className="border-b border-border last:border-0">
                    <td className="p-2 align-top">
                      <div className="font-medium text-sm">{b.nombre}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{b.hora}</div>
                      {!isClase && (
                        <div className="text-[10px] text-muted-foreground capitalize mt-1">{b.tipo}</div>
                      )}
                    </td>
                    {DIAS.map((_, dia) => {
                      if (!isClase) {
                        return (
                          <td key={dia} className="p-1 align-top">
                            <div className="rounded-md bg-muted/30 h-16 flex items-center justify-center text-[10px] text-muted-foreground capitalize">
                              {b.tipo}
                            </div>
                          </td>
                        );
                      }
                      const cell = slotsByCell.get(`${dia}-${slotIdx}`);
                      const doc = cell?.docente_id ? docMap[cell.docente_id] : null;
                      const asg = cell?.asignatura_id ? asgMap[cell.asignatura_id] : null;
                      const esp = cell?.espacio_id ? espMap[cell.espacio_id] : null;
                      const hasConflict = cell ? conflicts.has(cell.id) : false;
                      return (
                        <td key={dia} className="p-1 align-top">
                          <button
                            type="button"
                            onClick={() => setEditing({ dia, slot: slotIdx, current: cell })}
                            className={`w-full text-left rounded-md h-16 px-2 py-1.5 transition-all border text-xs ${
                              cell
                                ? hasConflict
                                  ? "border-amber-500/60 bg-amber-500/10"
                                  : "border-border bg-background hover:border-primary"
                                : "border-dashed border-border/50 hover:border-primary hover:bg-surface"
                            }`}
                            style={cell && asg && !hasConflict ? { borderLeft: `3px solid ${asg.color}` } : undefined}
                          >
                            {cell ? (
                              <div className="space-y-0.5">
                                {hasConflict && (
                                  <div className="flex items-center gap-1 text-[9px] text-amber-400 font-medium">
                                    <AlertTriangle className="w-2.5 h-2.5" /> Conflicto
                                  </div>
                                )}
                                {asg && <div className="font-medium truncate" style={{ color: asg.color }}>{asg.nombre}</div>}
                                {doc && <div className="text-muted-foreground truncate">{doc.nombre}</div>}
                                {esp && <div className="text-[10px] text-muted-foreground truncate">📍 {esp.nombre}</div>}
                              </div>
                            ) : (
                              <span className="text-muted-foreground/60">+</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto bg-surface border border-border rounded-xl no-print">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-xs font-medium text-muted-foreground p-2 text-left w-32 border-b border-border">Bloque</th>
                {DIAS.map((d) => (
                  <th key={d} className="text-xs font-medium text-muted-foreground p-2 text-left border-b border-border">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloques.map((b, slotIdx) => {
                const isClase = b.tipo === "clase";
                return (
                  <tr key={b.id} className="border-b border-border last:border-0">
                    <td className="p-2 align-top">
                      <div className="font-medium text-sm">{b.nombre}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{b.hora}</div>
                      {!isClase && (
                        <div className="text-[10px] text-muted-foreground capitalize mt-1">{b.tipo}</div>
                      )}
                    </td>
                    {DIAS.map((_, dia) => {
                      if (!isClase) {
                        return (
                          <td key={dia} className="p-1 align-top">
                            <div className="rounded-md bg-muted/30 h-16 flex items-center justify-center text-[10px] text-muted-foreground capitalize">
                              {b.tipo}
                            </div>
                          </td>
                        );
                      }
                      const cellsHere = slotsByCellDocente.get(`${dia}-${slotIdx}`) ?? [];
                      const isMulti = cellsHere.length > 1;
                      return (
                        <td key={dia} className="p-1 align-top">
                          {cellsHere.length === 0 ? (
                            <div className="w-full rounded-md h-16 px-2 py-1.5 border border-dashed border-border/50 text-xs text-muted-foreground/60 flex items-center justify-center">
                              libre
                            </div>
                          ) : (
                            <div className={`w-full rounded-md h-16 px-2 py-1.5 border text-xs space-y-0.5 overflow-hidden ${
                              isMulti ? "border-amber-500/60 bg-amber-500/10" : "border-border bg-background"
                            }`}
                              style={!isMulti && cellsHere[0].asignatura_id ? { borderLeft: `3px solid ${asgMap[cellsHere[0].asignatura_id]?.color ?? "transparent"}` } : undefined}
                            >
                              {isMulti && (
                                <div className="flex items-center gap-1 text-[9px] text-amber-400 font-medium">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Conflicto
                                </div>
                              )}
                              {cellsHere.map((c) => {
                                const curso = cursoMap[c.curso_id];
                                const asg = c.asignatura_id ? asgMap[c.asignatura_id] : null;
                                const esp = c.espacio_id ? espMap[c.espacio_id] : null;
                                return (
                                  <div key={c.id} className="leading-tight">
                                    {asg && <div className="font-medium truncate" style={{ color: asg.color }}>{asg.nombre}</div>}
                                    <div className="text-muted-foreground truncate">{curso?.nombre ?? "—"}</div>
                                    {esp && <div className="text-[10px] text-muted-foreground truncate">📍 {esp.nombre}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PrintArea
        mode={viewMode}
        colegio={colegio ?? null}
        cursos={viewMode === "docente" ? cursos : (printScope === "all" ? cursos : cursos.filter((c) => c.id === cursoId))}
        docenteSel={viewMode === "docente" ? (docMap[docenteViewId] ?? null) : null}
        bloques={bloques}
        allSlots={allSlots}
        docentes={docentes}
        asignaturas={asignaturas}
        docMap={docMap}
        asgMap={asgMap}
        espMap={espMap}
        cursoMap={cursoMap}
      />

      {editing && (
        <SlotDialog
          editing={editing}
          docentes={docentes}
          asignaturas={asignaturas}
          espacios={espacios}
          onClose={() => setEditing(null)}
          onSubmit={(p) => upsertSlot.mutate({
            dia: editing.dia, slot: editing.slot,
            docente_id: p.docente_id, asignatura_id: p.asignatura_id, espacio_id: p.espacio_id,
            existingId: editing.current?.id,
          })}
          onDelete={editing.current ? () => removeSlot.mutate(editing.current!.id) : undefined}
          loading={upsertSlot.isPending || removeSlot.isPending}
        />
      )}

      {isGenModalOpen && (
        <GeneradorHorarioModal
          open={isGenModalOpen}
          onOpenChange={setIsGenModalOpen}
          colegioId={colegioId!}
          cursoActualId={cursoId}
          cursos={cursos}
          bloques={bloques}
          docentes={docentes}
          asignaturas={asignaturas}
          allSlots={allSlots}
          docenteBlocks={docenteBlocks}
          viernesMaxSlot={colegio?.viernes_max_slot ?? null}
          onApplySuccess={() => {
            qc.invalidateQueries({ queryKey: ["schedule-slots", colegioId] });
            qc.invalidateQueries({ queryKey: ["cursos-min", colegioId] });
          }}
        />
      )}
    </div>
  );
}

function SlotDialog({
  editing, docentes, asignaturas, espacios, onClose, onSubmit, onDelete, loading,
}: {
  editing: { dia: number; slot: number; current?: Slot };
  docentes: Docente[];
  asignaturas: Asignatura[];
  espacios: Espacio[];
  onClose: () => void;
  onSubmit: (p: { docente_id: string | null; asignatura_id: string | null; espacio_id: string | null }) => void;
  onDelete?: () => void;
  loading: boolean;
}) {
  const [docId, setDocId] = useState<string>(editing.current?.docente_id ?? NONE);
  const [asgId, setAsgId] = useState<string>(editing.current?.asignatura_id ?? NONE);
  const [espId, setEspId] = useState<string>(editing.current?.espacio_id ?? NONE);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{DIAS[editing.dia]} · Bloque {editing.slot + 1}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              docente_id: docId === NONE ? null : docId,
              asignatura_id: asgId === NONE ? null : asgId,
              espacio_id: espId === NONE ? null : espId,
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Asignatura</Label>
            <Select value={asgId} onValueChange={setAsgId}>
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin asignar</SelectItem>
                {asignaturas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: a.color }} />
                    {a.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Docente</Label>
            <Select value={docId} onValueChange={setDocId}>
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin asignar</SelectItem>
                {docentes.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: d.color }} />
                    {d.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Espacio <span className="text-muted-foreground">(opcional)</span></Label>
            <Select value={espId} onValueChange={setEspId}>
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin asignar</SelectItem>
                {espacios.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="flex sm:justify-between gap-2">
            {onDelete ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={onDelete} disabled={loading}>
                <Trash2 className="w-4 h-4 mr-2" /> Vaciar
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PrintArea({
  mode, colegio, cursos, docenteSel, bloques, allSlots, docentes, asignaturas, docMap, asgMap, espMap, cursoMap,
}: {
  mode: "curso" | "docente";
  colegio: { id: string; nombre: string; logo_url: string | null } | null;
  cursos: Curso[];
  docenteSel: Docente | null;
  bloques: Bloque[];
  allSlots: Slot[];
  docentes: Docente[];
  asignaturas: Asignatura[];
  docMap: Record<string, Docente>;
  asgMap: Record<string, Asignatura>;
  espMap: Record<string, Espacio>;
  cursoMap: Record<string, Curso>;
}) {
  if (mode === "docente") {
    if (!docenteSel) return <div id="print-area" className="hidden print:block" />;
    const cells = new Map<string, Slot>();
    const asgCount = new Map<string, number>();
    const cursoCount = new Map<string, number>();
    for (const s of allSlots) {
      if (s.docente_id === docenteSel.id) {
        cells.set(`${s.dia}-${s.slot}`, s);
        if (s.asignatura_id) asgCount.set(s.asignatura_id, (asgCount.get(s.asignatura_id) ?? 0) + 1);
        cursoCount.set(s.curso_id, (cursoCount.get(s.curso_id) ?? 0) + 1);
      }
    }
    const usedAsignaturas = asignaturas.filter((a) => asgCount.has(a.id));
    const usedCursos = cursos.filter((c) => cursoCount.has(c.id));
    const cursosJefe = cursos.filter((c) => c.prof_jefe_id === docenteSel.id);
    const totalHoras = Array.from(cursoCount.values()).reduce((a, b) => a + b, 0);

    return (
      <div id="print-area" className="hidden print:block">
        <div className="print-header">
          {colegio?.logo_url && <img src={colegio.logo_url} alt="Logo colegio" />}
          <div>
            <div className="print-school">{colegio?.nombre ?? "Colegio"}</div>
            <div style={{ fontSize: "9pt", color: "#555" }}>Horario docente</div>
          </div>
        </div>
        <div className="print-course-title">
          <span className="print-chip" style={{ background: docenteSel.color, width: "14px", height: "14px" }} />
          {docenteSel.nombre}
        </div>
        <div className="print-jefe">
          <strong>Profesor jefe de:</strong>{" "}
          {cursosJefe.length ? cursosJefe.map((c) => c.nombre).join(", ") : "—"}
          {" · "}
          <strong>Horas semanales:</strong> {totalHoras}
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: "90px" }}>Bloque</th>
              {DIAS.map((d) => <th key={d}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {bloques.map((b, slotIdx) => {
              const isClase = b.tipo === "clase";
              return (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.nombre}</div>
                    <div style={{ fontSize: "8pt", fontFamily: "monospace" }}>{b.hora}</div>
                  </td>
                  {DIAS.map((_, dia) => {
                    if (!isClase) {
                      return <td key={dia} style={{ textAlign: "center", textTransform: "capitalize", fontStyle: "italic", background: "#f5f5f5" }}>{b.tipo}</td>;
                    }
                    const cell = cells.get(`${dia}-${slotIdx}`);
                    if (!cell) return <td key={dia}>&nbsp;</td>;
                    const asg = cell.asignatura_id ? asgMap[cell.asignatura_id] : null;
                    const curso = cursoMap[cell.curso_id];
                    const esp = cell.espacio_id ? espMap[cell.espacio_id] : null;
                    const bg = asg ? `color-mix(in oklab, ${asg.color} 18%, white)` : undefined;
                    return (
                      <td key={dia} style={{ background: bg, borderLeft: asg ? `4px solid ${asg.color}` : undefined }}>
                        <div className="print-cell-asg" style={{ fontWeight: 700 }}>{curso?.nombre ?? "—"}</div>
                        {asg && <div className="print-cell-doc" style={{ color: asg.color }}>{asg.nombre}</div>}
                        {esp && <div className="print-cell-esp">📍 {esp.nombre}</div>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="print-summary">
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "260px" }}>
              <h3>Asignaturas</h3>
              <table>
                <thead><tr><th>Asignatura</th><th style={{ width: "60px", textAlign: "right" }}>Horas</th></tr></thead>
                <tbody>
                  {usedAsignaturas.map((a) => (
                    <tr key={a.id}>
                      <td><span className="print-chip" style={{ background: a.color }} />{a.nombre}</td>
                      <td style={{ textAlign: "right" }}>{asgCount.get(a.id) ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ flex: 1, minWidth: "260px" }}>
              <h3>Cursos</h3>
              <table>
                <thead><tr><th>Curso</th><th style={{ width: "60px", textAlign: "right" }}>Horas</th></tr></thead>
                <tbody>
                  {usedCursos.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.nombre}
                        {c.prof_jefe_id === docenteSel.id && <span style={{ fontSize: "8pt", color: "#555" }}> · Prof. jefe</span>}
                      </td>
                      <td style={{ textAlign: "right" }}>{cursoCount.get(c.id) ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div id="print-area" className="hidden print:block">
      {cursos.map((curso, idx) => {
        const cells = new Map<string, Slot>();
        const docCount = new Map<string, number>();
        const asgCount = new Map<string, number>();
        for (const s of allSlots) {
          if (s.curso_id === curso.id) {
            cells.set(`${s.dia}-${s.slot}`, s);
            if (s.docente_id) docCount.set(s.docente_id, (docCount.get(s.docente_id) ?? 0) + 1);
            if (s.asignatura_id) asgCount.set(s.asignatura_id, (asgCount.get(s.asignatura_id) ?? 0) + 1);
          }
        }
        const jefe = curso.prof_jefe_id ? docMap[curso.prof_jefe_id] : null;
        const usedDocentes = docentes.filter((d) => docCount.has(d.id));
        const usedAsignaturas = asignaturas.filter((a) => asgCount.has(a.id));

        return (
          <div key={curso.id} className={idx > 0 ? "print-page-break" : ""}>
            <div className="print-header">
              {colegio?.logo_url && <img src={colegio.logo_url} alt="Logo colegio" />}
              <div>
                <div className="print-school">{colegio?.nombre ?? "Colegio"}</div>
                <div style={{ fontSize: "9pt", color: "#555" }}>Horario semanal</div>
              </div>
            </div>
            <div className="print-course-title">
              {curso.nombre} <span style={{ fontWeight: 400, fontSize: "11pt" }}>· {curso.nivel}</span>
            </div>
            <div className="print-jefe">
              <strong>Profesor jefe:</strong> {jefe ? jefe.nombre : "Sin asignar"}
            </div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "90px" }}>Bloque</th>
                  {DIAS.map((d) => <th key={d}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {bloques.map((b, slotIdx) => {
                  const isClase = b.tipo === "clase";
                  return (
                    <tr key={b.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{b.nombre}</div>
                        <div style={{ fontSize: "8pt", fontFamily: "monospace" }}>{b.hora}</div>
                      </td>
                      {DIAS.map((_, dia) => {
                        if (!isClase) {
                          return <td key={dia} style={{ textAlign: "center", textTransform: "capitalize", fontStyle: "italic", background: "#f5f5f5" }}>{b.tipo}</td>;
                        }
                        const cell = cells.get(`${dia}-${slotIdx}`);
                        if (!cell) return <td key={dia}>&nbsp;</td>;
                        const asg = cell.asignatura_id ? asgMap[cell.asignatura_id] : null;
                        const doc = cell.docente_id ? docMap[cell.docente_id] : null;
                        const esp = cell.espacio_id ? espMap[cell.espacio_id] : null;
                        const bg = asg ? `color-mix(in oklab, ${asg.color} 18%, white)` : undefined;
                        return (
                          <td key={dia} style={{
                            background: bg,
                            borderLeft: asg ? `4px solid ${asg.color}` : undefined,
                          }}>
                            {asg && <div className="print-cell-asg" style={{ color: asg.color }}>{asg.nombre}</div>}
                            {doc && <div className="print-cell-doc">{doc.nombre}</div>}
                            {esp && <div className="print-cell-esp">📍 {esp.nombre}</div>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="print-summary">
              <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "260px" }}>
                  <h3>Asignaturas</h3>
                  <table>
                    <thead>
                      <tr><th>Asignatura</th><th style={{ width: "60px", textAlign: "right" }}>Horas</th></tr>
                    </thead>
                    <tbody>
                      {usedAsignaturas.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <span className="print-chip" style={{ background: a.color }} />
                            {a.nombre}
                          </td>
                          <td style={{ textAlign: "right" }}>{asgCount.get(a.id) ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ flex: 1, minWidth: "260px" }}>
                  <h3>Docentes</h3>
                  <table>
                    <thead>
                      <tr><th>Docente</th><th style={{ width: "60px", textAlign: "right" }}>Horas</th></tr>
                    </thead>
                    <tbody>
                      {usedDocentes.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <span className="print-chip" style={{ background: d.color }} />
                            {d.nombre}
                            {jefe?.id === d.id && <span style={{ fontSize: "8pt", color: "#555" }}> · Prof. jefe</span>}
                          </td>
                          <td style={{ textAlign: "right" }}>{docCount.get(d.id) ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
