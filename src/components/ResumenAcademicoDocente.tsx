import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { GraduationCap, TrendingUp, TrendingDown, ClipboardList, Users, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useMyDocente } from "@/lib/use-my-docente";
import { EmptyState } from "@/components/EmptyState";
import { ExportMenu } from "@/components/ExportMenu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Curso { id: string; nombre: string; nivel: string; prof_jefe_id: string | null }
interface Asig { id: string; nombre: string; color: string }
interface Alumno { id: string; nombres: string; apellidos: string; numero_lista: number | null }
interface Nota {
  id: string; alumno_id: string; asignatura_id: string;
  nota: number; ponderacion: number;
  descripcion: string | null; fecha: string;
}

type Periodo = "sem1" | "sem2" | "anio" | "custom";

const NOTA_APROBACION = 4.0;
const currentYear = new Date().getFullYear();

function rangoPeriodo(p: Periodo, anio: number, from: string, to: string): { desde: string; hasta: string } {
  if (p === "sem1") return { desde: `${anio}-03-01`, hasta: `${anio}-07-31` };
  if (p === "sem2") return { desde: `${anio}-08-01`, hasta: `${anio}-12-31` };
  if (p === "anio") return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
  return { desde: from, hasta: to };
}

function notaColor(n: number) {
  if (n >= 5.5) return "text-emerald-600 font-semibold";
  if (n >= NOTA_APROBACION) return "text-amber-600 font-semibold";
  return "text-destructive font-semibold";
}

