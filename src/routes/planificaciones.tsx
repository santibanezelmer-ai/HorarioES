import { handleDbError } from "@/lib/db-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/db-retry";
import { useAuth } from "@/lib/auth-context";
import { useUserRoles } from "@/lib/use-role";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/planificaciones")({
  head: () => ({ meta: [{ title: "Planificaciones — HorarioES" }] }),
  component: PlanificacionesPage,
});

const ESTADOS = ["pendiente", "entregada", "revisada", "aprobada"] as const;
type Estado = typeof ESTADOS[number];
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

interface Planif {
  id: string;
  docente_id: string;
  asignatura_id: string;
  anio: number;
  mes: number;
  estado: Estado;
  fecha: string | null;
  observaciones: string | null;
  objetivo?: string | null;
}

function PlanificacionesPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: roles = [] } = useUserRoles();
  const isUtp = roles.some((r) => r === "utp" || r === "admin" || r === "superadmin");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["planif", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase
          .from("planificaciones")
          .select("*")
          .eq("colegio_id", colegioId!)
          .order("anio", { ascending: false }).order("mes", { ascending: false })
      );
      if (error) throw error;
      return data as Planif[];
    },
  });

  const { data: docentes = [] } = useQuery({
    queryKey: ["docentes-min", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data } = await withRetry(() =>
        supabase.from("docentes").select("id, nombre").eq("colegio_id", colegioId!).order("nombre")
      );
      return (data ?? []) as { id: string; nombre: string }[];
    },
  });

  const { data: asignaturas = [] } = useQuery({
    queryKey: ["asig-min", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data } = await withRetry(() =>
        supabase.from("asignaturas").select("id, nombre, color").eq("colegio_id", colegioId!).order("nombre")
      );
      return (data ?? []) as { id: string; nombre: string; color: string }[];
    },
  });

  const dMap = Object.fromEntries(docentes.map((d) => [d.id, d]));
  const aMap = Object.fromEntries(asignaturas.map((a) => [a.id, a]));

  const create = useMutation({
    mutationFn: async (p: Partial<Planif>) => {
      const { error } = await supabase.from("planificaciones").insert({ ...p, colegio_id: colegioId! } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planif", colegioId] });
      setOpen(false);
      toast.success("Planificación creada");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  const updateEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: Estado }) => {
      const { error } = await supabase.from("planificaciones").update({ estado }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planif", colegioId] }),
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planificaciones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planif", colegioId] });
      toast.success("Eliminada");
    },
  });

  return (
    <div>
      <PageHeader
        title="Planificaciones"
        subtitle="Seguimiento mensual y cobertura curricular por docente"
        actions={
          <Button onClick={() => setOpen(true)} disabled={docentes.length === 0 || asignaturas.length === 0}>
            <Plus className="w-4 h-4 mr-2" /> Nueva
          </Button>
        }
      />

      <Tabs defaultValue={isUtp ? "resumen" : "lista"} className="w-full">
        <TabsList>
          {isUtp && <TabsTrigger value="resumen">Resumen por docente</TabsTrigger>}
          <TabsTrigger value="lista">Listado</TabsTrigger>
        </TabsList>

        {isUtp && (
          <TabsContent value="resumen" className="mt-4">
            <UtpResumen
              colegioId={colegioId!}
              items={items}
              docentes={docentes}
              asignaturas={asignaturas}
            />
          </TabsContent>
        )}

        <TabsContent value="lista" className="mt-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Cargando…</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Sin planificaciones"
              description="Registra entregas mensuales por docente y asignatura."
              action={<Button onClick={() => setOpen(true)} disabled={docentes.length === 0 || asignaturas.length === 0}>
                <Plus className="w-4 h-4 mr-2" /> Crear primera
              </Button>}
            />
          ) : (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs">
                  <tr>
                    <th className="text-left p-3">Periodo</th>
                    <th className="text-left p-3">Docente</th>
                    <th className="text-left p-3">Asignatura</th>
                    <th className="text-left p-3">Estado</th>
                    <th className="text-left p-3">Observaciones</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => {
                    const a = aMap[p.asignatura_id];
                    return (
                      <tr key={p.id} className="border-t border-border">
                        <td className="p-3 whitespace-nowrap">{MESES[p.mes - 1] ?? p.mes} {p.anio}</td>
                        <td className="p-3">{dMap[p.docente_id]?.nombre ?? "—"}</td>
                        <td className="p-3">
                          {a ? (
                            <span className="px-1.5 py-0.5 rounded text-white text-[11px]" style={{ background: a.color }}>
                              {a.nombre}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="p-3">
                          <Select value={p.estado} onValueChange={(v) => updateEstado.mutate({ id: p.id, estado: v as Estado })}>
                            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ESTADOS.map((e) => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 text-muted-foreground text-xs max-w-xs truncate">{p.observaciones ?? "—"}</td>
                        <td className="p-3 text-right">
                          <Button size="icon" variant="ghost" onClick={() => remove.mutate(p.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PlanifDialog
        open={open}
        onClose={() => setOpen(false)}
        docentes={docentes}
        asignaturas={asignaturas}
        onSubmit={(f) => create.mutate(f)}
        loading={create.isPending}
      />
    </div>
  );
}

interface SlotRow { docente_id: string | null; asistente_id: string | null; curso_id: string; asignatura_id: string | null }
interface LibroRow { docente_id: string | null; curso_id: string; asignatura_id: string | null; objetivo_logrado: boolean | null; fecha: string }

function UtpResumen({ colegioId, items, docentes, asignaturas }: {
  colegioId: string;
  items: Planif[];
  docentes: { id: string; nombre: string }[];
  asignaturas: { id: string; nombre: string; color: string }[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const aMap = Object.fromEntries(asignaturas.map((a) => [a.id, a]));

  // Programación semanal (slots por docente/asignatura/curso)
  const slotsQ = useQuery({
    queryKey: ["resumen-slots", colegioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_slots")
        .select("docente_id, asistente_id, curso_id, asignatura_id")
        .eq("colegio_id", colegioId);
      if (error) throw error;
      return (data ?? []) as SlotRow[];
    },
  });

  // Clases ejecutadas registradas en libro_clases
  const libroQ = useQuery({
    queryKey: ["resumen-libro", colegioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("libro_clases")
        .select("docente_id, curso_id, asignatura_id, objetivo_logrado, fecha")
        .eq("colegio_id", colegioId);
      if (error) throw error;
      return (data ?? []) as LibroRow[];
    },
  });

  const cursosQ = useQuery({
    queryKey: ["resumen-cursos", colegioId],
    queryFn: async () => {
      const { data } = await supabase.from("cursos").select("id, nombre").eq("colegio_id", colegioId);
      return (data ?? []) as { id: string; nombre: string }[];
    },
  });
  const cMap = Object.fromEntries((cursosQ.data ?? []).map((c) => [c.id, c]));

  // Cuántas semanas han transcurrido en el año académico (Marzo-Diciembre aprox)
  // Usamos un proxy simple: fecha primera clase registrada -> hoy.
  const weeksElapsed = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), 2, 1); // 1 marzo
    const ms = today.getTime() - start.getTime();
    return Math.max(1, Math.ceil(ms / (7 * 24 * 3600 * 1000)));
  }, []);

  const resumen = useMemo(() => {
    const slots = slotsQ.data ?? [];
    const libro = libroQ.data ?? [];

    return docentes.map((d) => {
      const myPlanif = items.filter((p) => p.docente_id === d.id);
      const byEstado = ESTADOS.reduce((acc, e) => ({ ...acc, [e]: myPlanif.filter((p) => p.estado === e).length }), {} as Record<Estado, number>);

      const mySlots = slots.filter((s) => s.docente_id === d.id || s.asistente_id === d.id);
      const myLibro = libro.filter((l) => l.docente_id === d.id);

      // Detalle por asignatura+curso
      const detail = new Map<string, {
        asignaturaId: string; cursoId: string;
        slotsSemana: number; clasesProgramadas: number; clasesEjecutadas: number; objetivosLogrados: number;
      }>();

      mySlots.forEach((s) => {
        const key = `${s.asignatura_id ?? "_"}::${s.curso_id}`;
        const cur = detail.get(key) ?? { asignaturaId: s.asignatura_id ?? "", cursoId: s.curso_id, slotsSemana: 0, clasesProgramadas: 0, clasesEjecutadas: 0, objetivosLogrados: 0 };
        cur.slotsSemana += 1;
        detail.set(key, cur);
      });

      detail.forEach((v) => { v.clasesProgramadas = v.slotsSemana * weeksElapsed; });

      myLibro.forEach((l) => {
        const key = `${l.asignatura_id ?? "_"}::${l.curso_id}`;
        const cur = detail.get(key);
        if (!cur) return;
        cur.clasesEjecutadas += 1;
        if (l.objetivo_logrado) cur.objetivosLogrados += 1;
      });

      const totProg = Array.from(detail.values()).reduce((s, v) => s + v.clasesProgramadas, 0);
      const totEjec = Array.from(detail.values()).reduce((s, v) => s + v.clasesEjecutadas, 0);
      const totObj = Array.from(detail.values()).reduce((s, v) => s + v.objetivosLogrados, 0);
      const cobertura = totProg > 0 ? Math.min(100, Math.round((totEjec / totProg) * 100)) : 0;
      const efectividad = totEjec > 0 ? Math.round((totObj / totEjec) * 100) : 0;

      return {
        docente: d,
        byEstado,
        totalPlanif: myPlanif.length,
        cobertura,
        efectividad,
        clasesEjecutadas: totEjec,
        clasesProgramadas: totProg,
        detail: Array.from(detail.values()),
      };
    });
  }, [docentes, items, slotsQ.data, libroQ.data, weeksElapsed]);

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Cobertura curricular calculada sobre {weeksElapsed} semanas transcurridas desde marzo. Efectividad = % de clases con objetivo logrado (registrado en Libro de clases).
      </div>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-8"></th>
              <th className="text-left p-3">Docente</th>
              <th className="text-left p-3">Planif.</th>
              <th className="text-left p-3">Pendientes</th>
              <th className="text-left p-3">Aprobadas</th>
              <th className="text-left p-3">Clases ejec. / prog.</th>
              <th className="text-left p-3 w-48">Cobertura</th>
              <th className="text-left p-3">Efectividad</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map((r) => {
              const isOpen = expanded === r.docente.id;
              return (
                <>
                  <tr key={r.docente.id} className="border-t border-border cursor-pointer hover:bg-surface-2" onClick={() => setExpanded(isOpen ? null : r.docente.id)}>
                    <td className="p-3">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                    <td className="p-3 font-medium">{r.docente.nombre}</td>
                    <td className="p-3">{r.totalPlanif}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-xs">{r.byEstado.pendiente}</span></td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-xs">{r.byEstado.aprobada}</span></td>
                    <td className="p-3 text-xs">{r.clasesEjecutadas} / {r.clasesProgramadas}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Progress value={r.cobertura} className="h-2 flex-1" />
                        <span className="text-xs w-10 text-right">{r.cobertura}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-xs">{r.efectividad}%</td>
                  </tr>
                  {isOpen && (
                    <tr key={r.docente.id + "-det"}>
                      <td colSpan={8} className="p-0">
                        <div className="bg-surface-2/50 px-6 py-3">
                          {r.detail.length === 0 ? (
                            <div className="text-xs text-muted-foreground">Sin asignaciones en horario.</div>
                          ) : (
                            <table className="w-full text-xs">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="text-left py-1">Asignatura</th>
                                  <th className="text-left py-1">Curso</th>
                                  <th className="text-left py-1">Hrs/sem</th>
                                  <th className="text-left py-1">Ejec. / Prog.</th>
                                  <th className="text-left py-1 w-40">Cobertura</th>
                                  <th className="text-left py-1">Obj. logrados</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.detail.map((d, i) => {
                                  const cob = d.clasesProgramadas > 0 ? Math.min(100, Math.round((d.clasesEjecutadas / d.clasesProgramadas) * 100)) : 0;
                                  return (
                                    <tr key={i} className="border-t border-border/50">
                                      <td className="py-1.5">
                                        {aMap[d.asignaturaId] ? (
                                          <span className="px-1.5 py-0.5 rounded text-white text-[10px]" style={{ background: aMap[d.asignaturaId].color }}>
                                            {aMap[d.asignaturaId].nombre}
                                          </span>
                                        ) : "—"}
                                      </td>
                                      <td className="py-1.5">{cMap[d.cursoId]?.nombre ?? "—"}</td>
                                      <td className="py-1.5">{d.slotsSemana}</td>
                                      <td className="py-1.5">{d.clasesEjecutadas} / {d.clasesProgramadas}</td>
                                      <td className="py-1.5">
                                        <div className="flex items-center gap-2">
                                          <Progress value={cob} className="h-1.5 flex-1" />
                                          <span className="w-9 text-right">{cob}%</span>
                                        </div>
                                      </td>
                                      <td className="py-1.5">{d.objetivosLogrados} / {d.clasesEjecutadas}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlanifDialog({ open, onClose, docentes, asignaturas, onSubmit, loading }: {
  open: boolean; onClose: () => void;
  docentes: { id: string; nombre: string }[];
  asignaturas: { id: string; nombre: string; color: string }[];
  onSubmit: (f: Partial<Planif>) => void;
  loading: boolean;
}) {
  const now = new Date();
  const [docId, setDocId] = useState("");
  const [asigId, setAsigId] = useState("");
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [estado, setEstado] = useState<Estado>("pendiente");
  const [obs, setObs] = useState("");
  const [objetivo, setObjetivo] = useState("");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva planificación</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!docId || !asigId) return;
            onSubmit({ docente_id: docId, asignatura_id: asigId, anio, mes, estado, observaciones: obs || null, objetivo: objetivo || null });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Docente</Label>
              <Select value={docId} onValueChange={setDocId}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>{docentes.map((d) => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Asignatura</Label>
              <Select value={asigId} onValueChange={setAsigId}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>{asignaturas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mes</Label>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Año</Label>
              <Input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Objetivo de unidad</Label>
            <Input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Ej: Comprende fracciones equivalentes" />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v as Estado)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ESTADOS.map((e) => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !docId || !asigId}>{loading ? "Guardando…" : "Crear"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
