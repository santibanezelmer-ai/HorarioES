import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Wand2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Layers,
  Calendar,
  Clock,
  User,
  BookOpen,
  ArrowRight,
  Check,
  Building2,
  HelpCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { handleDbError } from "@/lib/db-errors";
import {
  generarHorarioCurso,
  generarHorariosMultiCurso,
  type CargaAsignatura,
  type GeneradorResultado,
  type SlotGenerado,
  type BloqueHorario,
  type DocenteInfo,
  type DocenteBlockInfo,
} from "@/lib/horario-generator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const NONE = "__none__";

interface CursoData {
  id: string;
  nombre: string;
  nivel: string;
  prof_jefe_id: string | null;
  asignaturas?: Record<string, number> | null;
  titulares?: Record<string, string> | null;
}

interface AsignaturaData {
  id: string;
  nombre: string;
  color: string;
}

interface DocenteData {
  id: string;
  nombre: string;
  color: string;
  dias?: number[];
  horas_utp?: number | null;
}

interface ExistingSlotData {
  id: string;
  curso_id: string;
  dia: number;
  slot: number;
  docente_id: string | null;
  asignatura_id: string | null;
  espacio_id: string | null;
}

interface GeneradorHorarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colegioId: string;
  cursoActualId: string;
  cursos: CursoData[];
  bloques: BloqueHorario[];
  docentes: DocenteData[];
  asignaturas: AsignaturaData[];
  allSlots: ExistingSlotData[];
  docenteBlocks: DocenteBlockInfo[];
  viernesMaxSlot?: number | null;
  onApplySuccess: () => void;
}

