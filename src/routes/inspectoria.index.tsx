import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Clock, ShieldCheck, AlertTriangle, TrendingDown, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/inspectoria/")({
  head: () => ({ meta: [{ title: "Inspectoría — Panel" }] }),
  component: InspectoriaPanel,
});

function InspectoriaPanel() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const [days, setDays] = useState(30);
  const [minPct, setMinPct] = useState(85);

  const sinceISO = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }, [days]);

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["inspectoria-dashboard", colegioId, sinceISO],
    enabled: !!colegioId,
    queryFn: async () => {
      const [asis, atr, ret, anots, alumnos, cursos] = await Promise.all([
        supabase.from("asistencias").select("alumno_id,curso_id,estado,fecha").eq("colegio_id", colegioId!).gte("fecha", sinceISO),
        supabase.from("atrasos").select("alumno_id,curso_id,fecha,justificado").eq("colegio_id", colegioId!).gte("fecha", sinceISO),
        supabase.from("retiros").select("alumno_id,curso_id,fecha").eq("colegio_id", colegioId!).gte("fecha", sinceISO),
        supabase.from("anotaciones").select("alumno_id,tipo,fecha").eq("colegio_id", colegioId!).gte("fecha", sinceISO),
        supabase.from("alumnos").select("id,nombres,apellidos,curso_id,retirado_en").eq("colegio_id", colegioId!),
        supabase.from("cursos").select("id,nombre,nivel").eq("colegio_id", colegioId!),
      ]);
      return {
        asis: asis.data ?? [], atr: atr.data ?? [], ret: ret.data ?? [],
        anots: anots.data ?? [], alumnos: alumnos.data ?? [], cursos: cursos.data ?? [],
      };
    },
  });

  const m = useMemo(() => {
    if (!data) return null;
    const pres = (rows: typeof data.asis) => {
      const t = rows.length, p = rows.filter((r) => r.estado === "presente").length;
      return t ? Math.round((p / t) * 100) : 0;
    };
    const asisToday = data.asis.filter((a) => a.fecha === today);
    const asisWeek = data.asis.filter((a) => a.fecha >= weekAgo);

    // ranking cursos por asistencia (ascendente: peor primero)
    const byCurso = new Map<string, { t: number; p: number }>();
    for (const r of data.asis) {
      const cur = byCurso.get(r.curso_id) ?? { t: 0, p: 0 };
      cur.t++; if (r.estado === "presente") cur.p++;
      byCurso.set(r.curso_id, cur);
    }
    const rankCursos = Array.from(byCurso.entries())
      .map(([cid, v]) => ({ cid, pct: Math.round((v.p / v.t) * 100), t: v.t }))
      .sort((a, b) => a.pct - b.pct);

    // estudiantes con menor asistencia + riesgo
    const byAlum = new Map<string, { t: number; p: number }>();
    for (const r of data.asis) {
      const cur = byAlum.get(r.alumno_id) ?? { t: 0, p: 0 };
      cur.t++; if (r.estado === "presente") cur.p++;
      byAlum.set(r.alumno_id, cur);
    }
    const rankAlum = Array.from(byAlum.entries())
      .map(([aid, v]) => ({ aid, pct: Math.round((v.p / v.t) * 100), t: v.t }))
      .filter((x) => x.t >= 5)
      .sort((a, b) => a.pct - b.pct);
    const enRiesgo = rankAlum.filter((x) => x.pct < minPct);

    // atrasos reiterados (>=3)
    const byAtrAlum = new Map<string, number>();
    for (const r of data.atr) byAtrAlum.set(r.alumno_id, (byAtrAlum.get(r.alumno_id) ?? 0) + 1);
    const atrasosReit = Array.from(byAtrAlum.entries()).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);

    // retiros frecuentes (>=2)
    const byRetAlum = new Map<string, number>();
    for (const r of data.ret) byRetAlum.set(r.alumno_id, (byRetAlum.get(r.alumno_id) ?? 0) + 1);
    const retirosFreq = Array.from(byRetAlum.entries()).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);

    return {
      pctToday: pres(asisToday), pctWeek: pres(asisWeek), pctMonth: pres(data.asis),
      totalAtrasos: data.atr.length, totalRetiros: data.ret.length,
      anotsNeg: data.anots.filter((x) => x.tipo === "negativa").length,
      rankCursos: rankCursos.slice(0, 6),
      rankAlum: rankAlum.slice(0, 8), enRiesgo,
      atrasosReit: atrasosReit.slice(0, 8), retirosFreq: retirosFreq.slice(0, 8),
    };
  }, [data, today, weekAgo, minPct]);

  const alumnoMap = useMemo(() => Object.fromEntries((data?.alumnos ?? []).map((a) => [a.id, a])), [data]);
  const cursoMap = useMemo(() => Object.fromEntries((data?.cursos ?? []).map((c) => [c.id, c])), [data]);

  return (
    <div>
      <PageHeader
        title="Inspectoría — Panel general"
        subtitle="Asistencia, atrasos, retiros y convivencia consolidados"
        actions={
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">% mínimo</label>
            <input type="number" min={50} max={100} value={minPct} onChange={(e) => setMinPct(Number(e.target.value))}
              className="w-16 bg-surface border border-border rounded-md px-2 py-1 text-sm" />
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm">
              <option value={7}>7 días</option><option value={30}>30 días</option>
              <option value={90}>90 días</option><option value={180}>6 meses</option>
            </select>
          </div>
        }
      />

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <QuickLink to="/asistencia" icon={ClipboardList} label="Asistencia diaria" color="#10b981" />
        <QuickLink to="/inspectoria/atrasos" icon={Clock} label="Atrasos y retiros" color="#f59e0b" />
        <QuickLink to="/inspectoria/convivencia" icon={ShieldCheck} label="Convivencia" color="#ef4444" />
        <QuickLink to="/estadisticas" icon={TrendingDown} label="Reportes" color="#4f8ef7" />
      </div>

      {isLoading || !m ? (
        <div className="text-sm text-muted-foreground">Cargando indicadores…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <Kpi label="Asistencia hoy" value={`${m.pctToday}%`} color="#10b981" />
            <Kpi label="Asistencia 7d" value={`${m.pctWeek}%`} color="#10b981" />
            <Kpi label={`Asistencia ${days}d`} value={`${m.pctMonth}%`} color="#10b981" />
            <Kpi label="Atrasos" value={m.totalAtrasos} color="#f59e0b" />
            <Kpi label="Retiros" value={m.totalRetiros} color="#8b5cf6" />
            <Kpi label="Anotaciones −" value={m.anotsNeg} color="#ef4444" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Ranking de cursos (asistencia más baja)">
              {m.rankCursos.length === 0 ? <Empty /> : m.rankCursos.map((r) => (
                <Row key={r.cid} left={cursoMap[r.cid]?.nombre ?? "—"} right={`${r.pct}%`} bad={r.pct < minPct} />
              ))}
            </Card>

            <Card title={`Estudiantes en riesgo (< ${minPct}% asistencia)`} icon={AlertTriangle}>
              {m.enRiesgo.length === 0 ? <Empty /> : m.enRiesgo.slice(0, 10).map((r) => {
                const al = alumnoMap[r.aid];
                return (
                  <RowLink key={r.aid} to={`/estudiantes/${r.aid}`} left={al ? `${al.apellidos}, ${al.nombres}` : "—"} right={`${r.pct}%`} bad />
                );
              })}
            </Card>

            <Card title="Atrasos reiterados (≥ 3)" icon={Clock}>
              {m.atrasosReit.length === 0 ? <Empty /> : m.atrasosReit.map(([aid, n]) => {
                const al = alumnoMap[aid];
                return <RowLink key={aid} to={`/estudiantes/${aid}`} left={al ? `${al.apellidos}, ${al.nombres}` : "—"} right={`${n} atrasos`} />;
              })}
            </Card>

            <Card title="Retiros frecuentes (≥ 2)" icon={LogOut}>
              {m.retirosFreq.length === 0 ? <Empty /> : m.retirosFreq.map(([aid, n]) => {
                const al = alumnoMap[aid];
                return <RowLink key={aid} to={`/estudiantes/${aid}`} left={al ? `${al.apellidos}, ${al.nombres}` : "—"} right={`${n} retiros`} />;
              })}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, color }: { to: string; icon: typeof Clock; label: string; color: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface hover:border-primary/50 transition-colors">
      <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: `${color}20`, color }}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function Kpi({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon?: typeof Clock; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-4 h-4 text-primary" />}
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ left, right, bad }: { left: string; right: string; bad?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
      <span className="truncate">{left}</span>
      <span className={`font-mono text-xs ${bad ? "text-rose-500 font-semibold" : ""}`}>{right}</span>
    </div>
  );
}
function RowLink({ to, left, right, bad }: { to: string; left: string; right: string; bad?: boolean }) {
  return (
    <Link to={to} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0 hover:bg-surface-2 -mx-2 px-2 rounded">
      <span className="truncate">{left}</span>
      <span className={`font-mono text-xs ${bad ? "text-rose-500 font-semibold" : ""}`}>{right}</span>
    </Link>
  );
}
function Empty() { return <div className="text-xs text-muted-foreground">Sin datos en el rango.</div>; }