export function ResumenAcademicoDocente() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const { data: docente, isLoading: loadDoc } = useMyDocente();

  const [cursoId, setCursoId] = useState<string>("");
  const [asigId, setAsigId] = useState<string>("all");
  const [periodo, setPeriodo] = useState<Periodo>("sem1");
  const [anio, setAnio] = useState<number>(currentYear);
  const [from, setFrom] = useState<string>(`${currentYear}-03-01`);
  const [to, setTo] = useState<string>(`${currentYear}-07-31`);

  const { desde, hasta } = rangoPeriodo(periodo, anio, from, to);

  // Cursos del docente (jefe o con slots asignados)
  const cursosQ = useQuery({
    queryKey: ["mra-cursos", colegioId, docente?.id],
    enabled: !!colegioId && !!docente?.id,
    queryFn: async () => {
      const [{ data: cursos }, { data: slots }] = await Promise.all([
        supabase.from("cursos").select("id, nombre, nivel, prof_jefe_id").eq("colegio_id", colegioId!).order("nombre"),
        supabase.from("schedule_slots").select("curso_id").eq("docente_id", docente!.id),
      ]);
      const ids = new Set<string>();
      (slots ?? []).forEach((s) => s.curso_id && ids.add(s.curso_id as string));
      const mine = (cursos ?? []).filter((c) =>
        c.prof_jefe_id === docente!.id || ids.has(c.id)
      );
      return mine as Curso[];
    },
  });

  // Asignaturas del docente para el curso
  const asignaturasQ = useQuery({
    queryKey: ["mra-asignaturas", colegioId, docente?.id, cursoId],
    enabled: !!colegioId && !!docente?.id && !!cursoId,
    queryFn: async () => {
      const esJefe = (cursosQ.data ?? []).find((c) => c.id === cursoId)?.prof_jefe_id === docente!.id;
      let asigIds: Set<string>;
      if (esJefe) {
        // Jefe: todas las asignaturas del curso
        const { data } = await supabase.from("schedule_slots").select("asignatura_id").eq("curso_id", cursoId);
        asigIds = new Set((data ?? []).map((s) => s.asignatura_id as string).filter(Boolean));
      } else {
        const { data } = await supabase.from("schedule_slots")
          .select("asignatura_id").eq("curso_id", cursoId).eq("docente_id", docente!.id);
        asigIds = new Set((data ?? []).map((s) => s.asignatura_id as string).filter(Boolean));
      }
      if (asigIds.size === 0) return [] as Asig[];
      const { data } = await supabase.from("asignaturas")
        .select("id, nombre, color").eq("colegio_id", colegioId!).in("id", Array.from(asigIds)).order("nombre");
      return (data ?? []) as Asig[];
    },
  });

  const alumnosQ = useQuery({
    queryKey: ["mra-alumnos", cursoId],
    enabled: !!cursoId,
    queryFn: async () => {
      const { data, error } = await supabase.from("alumnos")
        .select("id, nombres, apellidos, numero_lista")
        .eq("curso_id", cursoId);
      if (error) throw error;
      return ((data ?? []) as Alumno[]).sort((a, b) => {
        const na = a.numero_lista ?? 9999;
        const nb = b.numero_lista ?? 9999;
        if (na !== nb) return na - nb;
        return `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`);
      });
    },
  });

  const notasQ = useQuery({
    queryKey: ["mra-notas", cursoId, asigId, desde, hasta],
    enabled: !!cursoId,
    queryFn: async () => {
      let q = supabase.from("calificaciones")
        .select("id, alumno_id, asignatura_id, nota, ponderacion, descripcion, fecha")
        .eq("curso_id", cursoId).gte("fecha", desde).lte("fecha", hasta);
      if (asigId !== "all") q = q.eq("asignatura_id", asigId);
      const { data, error } = await q.order("fecha");
      if (error) throw error;
      return (data ?? []) as Nota[];
    },
  });

  const asigVisibles = useMemo(() => {
    const all = asignaturasQ.data ?? [];
    if (asigId === "all") return all;
    return all.filter((a) => a.id === asigId);
  }, [asignaturasQ.data, asigId]);

  const alumnos = alumnosQ.data ?? [];
  const notas = notasQ.data ?? [];

  // Promedio ponderado por alumno+asignatura
  function promAlumnoAsig(alumnoId: string, asignaturaId: string): number | null {
    const ns = notas.filter((n) => n.alumno_id === alumnoId && n.asignatura_id === asignaturaId);
    if (ns.length === 0) return null;
    let sum = 0, w = 0;
    for (const n of ns) {
      const p = Number(n.ponderacion || 1);
      sum += Number(n.nota) * p;
      w += p;
    }
    return w > 0 ? sum / w : null;
  }

  // Promedio general por alumno (promedio de sus asignaturas con nota)
  function promAlumno(alumnoId: string): number | null {
    const proms = asigVisibles.map((a) => promAlumnoAsig(alumnoId, a.id)).filter((v): v is number => v !== null);
    if (proms.length === 0) return null;
    return proms.reduce((s, x) => s + x, 0) / proms.length;
  }

  // Vista por asignatura (sólo si una asignatura seleccionada)
  const evalsAsig = useMemo(() => {
    if (asigId === "all") return [];
    const key = (n: Nota) => `${n.descripcion ?? ""}__${n.fecha}__${n.ponderacion}`;
    const map = new Map<string, { descripcion: string; fecha: string; ponderacion: number; notas: Record<string, Nota> }>();
    for (const n of notas) {
      const k = key(n);
      let e = map.get(k);
      if (!e) {
        e = { descripcion: n.descripcion ?? "Evaluación", fecha: n.fecha, ponderacion: Number(n.ponderacion || 1), notas: {} };
        map.set(k, e);
      }
      e.notas[n.alumno_id] = n;
    }
    return Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [notas, asigId]);

  // Indicadores
  const stats = useMemo(() => {
    if (alumnos.length === 0 || asigVisibles.length === 0) return null;
    // Promedio general curso: promedio de promedios de alumnos
    const promAlumnos = alumnos.map((al) => promAlumno(al.id)).filter((v): v is number => v !== null);
    const promGeneral = promAlumnos.length ? promAlumnos.reduce((s, x) => s + x, 0) / promAlumnos.length : null;
    // Por asignatura
    const porAsig = asigVisibles.map((a) => {
      const proms = alumnos.map((al) => promAlumnoAsig(al.id, a.id)).filter((v): v is number => v !== null);
      const prom = proms.length ? proms.reduce((s, x) => s + x, 0) / proms.length : null;
      const notasA = notas.filter((n) => n.asignatura_id === a.id);
      return { asig: a, prom, count: notasA.length };
    });
    // Notas crudas para max/min
    const filteredNotas = notas.map((n) => Number(n.nota));
    const notaMax = filteredNotas.length ? Math.max(...filteredNotas) : null;
    const notaMin = filteredNotas.length ? Math.min(...filteredNotas) : null;
    // Bajo aprobación
    const bajo = promAlumnos.filter((p) => p < NOTA_APROBACION).length;
    // Distribución
    const dist = { rojos: 0, amarillos: 0, verdes: 0 };
    for (const p of promAlumnos) {
      if (p < NOTA_APROBACION) dist.rojos++;
      else if (p < 5.5) dist.amarillos++;
      else dist.verdes++;
    }
    return { promGeneral, porAsig, notaMax, notaMin, bajo, dist, totalEval: notas.length, alumnosConNota: promAlumnos.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnos, asigVisibles, notas]);

  // Rows de exportación (vista actual)
  const exportRows = useMemo(() => {
    if (asigId === "all") {
      return alumnos.map((al, idx) => {
        const row: Record<string, string | number> = {
          "N°": al.numero_lista ?? idx + 1,
          Estudiante: `${al.apellidos}, ${al.nombres}`,
        };
        for (const a of asigVisibles) {
          const p = promAlumnoAsig(al.id, a.id);
          row[a.nombre] = p !== null ? Number(p.toFixed(1)) : "";
        }
        const pg = promAlumno(al.id);
        row["Promedio"] = pg !== null ? Number(pg.toFixed(2)) : "";
        return row;
      });
    }
    return alumnos.map((al, idx) => {
      const row: Record<string, string | number> = {
        "N°": al.numero_lista ?? idx + 1,
        Estudiante: `${al.apellidos}, ${al.nombres}`,
      };
      evalsAsig.forEach((e, i) => {
        const n = e.notas[al.id];
        row[`${i + 1}. ${e.descripcion} (${e.fecha})`] = n ? Number(n.nota) : "";
      });
      const p = promAlumnoAsig(al.id, asigId);
      row["Promedio"] = p !== null ? Number(p.toFixed(2)) : "";
      return row;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnos, asigVisibles, evalsAsig, asigId]);

  const cursoSel = (cursosQ.data ?? []).find((c) => c.id === cursoId);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 no-print">
        <p className="text-sm text-muted-foreground">Notas por curso, asignatura y período</p>
        <ExportMenu
          rows={exportRows}
          filename={`resumen-academico-${cursoSel?.nombre ?? "curso"}-${periodo}`}
          title={`Resumen académico ${cursoSel?.nombre ?? ""}`}
        />
      </div>

      {!loadDoc && !docente && (
        <EmptyState icon={GraduationCap} title="Cuenta no vinculada" description="Pide al administrador vincular tu cuenta docente." />
      )}

      {docente && (
        <>
          {/* Filtros */}
          <div className="bg-card border rounded-lg p-4 mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">Curso</Label>
              <Select value={cursoId} onValueChange={setCursoId}>
                <SelectTrigger><SelectValue placeholder="Selecciona curso" /></SelectTrigger>
                <SelectContent>
                  {(cursosQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Asignatura</Label>
              <Select value={asigId} onValueChange={setAsigId} disabled={!cursoId}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(asignaturasQ.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Período</Label>
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem1">Semestre 1</SelectItem>
                  <SelectItem value="sem2">Semestre 2</SelectItem>
                  <SelectItem value="anio">Año completo</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Año</Label>
              <Input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
            </div>
            {periodo === "custom" ? (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Desde</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Hasta</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground self-end pb-2">
                {desde} → {hasta}
              </div>
            )}
          </div>

          {!cursoId && (
            <EmptyState icon={ClipboardList} title="Selecciona un curso" description="Elige uno de tus cursos para ver el resumen académico." />
          )}

          {cursoId && stats && (
            <>
              {/* Indicadores */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
                <Kpi icon={Award} label="Promedio curso" value={stats.promGeneral !== null ? stats.promGeneral.toFixed(2) : "—"} tone={stats.promGeneral !== null ? (stats.promGeneral >= 5.5 ? "ok" : stats.promGeneral >= NOTA_APROBACION ? "warn" : "bad") : "neutral"} />
                <Kpi icon={TrendingUp} label="Nota máxima" value={stats.notaMax !== null ? stats.notaMax.toFixed(1) : "—"} tone="ok" />
                <Kpi icon={TrendingDown} label="Nota mínima" value={stats.notaMin !== null ? stats.notaMin.toFixed(1) : "—"} tone={stats.notaMin !== null && stats.notaMin < NOTA_APROBACION ? "bad" : "neutral"} />
                <Kpi icon={ClipboardList} label="Evaluaciones" value={String(stats.totalEval)} tone="neutral" hint="notas registradas" />
                <Kpi icon={Users} label="Bajo aprobación" value={String(stats.bajo)} tone={stats.bajo > 0 ? "bad" : "ok"} hint={`de ${stats.alumnosConNota} c/nota`} />
                <Kpi icon={GraduationCap} label="Distribución" value={`${stats.dist.verdes}/${stats.dist.amarillos}/${stats.dist.rojos}`} tone="neutral" hint="≥5.5 / 4.0-5.4 / <4.0" />
              </div>

              {/* Promedios por asignatura */}
              {asigId === "all" && (
                <div className="bg-card border rounded-lg overflow-hidden mb-4">
                  <div className="px-4 py-3 border-b bg-surface-2">
                    <h3 className="text-sm font-semibold">Promedios por asignatura</h3>
                  </div>
                  <div className="divide-y">
                    {stats.porAsig.map(({ asig, prom, count }) => (
                      <div key={asig.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: asig.color }} />
                        <div className="flex-1 text-sm font-medium">{asig.nombre}</div>
                        <div className="text-xs text-muted-foreground">{count} notas</div>
                        <div className={`text-sm w-14 text-right ${prom !== null ? notaColor(prom) : "text-muted-foreground"}`}>
                          {prom !== null ? prom.toFixed(2) : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabla principal */}
              <div className="bg-card border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b bg-surface-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    {asigId === "all" ? "Vista por estudiante" : `Vista por asignatura — ${asigVisibles[0]?.nombre ?? ""}`}
                  </h3>
                  <span className="text-xs text-muted-foreground">{alumnos.length} estudiantes</span>
                </div>
                {alumnos.length === 0 ? (
                  <EmptyState icon={Users} title="Sin estudiantes" description="Este curso no tiene estudiantes." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-2 text-xs text-muted-foreground">
                        <tr>
                          <th className="text-left px-3 py-2 w-10">N°</th>
                          <th className="text-left px-3 py-2">Estudiante</th>
                          {asigId === "all"
                            ? asigVisibles.map((a) => (
                                <th key={a.id} className="text-right px-2 py-2 whitespace-nowrap">
                                  <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: a.color }} />
                                  {a.nombre}
                                </th>
                              ))
                            : evalsAsig.map((e, i) => (
                                <th key={i} className="text-right px-2 py-2 whitespace-nowrap">
                                  <div className="font-medium">{e.descripcion}</div>
                                  <div className="text-[10px] font-normal">{e.fecha} · ×{e.ponderacion}</div>
                                </th>
                              ))}
                          <th className="text-right px-3 py-2 bg-primary/5">Promedio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alumnos.map((al, idx) => {
                          const pgen = asigId === "all" ? promAlumno(al.id) : promAlumnoAsig(al.id, asigId);
                          return (
                            <tr key={al.id} className="border-t hover:bg-surface-2/40">
                              <td className="px-3 py-2 text-muted-foreground">{al.numero_lista ?? idx + 1}</td>
                              <td className="px-3 py-2">{al.apellidos}, {al.nombres}</td>
                              {asigId === "all"
                                ? asigVisibles.map((a) => {
                                    const p = promAlumnoAsig(al.id, a.id);
                                    return (
                                      <td key={a.id} className="text-right px-2 py-2">
                                        {p !== null ? <span className={notaColor(p)}>{p.toFixed(1)}</span> : <span className="text-muted-foreground">—</span>}
                                      </td>
                                    );
                                  })
                                : evalsAsig.map((e, i) => {
                                    const n = e.notas[al.id];
                                    return (
                                      <td key={i} className="text-right px-2 py-2">
                                        {n ? <span className={notaColor(Number(n.nota))}>{Number(n.nota).toFixed(1)}</span> : <span className="text-muted-foreground">—</span>}
                                      </td>
                                    );
                                  })}
                              <td className="text-right px-3 py-2 bg-primary/5">
                                {pgen !== null ? <span className={notaColor(pgen)}>{pgen.toFixed(2)}</span> : <span className="text-muted-foreground">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="border-t bg-surface-2/60 font-semibold">
                          <td className="px-3 py-2" colSpan={2}>Promedio curso</td>
                          {asigId === "all"
                            ? asigVisibles.map((a) => {
                                const item = stats.porAsig.find((x) => x.asig.id === a.id);
                                return (
                                  <td key={a.id} className="text-right px-2 py-2">
                                    {item?.prom !== null && item?.prom !== undefined ? <span className={notaColor(item.prom)}>{item.prom.toFixed(2)}</span> : "—"}
                                  </td>
                                );
                              })
                            : evalsAsig.map((e, i) => {
                                const arr = Object.values(e.notas).map((n) => Number(n.nota));
                                const p = arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
                                return (
                                  <td key={i} className="text-right px-2 py-2">
                                    {p !== null ? <span className={notaColor(p)}>{p.toFixed(2)}</span> : "—"}
                                  </td>
                                );
                              })}
                          <td className="text-right px-3 py-2 bg-primary/10">
                            {stats.promGeneral !== null ? <span className={notaColor(stats.promGeneral)}>{stats.promGeneral.toFixed(2)}</span> : "—"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; hint?: string;
  tone: "ok" | "warn" | "bad" | "neutral";
}) {
  const toneCls = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="bg-card border rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className={`text-xl font-bold ${toneCls}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