export function GeneradorHorarioModal({
  open,
  onOpenChange,
  colegioId,
  cursoActualId,
  cursos,
  bloques,
  docentes,
  asignaturas,
  allSlots,
  docenteBlocks,
  viernesMaxSlot = null,
  onApplySuccess,
}: GeneradorHorarioModalProps) {
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"carga" | "preview">("carga");
  const [cursoSeleccionadoId, setCursoSeleccionadoId] = useState<string>(cursoActualId);
  const [modoMultiCurso, setModoMultiCurso] = useState(false);
  const [preferBloquesDobles, setPreferBloquesDobles] = useState(true);

  // Carga académica local editable para el curso seleccionado: Map<asignaturaId, { horas: number, docenteId: string | null }>
  const [cargaLocal, setCargaLocal] = useState<Record<string, { horas: number; docenteId: string | null }>>({});

  // Resultado de la generación
  const [resultadoActual, setResultadoActual] = useState<GeneradorResultado | null>(null);
  const [resultadosMulti, setResultadosMulti] = useState<Map<string, GeneradorResultado> | null>(null);

  // Mapeos rápidos
  const cursoMap = useMemo(() => new Map(cursos.map((c) => [c.id, c])), [cursos]);
  const docMap = useMemo(() => new Map(docentes.map((d) => [d.id, d])), [docentes]);
  const asgMap = useMemo(() => new Map(asignaturas.map((a) => [a.id, a])), [asignaturas]);

  const cursoActual = cursoMap.get(cursoSeleccionadoId) || cursos[0];

  // Cantidad de bloques de tipo "clase" en la semana
  const bloquesClase = useMemo(() => bloques.filter((b) => b.tipo === "clase"), [bloques]);
  const maxBloquesSemana = useMemo(() => {
    let count = 0;
    for (let dia = 0; dia < 5; dia++) {
      for (let sIdx = 0; sIdx < bloques.length; sIdx++) {
        if (bloques[sIdx].tipo === "clase") {
          if (dia === 4 && viernesMaxSlot != null && sIdx > viernesMaxSlot) {
            continue;
          }
          count++;
        }
      }
    }
    return count;
  }, [bloques, viernesMaxSlot]);

  // Cargar la carga académica del curso seleccionado cuando cambia
  useEffect(() => {
    if (!cursoActual) return;
    const asigsDb = (cursoActual.asignaturas || {}) as Record<string, number>;
    const titusDb = (cursoActual.titulares || {}) as Record<string, string>;

    // También buscar sugerencias desde slots existentes si titusDb está vacío
    const slotsDelCurso = allSlots.filter((s) => s.curso_id === cursoActual.id);
    const docentePorAsigEnSlots: Record<string, string> = {};
    slotsDelCurso.forEach((s) => {
      if (s.asignatura_id && s.docente_id) {
        docentePorAsigEnSlots[s.asignatura_id] = s.docente_id;
      }
    });

    const nuevaCarga: Record<string, { horas: number; docenteId: string | null }> = {};
    asignaturas.forEach((asig) => {
      const horas = typeof asigsDb[asig.id] === "number" ? asigsDb[asig.id] : 0;
      const docId = titusDb[asig.id] || docentePorAsigEnSlots[asig.id] || null;
      nuevaCarga[asig.id] = { horas, docenteId: docId };
    });

    setCargaLocal(nuevaCarga);
    setResultadoActual(null);
    setResultadosMulti(null);
  }, [cursoActual, asignaturas, allSlots]);

  // Actualizar horas de una asignatura
  const handleUpdateHoras = (asigId: string, horas: number) => {
    setCargaLocal((prev) => ({
      ...prev,
      [asigId]: {
        ...prev[asigId],
        horas: Math.max(0, horas),
        docenteId: prev[asigId]?.docenteId || null,
      },
    }));
  };

  // Actualizar docente de una asignatura
  const handleUpdateDocente = (asigId: string, docenteId: string | null) => {
    setCargaLocal((prev) => ({
      ...prev,
      [asigId]: {
        ...prev[asigId],
        horas: prev[asigId]?.horas || 0,
        docenteId,
      },
    }));
  };

  // Total de horas requeridas en la carga local
  const totalHorasCarga = useMemo(() => {
    return Object.values(cargaLocal).reduce((sum, item) => sum + (item.horas || 0), 0);
  }, [cargaLocal]);

  // Mutación para guardar la carga académica en el curso
  const saveCargaMutation = useMutation({
    mutationFn: async () => {
      if (!cursoActual) return;
      const asigsObj: Record<string, number> = {};
      const titusObj: Record<string, string> = {};

      Object.entries(cargaLocal).forEach(([asigId, item]) => {
        if (item.horas > 0) {
          asigsObj[asigId] = item.horas;
        }
        if (item.docenteId) {
          titusObj[asigId] = item.docenteId;
        }
      });

      const { error } = await supabase
        .from("cursos")
        .update({
          asignaturas: asigsObj,
          titulares: titusObj,
        })
        .eq("id", cursoActual.id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cursos-min", colegioId] });
      toast.success(`Carga académica guardada para ${cursoActual.nombre}`);
    },
    onError: (e) => toast.error(handleDbError(e)),
  });

  // Ejecutar el generador automático
  const handleGenerar = () => {
    if (totalHorasCarga === 0) {
      toast.error("Por favor asigna al menos una hora a alguna asignatura antes de generar.");
      return;
    }

    const docentesInfo: DocenteInfo[] = docentes.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      dias: d.dias && d.dias.length > 0 ? d.dias : [0, 1, 2, 3, 4],
      horas_utp: d.horas_utp,
    }));

    if (modoMultiCurso) {
      // Generar para todos los cursos del colegio
      const cursosLista = cursos.map((c) => {
        const asigsDb = (c.asignaturas || {}) as Record<string, number>;
        const titusDb = (c.titulares || {}) as Record<string, string>;

        // Si es el curso actual, usar la carga editada localmente
        const fuenteCarga = c.id === cursoActual.id ? cargaLocal : null;

        const cargaCurso: CargaAsignatura[] = asignaturas.map((a) => {
          const horas = fuenteCarga ? fuenteCarga[a.id]?.horas || 0 : asigsDb[a.id] || 0;
          const docId = fuenteCarga ? fuenteCarga[a.id]?.docenteId || null : titusDb[a.id] || null;
          const docObj = docId ? docMap.get(docId) : null;
          return {
            asignaturaId: a.id,
            asignaturaNombre: a.nombre,
            asignaturaColor: a.color,
            docenteId: docId,
            docenteNombre: docObj?.nombre,
            horasSemanales: horas,
          };
        }).filter((x) => x.horasSemanales > 0);

        return {
          cursoId: c.id,
          cursoNombre: c.nombre,
          carga: cargaCurso,
        };
      });

      const multiRes = generarHorariosMultiCurso(cursosLista, {
        colegioId,
        bloques,
        docentes: docentesInfo,
        docenteBlocks,
        viernesMaxSlot,
        preferBloquesDobles,
      });

      setResultadosMulti(multiRes);
      const resActual = multiRes.get(cursoActual.id) || null;
      setResultadoActual(resActual);
      setActiveTab("preview");

      toast.success(`Horarios generados para ${cursos.length} cursos simultáneos sin colisiones.`);
    } else {
      // Generar para el curso seleccionado
      const cargaParaGenerar: CargaAsignatura[] = asignaturas
        .map((a) => {
          const item = cargaLocal[a.id];
          const horas = item?.horas || 0;
          const docId = item?.docenteId || null;
          const docObj = docId ? docMap.get(docId) : null;
          return {
            asignaturaId: a.id,
            asignaturaNombre: a.nombre,
            asignaturaColor: a.color,
            docenteId: docId,
            docenteNombre: docObj?.nombre,
            horasSemanales: horas,
          };
        })
        .filter((x) => x.horasSemanales > 0);

      // Slots de otros cursos para no colisionar docentes
      const slotsOtros = allSlots.filter((s) => s.curso_id !== cursoActual.id);

      const res = generarHorarioCurso({
        cursoId: cursoActual.id,
        cursoNombre: cursoActual.nombre,
        colegioId,
        bloques,
        carga: cargaParaGenerar,
        docentes: docentesInfo,
        docenteBlocks,
        existingSlotsOtherCourses: slotsOtros,
        viernesMaxSlot,
        preferBloquesDobles,
      });

      setResultadoActual(res);
      setResultadosMulti(null);
      setActiveTab("preview");

      if (res.completado) {
        toast.success(`¡Horario completado al 100%! (${res.horasAsignadas} bloques asignados)`);
      } else {
        toast.warning(
          `Horario generado: ${res.horasAsignadas} de ${res.horasRequeridas} bloques asignados. Revisa las advertencias.`
        );
      }
    }
  };

  // Mutación para aplicar el horario generado a la base de datos
  const applyMutation = useMutation({
    mutationFn: async () => {
      let slotsTotales: SlotGenerado[] = [];
      let cursosAfectados: string[] = [];

      if (modoMultiCurso && resultadosMulti) {
        for (const [cid, res] of resultadosMulti.entries()) {
          cursosAfectados.push(cid);
          slotsTotales.push(...res.slots);
        }
      } else if (resultadoActual) {
        cursosAfectados.push(resultadoActual.cursoId);
        slotsTotales = resultadoActual.slots;
      }

      if (cursosAfectados.length === 0) return;

      // 1. Eliminar slots existentes de los cursos afectados
      for (const cid of cursosAfectados) {
        const { error: delErr } = await supabase
          .from("schedule_slots")
          .delete()
          .eq("colegio_id", colegioId)
          .eq("curso_id", cid);
        if (delErr) throw delErr;
      }

      // 2. Insertar nuevos slots generados
      if (slotsTotales.length > 0) {
        const payload = slotsTotales.map((s) => ({
          colegio_id: colegioId,
          curso_id: s.curso_id,
          dia: s.dia,
          slot: s.slot,
          asignatura_id: s.asignatura_id,
          docente_id: s.docente_id,
          espacio_id: s.espacio_id,
        }));

        // Inserción en bloques de hasta 100 para evitar límites de tamaño
        const chunkSize = 100;
        for (let i = 0; i < payload.length; i += chunkSize) {
          const chunk = payload.slice(i, i + chunkSize);
          const { error: insErr } = await supabase.from("schedule_slots").insert(chunk as any);
          if (insErr) throw insErr;
        }
      }

      // También guardar la carga académica en los cursos afectados
      await saveCargaMutation.mutateAsync();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule-slots", colegioId] });
      qc.invalidateQueries({ queryKey: ["cursos-min", colegioId] });
      toast.success("¡Horario generado y aplicado exitosamente!");
      onApplySuccess();
      onOpenChange(false);
    },
    onError: (e) => toast.error(handleDbError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Wand2 className="w-5 h-5 text-primary" /> Generador Automático de Horarios
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Arma el horario en base a la carga académica, respetando la disponibilidad de docentes,
            bloques pedagógicos y evitando colisiones.
          </p>
        </DialogHeader>

        {/* Pestañas: Carga Académica vs Vista Previa */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="flex-1 flex flex-col min-h-0 pt-2"
        >
          <TabsList className="grid grid-cols-2 mb-3 bg-surface-2">
            <TabsTrigger value="carga" className="text-xs font-semibold flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" /> 1. Carga Académica y Docentes
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              disabled={!resultadoActual}
              className="text-xs font-semibold flex items-center gap-2"
            >
              <Calendar className="w-3.5 h-3.5" /> 2. Vista Previa del Horario
              {resultadoActual && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/20 text-primary">
                  {resultadoActual.horasAsignadas} hrs
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CARGA ACADÉMICA Y ASIGNACIÓN DOCENTE */}
          <TabsContent value="carga" className="flex-1 overflow-y-auto pr-1 space-y-4">
            {/* Controles de Curso y Alcance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-2/60 border border-border rounded-xl">
              <div>
                <Label className="text-xs font-bold text-foreground mb-1 block">Curso a Generar:</Label>
                <Select
                  value={cursoSeleccionadoId}
                  onValueChange={(id) => {
                    setCursoSeleccionadoId(id);
                    setResultadoActual(null);
                  }}
                >
                  <SelectTrigger className="bg-surface text-xs font-semibold">
                    <SelectValue placeholder="Seleccionar curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {cursos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre} <span className="text-muted-foreground capitalize">({c.nivel})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col justify-end">
                <div className="flex items-center justify-between text-xs p-2 bg-surface rounded-lg border border-border">
                  <span className="text-muted-foreground font-medium">Bloques semanales disponibles:</span>
                  <span className="font-bold text-foreground">{maxBloquesSemana} bloques</span>
                </div>
                <div className="flex items-center justify-between text-xs p-2 bg-surface rounded-lg border border-border mt-1">
                  <span className="text-muted-foreground font-medium">Horas configuradas en la carga:</span>
                  <span
                    className={`font-bold ${
                      totalHorasCarga > maxBloquesSemana
                        ? "text-destructive"
                        : totalHorasCarga === maxBloquesSemana
                        ? "text-emerald-600"
                        : "text-primary"
                    }`}
                  >
                    {totalHorasCarga} / {maxBloquesSemana} horas
                  </span>
                </div>
              </div>
            </div>

            {/* Opciones y Algoritmo */}
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs p-2.5 bg-primary/5 border border-primary/20 rounded-xl">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={preferBloquesDobles}
                  onChange={(e) => setPreferBloquesDobles(e.target.checked)}
                  className="rounded text-primary focus:ring-primary w-4 h-4"
                />
                <span>Agrupar en bloques dobles (2 horas seguidas por día)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={modoMultiCurso}
                  onChange={(e) => setModoMultiCurso(e.target.checked)}
                  className="rounded text-primary focus:ring-primary w-4 h-4"
                />
                <span>Generar todos los cursos del colegio en simultáneo</span>
              </label>
            </div>

            {/* Tabla de Asignaturas y Carga Académica */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-foreground">
                  Plan de Asignaturas y Docentes de {cursoActual?.nombre}:
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveCargaMutation.mutate()}
                  disabled={saveCargaMutation.isPending}
                  className="h-7 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-primary" /> Guardar Carga del Curso
                </Button>
              </div>

              <div className="border border-border rounded-xl overflow-hidden bg-surface">
                <table className="w-full text-xs">
                  <thead className="bg-surface-2 border-b border-border text-muted-foreground">
                    <tr>
                      <th className="text-left p-2.5 font-semibold">Asignatura</th>
                      <th className="text-left p-2.5 font-semibold">Docente Titular</th>
                      <th className="text-center p-2.5 font-semibold w-28">Horas Semanales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {asignaturas.map((asig) => {
                      const item = cargaLocal[asig.id] || { horas: 0, docenteId: null };
                      const docObj = item.docenteId ? docMap.get(item.docenteId) : null;

                      return (
                        <tr key={asig.id} className="hover:bg-surface-2/40 transition-colors">
                          <td className="p-2.5">
                            <div className="flex items-center gap-2 font-semibold text-foreground">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: asig.color }}
                              />
                              <span>{asig.nombre}</span>
                            </div>
                          </td>

                          <td className="p-2.5">
                            <select
                              value={item.docenteId || NONE}
                              onChange={(e) =>
                                handleUpdateDocente(
                                  asig.id,
                                  e.target.value === NONE ? null : e.target.value
                                )
                              }
                              className="w-full max-w-xs px-2.5 py-1 bg-surface border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value={NONE}>-- Sin docente asignado --</option>
                              {docentes.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.nombre} {d.dias ? `(${d.dias.length} días)` : ""}
                                </option>
                              ))}
                            </select>
                            {docObj && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                Trabaja {docObj.dias ? docObj.dias.length : 5} días a la semana
                              </div>
                            )}
                          </td>

                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                max={20}
                                value={item.horas}
                                onChange={(e) =>
                                  handleUpdateHoras(asig.id, parseInt(e.target.value, 10) || 0)
                                }
                                className="w-16 px-2 py-1 text-center bg-surface border border-border rounded-lg text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              <span className="text-muted-foreground text-[11px]">hrs</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: VISTA PREVIA DEL HORARIO GENERADO */}
          <TabsContent value="preview" className="flex-1 overflow-y-auto pr-1 space-y-4">
            {resultadoActual && (
              <div className="space-y-4">
                {/* Banner de Estado del Resultado */}
                {resultadoActual.completado ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>¡Horario 100% completado sin conflictos!</strong> Se asignaron los{" "}
                        {resultadoActual.horasAsignadas} bloques requeridos.
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGenerar}
                      className="h-7 text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> Probar otra variante
                    </Button>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Asignación parcial: {resultadoActual.horasAsignadas} de{" "}
                        {resultadoActual.horasRequeridas} bloques ubicados
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGenerar}
                        className="h-7 text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Reintentar
                      </Button>
                    </div>
                    {resultadoActual.advertencias.length > 0 && (
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90 pl-1">
                        {resultadoActual.advertencias.map((adv, idx) => (
                          <li key={idx}>{adv}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Grilla Semanal Previsualizada */}
                <div className="border border-border rounded-xl overflow-x-auto bg-surface">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-surface-2 border-b border-border text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left w-24">Bloque</th>
                        {DIAS.map((d) => (
                          <th key={d} className="p-2 text-left font-semibold">
                            {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {bloques.map((b, sIdx) => {
                        const isClase = b.tipo === "clase";

                        return (
                          <tr key={b.id}>
                            <td className="p-2 bg-surface-2/40 align-top">
                              <div className="font-semibold text-foreground text-[11px]">
                                {b.nombre}
                              </div>
                              <div className="text-[10px] text-muted-foreground">{b.hora}</div>
                            </td>

                            {DIAS.map((_, dia) => {
                              if (!isClase) {
                                return (
                                  <td
                                    key={dia}
                                    className="p-1 bg-muted/20 text-center text-[10px] text-muted-foreground italic"
                                  >
                                    {b.tipo}
                                  </td>
                                );
                              }

                              const slotGen = resultadoActual.slots.find(
                                (s) => s.dia === dia && s.slot === sIdx
                              );
                              const asig = slotGen ? asgMap.get(slotGen.asignatura_id) : null;
                              const doc = slotGen?.docente_id
                                ? docMap.get(slotGen.docente_id)
                                : null;

                              return (
                                <td key={dia} className="p-1 align-top min-w-[120px]">
                                  {slotGen && asig ? (
                                    <div
                                      className="p-1.5 rounded-lg border text-left shadow-2xs space-y-0.5"
                                      style={{
                                        backgroundColor: `${asig.color}15`,
                                        borderColor: `${asig.color}40`,
                                      }}
                                    >
                                      <div
                                        className="font-bold truncate text-[11px]"
                                        style={{ color: asig.color }}
                                      >
                                        {asig.nombre}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground truncate">
                                        {doc ? doc.nombre : "Sin docente"}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="h-10 rounded-lg border border-dashed border-border/40 flex items-center justify-center text-[10px] text-muted-foreground/40">
                                      Libre
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

                {/* Resumen por Asignatura */}
                <div className="bg-surface-2/60 p-3 rounded-xl border border-border">
                  <div className="text-xs font-bold text-foreground mb-2">
                    Cumplimiento de Horas por Asignatura:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {resultadoActual.detallesPorAsignatura.map((det) => (
                      <div
                        key={det.asignaturaId}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                          det.cumplido
                            ? "bg-surface border-border text-foreground"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
                        }`}
                      >
                        <div className="truncate mr-2">
                          <span
                            className="inline-block w-2 h-2 rounded-full mr-1.5"
                            style={{ background: det.asignaturaColor }}
                          />
                          <span className="font-semibold">{det.asignaturaNombre}</span>
                        </div>
                        <span className="font-bold shrink-0">
                          {det.horasAsignadas}/{det.horasRequeridas} hrs
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer con Acciones */}
        <DialogFooter className="border-t border-border pt-3 flex items-center justify-between sm:justify-between w-full">
          <div>
            {activeTab === "preview" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("carga")}
                className="text-xs cursor-pointer"
              >
                ← Volver a Carga
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs cursor-pointer"
            >
              Cancelar
            </Button>

            {activeTab === "carga" ? (
              <Button
                type="button"
                size="sm"
                onClick={handleGenerar}
                className="bg-primary text-primary-foreground font-semibold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" /> Generar Horario Automático
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending || !resultadoActual}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                {applyMutation.isPending ? "Aplicando Horario…" : "✓ Aplicar y Guardar Horario"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
