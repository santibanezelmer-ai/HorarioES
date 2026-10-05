import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
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
  CalendarRange,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { handleDbError } from "@/lib/db-errors";
import { withRetry } from "@/lib/db-retry";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

export const Route = createFileRoute("/generar-horarios")({
  head: () => ({ meta: [{ title: "Generar Horarios — HorarioES" }] }),
  component: GenerarHorariosPage,
});

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const NONE = "__none__";

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

interface Asignatura {
  id: string;
  nombre: string;
  color: string;
}

interface Slot {
  id: string;
  curso_id: string;
  dia: number;
  slot: number;
  docente_id: string | null;
  asignatura_id: string | null;
  espacio_id: string | null;
}

function GenerarHorariosPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const qc = useQueryClient();

  const [cursoId, setCursoId] = useState<string>("");
  const [scope, setScope] = useState<"curso" | "todos">("curso");
  const [activeTab, setActiveTab] = useState<"carga" | "preview">("carga");

  // Local editing state for subjects and teachers
  const [horasPorAsignatura, setHorasPorAsignatura] = useState<Record<string, number>>({});
  const [docentesPorAsignatura, setDocentesPorAsignatura] = useState<Record<string, string>>({});

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultado, setResultado] = useState<GeneradorResultado | null>(null);
  const [multiResultado, setMultiResultado] = useState<Map<string, GeneradorResultado> | null>(null);

  // Queries
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
          .select("id, nombre, nivel, prof_jefe_id, asignaturas, titulares")
          .eq("colegio_id", colegioId!)
          .order("nombre")
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
          .select("id, nombre, hora, orden, tipo")
          .eq("colegio_id", colegioId!)
          .order("orden")
      );
      if (error) throw error;
      return data as BloqueHorario[];
    },
  });

  const { data: docentes = [] } = useQuery({
    queryKey: ["docentes-min", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase.from("docentes")
          .select("id, nombre, color, dias, horas_utp")
          .eq("colegio_id", colegioId!)
          .order("nombre")
      );
      if (error) throw error;
      return data as Docente[];
    },
  });

  const { data: asignaturas = [] } = useQuery({
    queryKey: ["asignaturas-min", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase.from("asignaturas")
          .select("id, nombre, color")
          .eq("colegio_id", colegioId!)
          .order("nombre")
      );
      if (error) throw error;
      return data as Asignatura[];
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

  // Auto-select first course
  useEffect(() => {
    if (!cursoId && cursos.length > 0) {
      setCursoId(cursos[0].id);
    }
  }, [cursoId, cursos]);

  const cursoActual = useMemo(
    () => cursos.find((c) => c.id === cursoId) ?? cursos[0],
    [cursos, cursoId]
  );

  // Sync state when cursoActual changes
  useEffect(() => {
    if (cursoActual) {
      const asg = (cursoActual.asignaturas as Record<string, number> | null) ?? {};
      const tit = (cursoActual.titulares as Record<string, string> | null) ?? {};
      setHorasPorAsignatura({ ...asg });
      setDocentesPorAsignatura({ ...tit });
      setResultado(null);
      setMultiResultado(null);
    }
  }, [cursoActual?.id]);

  // Lookup maps
  const docMap = useMemo(() => new Map(docentes.map((d) => [d.id, d])), [docentes]);
  const asgMap = useMemo(() => new Map(asignaturas.map((a) => [a.id, a])), [asignaturas]);

  // Calculate class blocks available
  const totalBloquesClaseSemana = useMemo(() => {
    const clasesPorDiaNormal = bloques.filter((b) => b.tipo === "clase").length;
    const vMax = colegio?.viernes_max_slot;
    let total = 0;
    for (let d = 0; d < 5; d++) {
      if (d === 4 && vMax != null && vMax >= 0) {
        total += bloques.filter((b, idx) => b.tipo === "clase" && idx <= vMax).length;
      } else {
        total += clasesPorDiaNormal;
      }
    }
    return total;
  }, [bloques, colegio?.viernes_max_slot]);

  // Calculate total hours configured
  const totalHorasConfiguradas = useMemo(() => {
    return Object.values(horasPorAsignatura).reduce((sum, h) => sum + (Number(h) || 0), 0);
  }, [horasPorAsignatura]);

  // Save academic load mutation
  const saveCargaMutation = useMutation({
    mutationFn: async () => {
      if (!cursoActual) return;
      const cleanHoras: Record<string, number> = {};
      for (const [k, v] of Object.entries(horasPorAsignatura)) {
        if (v > 0) cleanHoras[k] = v;
      }
      const cleanTitulares: Record<string, string> = {};
      for (const [k, v] of Object.entries(docentesPorAsignatura)) {
        if (v && v !== NONE) cleanTitulares[k] = v;
      }

      const { error } = await supabase
        .from("cursos")
        .update({
          asignaturas: cleanHoras,
          titulares: cleanTitulares,
        })
        .eq("id", cursoActual.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cursos-min", colegioId] });
      toast.success("Carga académica del curso guardada correctamente");
    },
    onError: (e) => toast.error(handleDbError(e)),
  });

  // Apply generated schedule mutation
  const applyScheduleMutation = useMutation({
    mutationFn: async () => {
      if (scope === "curso") {
        if (!resultado || !cursoActual) return;
        // Delete current slots for this course
        const { error: delErr } = await supabase
          .from("schedule_slots")
          .delete()
          .eq("curso_id", cursoActual.id);
        if (delErr) throw delErr;

        // Insert new slots
        if (resultado.slots.length > 0) {
          const toInsert = resultado.slots.map((s) => ({
            colegio_id: colegioId!,
            curso_id: cursoActual.id,
            dia: s.dia,
            slot: s.slot,
            asignatura_id: s.asignatura_id,
            docente_id: s.docente_id,
            espacio_id: null,
          }));
          const { error: insErr } = await supabase.from("schedule_slots").insert(toInsert);
          if (insErr) throw insErr;
        }
      } else {
        // Multi-course apply
        if (!multiResultado) return;
        const cursoIds = Array.from(multiResultado.keys());
        if (cursoIds.length === 0) return;

        // Delete existing for all these courses
        const { error: delErr } = await supabase
          .from("schedule_slots")
          .delete()
          .in("curso_id", cursoIds);
        if (delErr) throw delErr;

        // Gather all slots
        const allNew: Array<{
          colegio_id: string;
          curso_id: string;
          dia: number;
          slot: number;
          asignatura_id: string | null;
          docente_id: string | null;
          espacio_id: null;
        }> = [];

        for (const [cId, res] of multiResultado.entries()) {
          for (const s of res.slots) {
            allNew.push({
              colegio_id: colegioId!,
              curso_id: cId,
              dia: s.dia,
              slot: s.slot,
              asignatura_id: s.asignatura_id,
              docente_id: s.docente_id,
              espacio_id: null,
            });
          }
        }

        if (allNew.length > 0) {
          const { error: insErr } = await supabase.from("schedule_slots").insert(allNew);
          if (insErr) throw insErr;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule-slots", colegioId] });
      toast.success(
        scope === "curso"
          ? `Horario del curso ${cursoActual?.nombre} aplicado con éxito`
          : "Horarios de todos los cursos aplicados con éxito"
      );
    },
    onError: (e) => toast.error(handleDbError(e)),
  });

  // Handler for running generator
  const ejecutarGenerador = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        if (scope === "curso") {
          if (!cursoActual) return;
          const carga: CargaAsignatura[] = Object.entries(horasPorAsignatura)
            .filter(([, h]) => Number(h) > 0)
            .map(([asgId, h]) => ({
              asignatura_id: asgId,
              docente_id: docentesPorAsignatura[asgId] && docentesPorAsignatura[asgId] !== NONE ? docentesPorAsignatura[asgId] : null,
              horas_semanales: Number(h),
            }));

          const res = generarHorarioCurso({
            cursoId: cursoActual.id,
            carga,
            bloques,
            docentes,
            docenteBlocks,
            allSlots,
            viernesMaxSlot: colegio?.viernes_max_slot ?? null,
            priorizarBloquesDobles: true,
          });

          setResultado(res);
          setActiveTab("preview");
          if (res.conflictos.length === 0) {
            toast.success(`Horario generado con éxito (0 colisiones)`);
          } else {
            toast.warning(`Horario generado con advertencias (${res.conflictos.length} restricciones no cumplidas)`);
          }
        } else {
          // Multi-course
          const resMap = generarHorariosMultiCurso({
            cursos: cursos.map((c) => {
              const asgObj = c.id === cursoActual?.id ? horasPorAsignatura : ((c.asignaturas as Record<string, number> | null) ?? {});
              const titObj = c.id === cursoActual?.id ? docentesPorAsignatura : ((c.titulares as Record<string, string> | null) ?? {});
              const carga: CargaAsignatura[] = Object.entries(asgObj)
                .filter(([, h]) => Number(h) > 0)
                .map(([asgId, h]) => ({
                  asignatura_id: asgId,
                  docente_id: titObj[asgId] && titObj[asgId] !== NONE ? titObj[asgId] : null,
                  horas_semanales: Number(h),
                }));
              return { cursoId: c.id, carga };
            }),
            bloques,
            docentes,
            docenteBlocks,
            viernesMaxSlot: colegio?.viernes_max_slot ?? null,
            priorizarBloquesDobles: true,
          });

          setMultiResultado(resMap);
          const currentRes = resMap.get(cursoActual?.id ?? "");
          if (currentRes) setResultado(currentRes);
          setActiveTab("preview");
          toast.success(`Generación multi-curso coordinada finalizada`);
        }
      } catch (err: unknown) {
        toast.error(`Error al generar horario: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsGenerating(false);
      }
    }, 60);
  };

  // Preview cell helper
  const previewCells = useMemo(() => {
    const map = new Map<string, SlotGenerado>();
    if (!resultado) return map;
    for (const s of resultado.slots) {
      map.set(`${s.dia}-${s.slot}`, s);
    }
    return map;
  }, [resultado]);

  // Statistics from preview
  const previewStats = useMemo(() => {
    if (!resultado) return null;
    const docCount = new Map<string, number>();
    const asgCount = new Map<string, number>();
    for (const s of resultado.slots) {
      if (s.docente_id) docCount.set(s.docente_id, (docCount.get(s.docente_id) ?? 0) + 1);
      if (s.asignatura_id) asgCount.set(s.asignatura_id, (asgCount.get(s.asignatura_id) ?? 0) + 1);
    }
    return { docCount, asgCount, totalAsignados: resultado.slots.length };
  }, [resultado]);

  if (cursos.length === 0 || bloques.length === 0) {
    return (
      <div>
        <PageHeader title="Generador de Horarios" subtitle="Configura cursos y bloques primero" />
        <EmptyState
          icon={CalendarRange}
          title="Faltan datos de configuración"
          description="Debes tener al menos un curso y los bloques horarios cargados para poder generar horarios."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Generador de Horarios"
        subtitle="Generación automática asistida por carga académica, disponibilidad docente y bloques pedagógicos"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/horarios">
                <Calendar className="w-4 h-4 mr-2" /> Ver Grilla Oficial
              </Link>
            </Button>
            <Button
              size="sm"
              onClick={ejecutarGenerador}
              disabled={isGenerating}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm font-medium"
            >
              {isGenerating ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" /> Calculando distribución…
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" /> Generar Horario Automático
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Selector de Curso y Filtro de Ámbito */}
      <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Curso en foco</Label>
            <div className="w-64">
              <Select
                value={cursoId}
                onValueChange={(id) => {
                  setCursoId(id);
                  if (multiResultado) {
                    const r = multiResultado.get(id);
                    if (r) setResultado(r);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un curso" />
                </SelectTrigger>
                <SelectContent>
                  {cursos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre} <span className="text-muted-foreground capitalize">· {c.nivel}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Ámbito del algoritmo</Label>
            <div className="inline-flex rounded-md border border-border overflow-hidden bg-background">
              <button
                type="button"
                onClick={() => setScope("curso")}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  scope === "curso" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                }`}
              >
                Solo {cursoActual?.nombre ?? "este curso"}
              </button>
              <button
                type="button"
                onClick={() => setScope("todos")}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  scope === "todos" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                }`}
              >
                Todos los cursos en simultáneo
              </button>
            </div>
          </div>
        </div>

        {/* Balance Badge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Balance semanal</div>
            <div className="text-sm font-semibold">
              <span className={totalHorasConfiguradas > totalBloquesClaseSemana ? "text-amber-500 font-bold" : "text-emerald-500"}>
                {totalHorasConfiguradas} hrs
              </span>
              <span className="text-muted-foreground font-normal"> / {totalBloquesClaseSemana} bloques lectivos</span>
            </div>
          </div>
          <div
            className={`w-3 h-3 rounded-full ${
              totalHorasConfiguradas === totalBloquesClaseSemana
                ? "bg-emerald-500 ring-4 ring-emerald-500/20"
                : totalHorasConfiguradas > totalBloquesClaseSemana
                ? "bg-amber-500 ring-4 ring-amber-500/20"
                : "bg-blue-500 ring-4 ring-blue-500/20"
            }`}
          />
        </div>
      </div>

      {/* Tabs Principales */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "carga" | "preview")}>
        <TabsList className="grid grid-cols-2 max-w-md">
          <TabsTrigger value="carga" className="gap-2">
            <BookOpen className="w-4 h-4" /> 1. Carga Académica & Docentes
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Sparkles className="w-4 h-4" /> 2. Vista Previa del Horario
            {resultado && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/10 text-emerald-500 font-medium">
                {resultado.slots.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CARGA ACADÉMICA */}
        <TabsContent value="carga" className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/40 p-3.5 rounded-lg border border-border">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Asignación de asignaturas y profesores para {cursoActual?.nombre}
              </h3>
              <p className="text-xs text-muted-foreground">
                Define cuántas horas pedagógicas semanales tiene cada asignatura y qué docente la imparte.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => saveCargaMutation.mutate()}
              disabled={saveCargaMutation.isPending}
              className="gap-1.5 shrink-0"
            >
              <Save className="w-4 h-4" /> {saveCargaMutation.isPending ? "Guardando…" : "Guardar Carga"}
            </Button>
          </div>

          <div className="border border-border rounded-xl overflow-hidden bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-left">
                    <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground uppercase">Asignatura</th>
                    <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground uppercase w-36 text-center">Horas Semanales</th>
                    <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground uppercase min-w-[240px]">Docente Titular</th>
                    <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground uppercase text-right w-44">Disponibilidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {asignaturas.map((asg) => {
                    const horas = horasPorAsignatura[asg.id] ?? 0;
                    const docId = docentesPorAsignatura[asg.id] ?? NONE;
                    const docente = docMap.get(docId);

                    return (
                      <tr key={asg.id} className={horas > 0 ? "bg-primary/5 hover:bg-primary/10 transition-colors" : "hover:bg-muted/30 transition-colors"}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: asg.color }} />
                            <span className="font-medium text-foreground">{asg.nombre}</span>
                          </div>
                        </td>
                        <td className="py-2 px-4 text-center">
                          <div className="inline-flex items-center border border-border rounded-md bg-background overflow-hidden">
                            <button
                              type="button"
                              onClick={() => {
                                const next = Math.max(0, horas - 1);
                                setHorasPorAsignatura((prev) => ({ ...prev, [asg.id]: next }));
                              }}
                              className="px-2 py-1 hover:bg-muted text-muted-foreground text-xs font-semibold"
                            >
                              -
                            </button>
                            <Input
                              type="number"
                              min={0}
                              max={20}
                              value={horas}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setHorasPorAsignatura((prev) => ({
                                  ...prev,
                                  [asg.id]: isNaN(val) ? 0 : Math.max(0, val),
                                }));
                              }}
                              className="w-12 h-7 text-center border-0 p-0 text-xs font-semibold focus-visible:ring-0 rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = horas + 1;
                                setHorasPorAsignatura((prev) => ({ ...prev, [asg.id]: next }));
                              }}
                              className="px-2 py-1 hover:bg-muted text-muted-foreground text-xs font-semibold"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-4">
                          <Select
                            value={docId}
                            onValueChange={(val) => {
                              setDocentesPorAsignatura((prev) => ({ ...prev, [asg.id]: val }));
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs bg-background">
                              <SelectValue placeholder="Sin asignar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE} className="text-muted-foreground italic text-xs">
                                Sin asignar
                              </SelectItem>
                              {docentes.map((d) => (
                                <SelectItem key={d.id} value={d.id} className="text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                                    <span>{d.nombre}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-4 text-right">
                          {docente ? (
                            <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-muted font-mono">
                                {docente.dias && docente.dias.length > 0 ? `${docente.dias.length} días` : "5 días"}
                              </span>
                              {docente.horas_utp ? (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 font-mono">
                                  {docente.horas_utp}h UTP
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={ejecutarGenerador}
              disabled={isGenerating}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-medium"
            >
              <Wand2 className="w-4 h-4" /> Generar Horario Automático Ahora
            </Button>
          </div>
        </TabsContent>

        {/* TAB 2: VISTA PREVIA Y RESULTADOS */}
        <TabsContent value="preview" className="space-y-4 pt-2">
          {!resultado ? (
            <div className="border border-dashed border-border rounded-xl p-12 text-center bg-muted/20">
              <Sparkles className="w-10 h-10 mx-auto text-indigo-400 mb-3 opacity-60" />
              <h4 className="text-base font-semibold mb-1">Aún no se ha calculado un horario</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mb-5">
                Haz clic en el botón a continuación para ejecutar el motor de restricciones y generar la distribución óptima.
              </p>
              <Button onClick={ejecutarGenerador} disabled={isGenerating} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Wand2 className="w-4 h-4 mr-2" /> Generar Horario para {cursoActual?.nombre}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Estado de Colisiones & Alertas */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  resultado.conflictos.length === 0
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-950 dark:text-emerald-100"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-950 dark:text-amber-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  {resultado.conflictos.length === 0 ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-semibold text-sm">
                      {resultado.conflictos.length === 0
                        ? "Horario Optimizado · 0 Colisiones Detectadas"
                        : `Atención: ${resultado.conflictos.length} restricciones no se pudieron satisfacer`}
                    </h4>
                    <p className="text-xs opacity-90">
                      {resultado.conflictos.length === 0
                        ? `Se ubicaron correctamente las ${resultado.slots.length} horas respetando días laborables y bloques continuos.`
                        : resultado.conflictos.join(". ")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={ejecutarGenerador}
                    disabled={isGenerating}
                    className="gap-1.5 text-xs bg-background"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reintentar / Otra variante
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => applyScheduleMutation.mutate()}
                    disabled={applyScheduleMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-semibold shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" /> {applyScheduleMutation.isPending ? "Guardando…" : "Aplicar y Guardar Horario"}
                  </Button>
                </div>
              </div>

              {/* Grilla Semanal Previa */}
              <div className="overflow-x-auto bg-surface border border-border rounded-xl shadow-sm">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="py-2.5 px-3 text-left font-semibold text-xs text-muted-foreground w-28 uppercase">Bloque</th>
                      {DIAS.map((dia) => (
                        <th key={dia} className="py-2.5 px-3 text-center font-semibold text-xs text-muted-foreground uppercase min-w-[130px]">
                          {dia}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bloques.map((b, slotIdx) => {
                      const isClase = b.tipo === "clase";
                      return (
                        <tr key={b.id} className={!isClase ? "bg-muted/20" : ""}>
                          <td className="py-2 px-3 border-r border-border/60">
                            <div className="text-xs font-semibold">{b.nombre}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{b.hora}</div>
                          </td>
                          {DIAS.map((_, diaIdx) => {
                            if (!isClase) {
                              return (
                                <td key={diaIdx} className="text-center py-2 text-[11px] italic text-muted-foreground/70 bg-muted/30">
                                  {b.tipo}
                                </td>
                              );
                            }
                            const slot = previewCells.get(`${diaIdx}-${slotIdx}`);
                            if (!slot) {
                              return (
                                <td key={diaIdx} className="text-center py-2 text-[11px] text-muted-foreground/40 hover:bg-muted/10 transition-colors">
                                  —
                                </td>
                              );
                            }
                            const asg = slot.asignatura_id ? asgMap.get(slot.asignatura_id) : null;
                            const doc = slot.docente_id ? docMap.get(slot.docente_id) : null;

                            return (
                              <td
                                key={diaIdx}
                                className="p-1.5 transition-colors"
                                style={{
                                  backgroundColor: asg?.color ? `color-mix(in oklab, ${asg.color} 14%, transparent)` : undefined,
                                }}
                              >
                                <div
                                  className="rounded-lg p-2 text-left border shadow-xs h-full flex flex-col justify-between"
                                  style={{
                                    borderLeftColor: asg?.color ?? "transparent",
                                    borderLeftWidth: "4px",
                                    borderColor: asg?.color ? `color-mix(in oklab, ${asg.color} 30%, transparent)` : undefined,
                                  }}
                                >
                                  <div className="font-semibold text-xs leading-tight mb-1" style={{ color: asg?.color }}>
                                    {asg?.nombre ?? "Sin asignatura"}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground truncate">
                                    {doc?.nombre ?? "Sin docente"}
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Resumen de Asignación por Docente */}
              {previewStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-surface border border-border p-4 rounded-xl">
                    <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Distribución de Asignaturas</h5>
                    <div className="space-y-2">
                      {Array.from(previewStats.asgCount.entries()).map(([asgId, count]) => {
                        const a = asgMap.get(asgId);
                        if (!a) return null;
                        return (
                          <div key={asgId} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                              <span className="font-medium">{a.nombre}</span>
                            </div>
                            <span className="font-mono text-muted-foreground font-semibold">{count} hrs</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-surface border border-border p-4 rounded-xl">
                    <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Docentes en este curso</h5>
                    <div className="space-y-2">
                      {Array.from(previewStats.docCount.entries()).map(([docId, count]) => {
                        const d = docMap.get(docId);
                        if (!d) return null;
                        return (
                          <div key={docId} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                              <span className="font-medium">{d.nombre}</span>
                            </div>
                            <span className="font-mono text-muted-foreground font-semibold">{count} hrs</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
