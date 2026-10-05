import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, BookOpen, CalendarCheck, GraduationCap, MessageSquare, RefreshCw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useMyDocente } from "@/lib/use-my-docente";
import { useUserRoles } from "@/lib/use-role";
import { useColegioConfig } from "@/lib/use-colegio-config";
import { usePersistentState } from "@/lib/use-persistent-state";
import { PageHeader } from "@/components/PageHeader";
import { ResumenAcademicoDocente } from "@/components/ResumenAcademicoDocente";
import { ExportMenu } from "@/components/ExportMenu";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/mis-resumenes")({
  head: () => ({ meta: [{ title: "Resumen mensual — HorarioES" }] }),
  component: MisResumenesPage,
});

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function MisResumenesPage() {
  const [tab, setTab] = useState<"asistencia" | "academico">(
    typeof window !== "undefined" && window.location.search.includes("tab=academico") ? "academico" : "asistencia",
  );
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const queryClient = useQueryClient();
  const { data: roles = [], isLoading: rolesLoading } = useUserRoles();
  const { data: docente } = useMyDocente();
  const docenteId = docente?.id;
  const { data: cfg } = useColegioConfig();
  const umbral = cfg?.asistencia_min_pct ?? 85;

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [cursoId, setCursoId] = useState<string>("");
  const [asigId, setAsigId] = useState<string>("");
  type Rango = "mes" | "bimestre" | "trimestre" | "semestre" | "anio" | "personalizado";
  const [rango, setRango] = useState<Rango>("mes");
  const fmtInit = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [customDesde, setCustomDesde] = useState<string>(fmtInit(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [customHasta, setCustomHasta] = useState<string>(fmtInit(today));

  // mis cursos via schedule_slots
  const { data: slots = [] } = useQuery({
    queryKey: ["mis-slots-resumen", docenteId],
    enabled: !!docenteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_slots")
        .select("curso_id, asignatura_id")
        .eq("docente_id", docenteId!);
      if (error) throw error;
      return (data ?? []) as { curso_id: string; asignatura_id: string | null }[];
    },
  });

  const cursoIds = useMemo(() => Array.from(new Set(slots.map((s) => s.curso_id))), [slots]);
  const asigIdsCurso = useMemo(
    () => Array.from(new Set(
      slots.filter((s) => s.curso_id === cursoId).map((s) => s.asignatura_id).filter(Boolean) as string[],
    )),
    [slots, cursoId],
  );

  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-min", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos").select("id, nombre").eq("colegio_id", colegioId!).order("nombre");
      if (error) throw error;
      return data as { id: string; nombre: string }[];
    },
  });

  const { data: asignaturas = [] } = useQuery({
    queryKey: ["asigs-min", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asignaturas").select("id, nombre").eq("colegio_id", colegioId!).order("nombre");
      if (error) throw error;
      return data as { id: string; nombre: string }[];
    },
  });

  const cursosMine = cursos.filter((c) => cursoIds.includes(c.id));
  const asigMine = asignaturas.filter((a) => asigIdsCurso.includes(a.id));

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const { desde, hasta, periodoLabel } = useMemo(() => {
    let dFrom: Date, dTo: Date, label: string;
    if (rango === "mes") {
      dFrom = new Date(year, month, 1);
      dTo = new Date(year, month + 1, 0);
      label = `${MESES[month]} ${year}`;
    } else if (rango === "bimestre") {
      const start = month - (month % 2);
      dFrom = new Date(year, start, 1);
      dTo = new Date(year, start + 2, 0);
      label = `Bimestre ${MESES[start]}–${MESES[start + 1]} ${year}`;
    } else if (rango === "trimestre") {
      const start = month - (month % 3);
      dFrom = new Date(year, start, 1);
      dTo = new Date(year, start + 3, 0);
      label = `Trimestre ${MESES[start]}–${MESES[start + 2]} ${year}`;
    } else if (rango === "semestre") {
      const start = month < 6 ? 0 : 6;
      dFrom = new Date(year, start, 1);
      dTo = new Date(year, start + 6, 0);
      label = `${start === 0 ? "1er" : "2do"} Semestre ${year}`;
    } else if (rango === "anio") {
      dFrom = new Date(year, 0, 1);
      dTo = new Date(year, 12, 0);
      label = `Año ${year}`;
    } else {
      // personalizado: usar fechas manuales
      const [fy, fm, fd] = customDesde.split("-").map(Number);
      const [ty, tm, td] = customHasta.split("-").map(Number);
      dFrom = new Date(fy, (fm || 1) - 1, fd || 1);
      dTo = new Date(ty, (tm || 1) - 1, td || 1);
      label = `${customDesde} a ${customHasta}`;
    }
    return { desde: fmt(dFrom), hasta: fmt(dTo), periodoLabel: label };
  }, [rango, month, year, customDesde, customHasta]);
  const enabled = !!cursoId && !!colegioId;

  const asistQ = useQuery({
    queryKey: ["res-asist", cursoId, desde, hasta], enabled,
    queryFn: async () => {
      const pageSize = 1000;
      let from = 0;
      const rows: { alumno_id: string; estado: string; fecha: string }[] = [];

      while (true) {
        const { data, error } = await supabase.from("asistencias")
          .select("alumno_id, estado, fecha")
          .eq("curso_id", cursoId)
          .gte("fecha", desde)
          .lte("fecha", hasta)
          .order("fecha", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;

        const page = (data ?? []) as { alumno_id: string; estado: string; fecha: string }[];
        rows.push(...page);
        if (page.length < pageSize) break;
        from += pageSize;
      }

      return rows;
    },
  });

  const atrasosQ = useQuery({
    queryKey: ["res-atr", cursoId, desde, hasta], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("atrasos")
        .select("id").eq("curso_id", cursoId).gte("fecha", desde).lte("fecha", hasta);
      if (error) throw error;
      return data as { id: string }[];
    },
  });

  const retirosQ = useQuery({
    queryKey: ["res-ret", cursoId, desde, hasta], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("retiros")
        .select("id").eq("curso_id", cursoId).gte("fecha", desde).lte("fecha", hasta);
      if (error) throw error;
      return data as { id: string }[];
    },
  });

  const libroQ = useQuery({
    queryKey: ["res-libro", cursoId, asigId, docenteId, desde, hasta],
    enabled: enabled && !!docenteId,
    queryFn: async () => {
      let q = supabase.from("libro_clases")
        .select("id, asignatura_id, objetivo_logrado, fecha, contenido")
        .eq("curso_id", cursoId).eq("docente_id", docenteId!)
        .gte("fecha", desde).lte("fecha", hasta);
      if (asigId) q = q.eq("asignatura_id", asigId);
      const { data, error } = await q;
      if (error) throw error;
      return data as { id: string; asignatura_id: string | null; objetivo_logrado: boolean | null; fecha: string; contenido: string | null }[];
    },
  });

  const califQ = useQuery({
    queryKey: ["res-calif", cursoId, asigId, desde, hasta], enabled,
    queryFn: async () => {
      let q = supabase.from("calificaciones")
        .select("alumno_id, nota, descripcion, fecha")
        .eq("curso_id", cursoId).gte("fecha", desde).lte("fecha", hasta);
      if (asigId) q = q.eq("asignatura_id", asigId);
      const { data, error } = await q;
      if (error) throw error;
      return data as { alumno_id: string; nota: number; descripcion: string | null; fecha: string }[];
    },
  });

  const anotQ = useQuery({
    queryKey: ["res-anot", cursoId, desde, hasta], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("anotaciones")
        .select("id, tipo, descripcion, fecha")
        .eq("curso_id", cursoId).gte("fecha", desde).lte("fecha", hasta);
      if (error) throw error;
      return data as { id: string; tipo: string; descripcion: string; fecha: string }[];
    },
  });

  const alumnosQ = useQuery({
    queryKey: ["alumnos-curso-min", cursoId], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("alumnos")
        .select("id, nombres, apellidos, numero_lista")
        .eq("curso_id", cursoId).is("retirado_en", null)
        .order("numero_lista", { nullsFirst: false })
        .order("apellidos");
      if (error) throw error;
      return data as { id: string; nombres: string; apellidos: string; numero_lista: number | null }[];
    },
  });

  const alumnoMap = useMemo(
    () => Object.fromEntries((alumnosQ.data ?? []).map((a) => [a.id, `${a.apellidos}, ${a.nombres}`])),
    [alumnosQ.data],
  );

  const stats = useMemo(() => {
    const asist = asistQ.data ?? [];
    const total = asist.length;
    const presentes = asist.filter((a) => a.estado === "presente" || a.estado === "atrasado").length;
    const ausentes = asist.filter((a) => a.estado === "ausente").length;
    const pct = total ? (presentes / total) * 100 : 0;

    // Per-student day-based counts (distinct days)
    const diasCursoSet = new Set(asist.map((a) => a.fecha));
    const totalDiasCurso = diasCursoSet.size;
    const perAlumnoDays: Record<string, { asistidos: Set<string>; faltados: Set<string>; dias: Set<string> }> = {};
    asist.forEach((a) => {
      const r = perAlumnoDays[a.alumno_id] ?? { asistidos: new Set(), faltados: new Set(), dias: new Set() };
      r.dias.add(a.fecha);
      if (a.estado === "presente" || a.estado === "atrasado") r.asistidos.add(a.fecha);
      else if (a.estado === "ausente") r.faltados.add(a.fecha);
      perAlumnoDays[a.alumno_id] = r;
    });
    const porAlumno = (alumnosQ.data ?? []).map((al) => {
      const r = perAlumnoDays[al.id];
      const asistidos = r?.asistidos.size ?? 0;
      const faltadosReg = r?.faltados.size ?? 0;
      const registrados = r?.dias.size ?? 0;
      const base = totalDiasCurso;
      const faltados = Math.max(faltadosReg, base - asistidos);
      const sinRegistro = Math.max(0, base - registrados);
      const pctAl = base ? (asistidos / base) * 100 : 0;
      return { id: al.id, nombre: `${al.apellidos}, ${al.nombres}`, asistidos, faltados, dias: base, pct: pctAl, sinRegistro };
    });

    // Fechas detectadas (con asistencia registrada) y fechas hábiles faltantes en el rango
    const fechasDetectadas = Array.from(diasCursoSet).sort();
    const conteoPorFecha: Record<string, number> = {};
    asist.forEach((a) => { conteoPorFecha[a.fecha] = (conteoPorFecha[a.fecha] ?? 0) + 1; });
    const detFechas = fechasDetectadas.map((f) => ({ fecha: f, registros: conteoPorFecha[f] ?? 0 }));

    const fechasFaltantes: string[] = [];
    if (desde && hasta) {
      const [fy, fm, fd] = desde.split("-").map(Number);
      const [ty, tm, td] = hasta.split("-").map(Number);
      const cur = new Date(fy, fm - 1, fd);
      const end = new Date(ty, tm - 1, td);
      while (cur <= end) {
        const dow = cur.getDay(); // 0 dom, 6 sáb
        if (dow !== 0 && dow !== 6) {
          const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
          if (!diasCursoSet.has(iso)) fechasFaltantes.push(iso);
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    const enRiesgo = porAlumno
      .filter((v) => v.dias >= 3 && v.pct < umbral)
      .map((v) => ({ id: v.id, pct: v.pct }))
      .sort((a, b) => a.pct - b.pct);

    const libro = libroQ.data ?? [];
    const clases = libro.length;
    const completados = libro.filter((l) => l.objetivo_logrado).length;
    const pendientes = clases - completados;
    const cumplimiento = clases ? (completados / clases) * 100 : 0;

    const notas = califQ.data ?? [];
    const promedio = notas.length ? notas.reduce((s, n) => s + Number(n.nota), 0) / notas.length : 0;
    const evals = new Set(notas.map((n) => `${n.descripcion}|${n.fecha}`)).size;
    const dist = {
      rojos: notas.filter((n) => Number(n.nota) < 4).length,
      amarillos: notas.filter((n) => Number(n.nota) >= 4 && Number(n.nota) < 5.5).length,
      verdes: notas.filter((n) => Number(n.nota) >= 5.5).length,
    };
    const accAlumno: Record<string, { s: number; n: number }> = {};
    notas.forEach((n) => {
      const r = accAlumno[n.alumno_id] ?? { s: 0, n: 0 };
      r.s += Number(n.nota); r.n++; accAlumno[n.alumno_id] = r;
    });
    const bajoRend = Object.entries(accAlumno)
      .filter(([, v]) => v.s / v.n < 4)
      .map(([id, v]) => ({ id, prom: v.s / v.n }));

    const anot = anotQ.data ?? [];
    const pos = anot.filter((a) => a.tipo === "positiva").length;
    const neg = anot.filter((a) => a.tipo === "negativa").length;
    const neu = anot.length - pos - neg;

    return {
      asistencia: { pct, total, presentes, ausentes, enRiesgo, porAlumno, totalDiasCurso },
      diag: { detFechas, fechasFaltantes },
      atrasos: atrasosQ.data?.length ?? 0,
      retiros: retirosQ.data?.length ?? 0,
      libro: { clases, completados, pendientes, cumplimiento },
      eval: { count: evals, promedio, dist, bajoRend },
      conv: { pos, neg, neu, items: anot },
    };
  }, [asistQ.data, libroQ.data, califQ.data, anotQ.data, atrasosQ.data, retirosQ.data, alumnosQ.data, umbral, desde, hasta]);

  const obsKey = `obs-resumen:${cursoId}:${asigId || "all"}:${year}-${month}`;
  const [obs, setObs] = usePersistentState<string>(obsKey, "");

  const exportRows = useMemo(() => {
    if (!cursoId) return [];
    const cur = cursos.find((c) => c.id === cursoId)?.nombre ?? "";
    const asg = asigId ? (asignaturas.find((a) => a.id === asigId)?.nombre ?? "") : "Todas";
    return stats.asistencia.porAlumno.map((a) => ({
      Curso: cur,
      Asignatura: asg,
      Período: periodoLabel,
      Estudiante: a.nombre,
      "Días totales": a.dias,
      "Días asistidos": a.asistidos,
      "Días faltados": a.faltados,
      "Asistencia %": a.pct.toFixed(1),
    }));
  }, [cursoId, cursos, asignaturas, asigId, periodoLabel, stats.asistencia.porAlumno]);

  if (!rolesLoading && !roles.includes("docente")) {
    return (
      <div>
        <PageHeader title="Resumen mensual" subtitle="Vista exclusiva del docente" />
        <EmptyState icon={AlertTriangle} title="Disponible solo para docentes"
          description="Este módulo es exclusivo del perfil docente con cursos asignados." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Resúmenes de mis cursos"
        subtitle="Asistencia por estudiante y consolidado por mes, bimestre, trimestre, semestre o año"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["res-asist", cursoId, desde, hasta] })}
              disabled={!cursoId}
              title="Recalcular usando las fechas con asistencia registrada"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Recalcular
            </Button>
            <ExportMenu rows={exportRows}
              filename={`resumen-${cursoId || "curso"}-${rango}-${year}-${String(month + 1).padStart(2, "0")}`}
              title={`Resumen ${periodoLabel}`} disabled={!cursoId} />
          </div>
        }
      />

      <div className="inline-flex rounded-md border border-border overflow-hidden mb-4 no-print">
        {(["asistencia", "academico"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-surface hover:bg-surface-2 text-muted-foreground"
            }`}
          >
            {t === "asistencia" ? "Asistencia" : "Académico"}
          </button>
        ))}
      </div>

      {tab === "academico" && <ResumenAcademicoDocente />}

      {tab === "asistencia" && (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Field label="Rango">
          <Select value={rango} onValueChange={(v) => setRango(v as Rango)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Mes</SelectItem>
              <SelectItem value="bimestre">Bimestre</SelectItem>
              <SelectItem value="trimestre">Trimestre</SelectItem>
              <SelectItem value="semestre">Semestre</SelectItem>
              <SelectItem value="anio">Año</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Curso">
          <Select value={cursoId} onValueChange={(v) => { setCursoId(v); setAsigId(""); }}>
            <SelectTrigger><SelectValue placeholder="Selecciona curso" /></SelectTrigger>
            <SelectContent>
              {cursosMine.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Sin cursos asignados</div>}
              {cursosMine.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Asignatura">
          <Select value={asigId || "__all"} onValueChange={(v) => setAsigId(v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas</SelectItem>
              {asigMine.map((a) => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        {rango === "personalizado" ? (
          <>
            <Field label="Desde">
              <input type="date" value={customDesde} onChange={(e) => setCustomDesde(e.target.value)}
                className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm" />
            </Field>
            <Field label="Hasta">
              <input type="date" value={customHasta} onChange={(e) => setCustomHasta(e.target.value)}
                className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm" />
            </Field>
          </>
        ) : (
          <>
            <Field label="Mes">
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Año">
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((y) =>
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}
      </div>

      {!cursoId ? (
        <EmptyState icon={GraduationCap} title="Selecciona un curso"
          description="Elige uno de tus cursos para generar el resumen del mes." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <KPI icon={CalendarCheck} label={`Asistencia (${periodoLabel})`}
              value={`${stats.asistencia.pct.toFixed(1)}%`}
              sub={`${stats.asistencia.totalDiasCurso} día(s) de clase`}
              tone={stats.asistencia.total > 0 && stats.asistencia.pct < umbral ? "warning" : "ok"} />
            <KPI icon={BookOpen} label="Cumplimiento libro"
              value={`${stats.libro.cumplimiento.toFixed(0)}%`}
              sub={`${stats.libro.completados}/${stats.libro.clases} con objetivo`} />
            <KPI icon={Target} label="Cobertura curricular"
              value={`${stats.libro.cumplimiento.toFixed(0)}%`}
              sub="Aproximada por objetivos logrados" />
            <KPI icon={GraduationCap} label="Promedio del curso"
              value={stats.eval.promedio ? stats.eval.promedio.toFixed(2) : "—"}
              sub={`${stats.eval.count} evaluación(es)`}
              tone={stats.eval.promedio > 0 && stats.eval.promedio < 4 ? "warning" : "ok"} />
          </div>

          {(stats.asistencia.pct > 0 && stats.asistencia.pct < umbral) || stats.eval.bajoRend.length > 0 || stats.libro.pendientes > 0 ? (
            <Card className="p-3 mb-4 border-warning/40 bg-warning/5">
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-warning shrink-0" />
                <div className="space-y-1">
                  {stats.asistencia.pct > 0 && stats.asistencia.pct < umbral && (
                    <div>Asistencia del curso ({stats.asistencia.pct.toFixed(1)}%) bajo el umbral ({umbral}%).</div>
                  )}
                  {stats.libro.pendientes > 0 && (
                    <div>{stats.libro.pendientes} clase(s) registradas sin objetivo logrado.</div>
                  )}
                  {stats.eval.bajoRend.length > 0 && (
                    <div>{stats.eval.bajoRend.length} estudiante(s) con promedio bajo 4.0.</div>
                  )}
                </div>
              </div>
            </Card>
          ) : null}

          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CalendarCheck className="w-4 h-4" /> Asistencia por estudiante — {periodoLabel}
              </h3>
              <span className="text-xs text-muted-foreground">
                {stats.asistencia.totalDiasCurso} día(s) de clase en el período
              </span>
            </div>
            {stats.asistencia.porAlumno.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin registros de asistencia en el período.</p>
            ) : (
              <div className="overflow-auto max-h-[420px] border border-border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Estudiante</th>
                      <th className="px-3 py-2 font-medium text-right">Total días</th>
                      <th className="px-3 py-2 font-medium text-right">Asistidos</th>
                      <th className="px-3 py-2 font-medium text-right">Faltados</th>
                      <th className="px-3 py-2 font-medium text-right" title="Días de clase del curso sin registro para el estudiante">Sin registro</th>
                      <th className="px-3 py-2 font-medium text-right">% Asistencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.asistencia.porAlumno.map((a) => {
                      const bajo = a.dias >= 3 && a.pct < umbral;
                      return (
                        <tr key={a.id} className="border-t border-border">
                          <td className="px-3 py-1.5 truncate">{a.nombre}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{a.dias}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{a.asistidos}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{a.faltados}</td>
                          <td className={`px-3 py-1.5 text-right tabular-nums ${a.sinRegistro > 0 ? "text-warning" : "text-muted-foreground"}`}>
                            {a.sinRegistro}
                          </td>
                          <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${bajo ? "text-warning" : ""}`}>
                            {a.pct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CalendarCheck className="w-4 h-4" /> Diagnóstico de fechas — {periodoLabel}
              </h3>
              <span className="text-xs text-muted-foreground">
                {stats.diag.detFechas.length} detectada(s) · {stats.diag.fechasFaltantes.length} hábil(es) sin registro
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-border rounded-md">
                <div className="px-3 py-1.5 text-xs font-medium bg-muted/40 border-b border-border">
                  Fechas de clase detectadas ({stats.diag.detFechas.length})
                </div>
                {stats.diag.detFechas.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">Sin fechas registradas.</p>
                ) : (
                  <div className="max-h-56 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/20 sticky top-0">
                        <tr className="text-left">
                          <th className="px-3 py-1.5 font-medium">Fecha</th>
                          <th className="px-3 py-1.5 font-medium text-right">Registros</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.diag.detFechas.map((f) => (
                          <tr key={f.fecha} className="border-t border-border">
                            <td className="px-3 py-1 tabular-nums">{f.fecha}</td>
                            <td className="px-3 py-1 text-right tabular-nums">{f.registros}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="border border-border rounded-md">
                <div className="px-3 py-1.5 text-xs font-medium bg-muted/40 border-b border-border">
                  Días hábiles sin registro en el rango ({stats.diag.fechasFaltantes.length})
                </div>
                {stats.diag.fechasFaltantes.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">Todos los días hábiles tienen asistencia registrada.</p>
                ) : (
                  <div className="max-h-56 overflow-auto p-2 flex flex-wrap gap-1">
                    {stats.diag.fechasFaltantes.map((f) => (
                      <span key={f} className="text-[11px] px-1.5 py-0.5 rounded bg-warning/10 text-warning tabular-nums">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Nota: los días hábiles listados (lunes a viernes) sin registros pueden ser feriados, suspensiones o clases aún no registradas. Registra la asistencia de esas fechas para que el total cuadre.
            </p>
          </Card>


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><CalendarCheck className="w-4 h-4" /> Asistencia</h3>
              <Row label="Inasistencias" value={stats.asistencia.ausentes} />
              <Row label="Atrasos" value={stats.atrasos} />
              <Row label="Retiros" value={stats.retiros} />
              <Row label={`Estudiantes bajo ${umbral}%`} value={stats.asistencia.enRiesgo.length} />
              {stats.asistencia.enRiesgo.length > 0 && (
                <ul className="mt-2 text-xs space-y-1 max-h-32 overflow-auto">
                  {stats.asistencia.enRiesgo.map((r) => (
                    <li key={r.id} className="flex justify-between">
                      <span className="truncate">{alumnoMap[r.id] ?? r.id}</span>
                      <span className="text-warning font-medium">{r.pct.toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Libro de clases</h3>
              <Row label="Clases realizadas" value={stats.libro.clases} />
              <Row label="Con objetivo logrado" value={stats.libro.completados} />
              <Row label="Pendientes" value={stats.libro.pendientes} />
              <Row label="Cumplimiento" value={`${stats.libro.cumplimiento.toFixed(1)}%`} />
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Evaluaciones</h3>
              <Row label="Evaluaciones del mes" value={stats.eval.count} />
              <Row label="Promedio del curso" value={stats.eval.promedio ? stats.eval.promedio.toFixed(2) : "—"} />
              <Row label="Notas insuficientes (<4.0)" value={stats.eval.dist.rojos} />
              <Row label="Notas 4.0 – 5.4" value={stats.eval.dist.amarillos} />
              <Row label="Notas ≥ 5.5" value={stats.eval.dist.verdes} />
              <Row label="Estudiantes con bajo rendimiento" value={stats.eval.bajoRend.length} />
              {stats.eval.bajoRend.length > 0 && (
                <ul className="mt-2 text-xs space-y-1 max-h-32 overflow-auto">
                  {stats.eval.bajoRend.map((r) => (
                    <li key={r.id} className="flex justify-between">
                      <span className="truncate">{alumnoMap[r.id] ?? r.id}</span>
                      <span className="text-warning font-medium">{r.prom.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Convivencia</h3>
              <Row label="Anotaciones positivas" value={stats.conv.pos} />
              <Row label="Anotaciones negativas" value={stats.conv.neg} />
              <Row label="Anotaciones neutras" value={stats.conv.neu} />
              {stats.conv.items.slice(0, 5).length > 0 && (
                <ul className="mt-3 text-xs space-y-2 max-h-32 overflow-auto">
                  {stats.conv.items.slice(0, 5).map((a) => (
                    <li key={a.id} className="border-l-2 pl-2 border-border">
                      <div className="text-muted-foreground">{a.fecha} · {a.tipo}</div>
                      <div className="truncate">{a.descripcion}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Observaciones del docente
            </h3>
            <p className="text-xs text-muted-foreground mb-2">
              Comentarios libres del período (se guardan en tu navegador).
            </p>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={4}
              placeholder="Escribe observaciones del mes…" />
          </Card>
        </>
      )}
      </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub, tone }: {
  icon: LucideIcon; label: string; value: string | number; sub?: string; tone?: "ok" | "warning";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className={`text-2xl font-bold ${tone === "warning" ? "text-warning" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
