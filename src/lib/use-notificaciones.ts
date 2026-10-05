// Calcula notificaciones automáticas a partir de los datos existentes.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useColegioConfig } from "@/lib/use-colegio-config";

export type NotifSeverity = "info" | "warning" | "critical";
export interface Notif {
  id: string;
  title: string;
  detail?: string;
  severity: NotifSeverity;
  to?: string;
  count?: number;
}

export function useNotificaciones() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const { data: cfg } = useColegioConfig();

  return useQuery({
    queryKey: ["notificaciones", colegioId, cfg],
    enabled: !!colegioId && !!cfg,
    staleTime: 60_000,
    queryFn: async (): Promise<Notif[]> => {
      const sinceLibro = new Date(); sinceLibro.setDate(sinceLibro.getDate() - (cfg!.alerta_libro_dias));
      const since30 = new Date(); since30.setDate(since30.getDate() - 30);
      const sinceISO = since30.toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);

      const [docentes, libro, asisToday, asisAll, atr, ret] = await Promise.all([
        supabase.from("docentes").select("id,nombre").eq("colegio_id", colegioId!),
        supabase.from("libro_clases").select("docente_id,fecha").eq("colegio_id", colegioId!)
          .gte("fecha", sinceLibro.toISOString().slice(0, 10)),
        supabase.from("asistencias").select("curso_id").eq("colegio_id", colegioId!).eq("fecha", today),
        supabase.from("asistencias").select("alumno_id,estado").eq("colegio_id", colegioId!).gte("fecha", sinceISO),
        supabase.from("atrasos").select("alumno_id").eq("colegio_id", colegioId!).gte("fecha", sinceISO),
        supabase.from("retiros").select("alumno_id").eq("colegio_id", colegioId!).gte("fecha", sinceISO),
      ]);

      const out: Notif[] = [];
      const recentDoc = new Set((libro.data ?? []).map((l) => l.docente_id).filter(Boolean));
      const sinRegistro = (docentes.data ?? []).filter((d) => !recentDoc.has(d.id));
      if (sinRegistro.length > 0) {
        out.push({
          id: "libro-pendiente",
          title: `${sinRegistro.length} docente(s) sin registros recientes`,
          detail: `Sin libro de clases en los últimos ${cfg!.alerta_libro_dias} días`,
          severity: "warning", to: "/planificaciones", count: sinRegistro.length,
        });
      }

      if ((asisToday.data ?? []).length === 0) {
        out.push({
          id: "asis-hoy",
          title: "Sin asistencia registrada hoy",
          detail: "Ningún curso ha pasado lista hoy",
          severity: "warning", to: "/asistencia",
        });
      }

      // riesgo de inasistencia
      const byAlum = new Map<string, { t: number; p: number }>();
      for (const r of asisAll.data ?? []) {
        const cur = byAlum.get(r.alumno_id) ?? { t: 0, p: 0 };
        cur.t++; if (r.estado === "presente") cur.p++;
        byAlum.set(r.alumno_id, cur);
      }
      const riesgo = Array.from(byAlum.values()).filter((v) => v.t >= 5 && (v.p / v.t) * 100 < cfg!.asistencia_min_pct).length;
      const critico = Array.from(byAlum.values()).filter((v) => v.t >= 5 && (v.p / v.t) * 100 < cfg!.riesgo_critico_pct).length;
      if (critico > 0) {
        out.push({ id: "riesgo-critico", title: `${critico} estudiante(s) en riesgo crítico`, detail: `Asistencia < ${cfg!.riesgo_critico_pct}%`, severity: "critical", to: "/inspectoria", count: critico });
      } else if (riesgo > 0) {
        out.push({ id: "riesgo", title: `${riesgo} estudiante(s) con riesgo de inasistencia`, detail: `Asistencia < ${cfg!.asistencia_min_pct}%`, severity: "warning", to: "/inspectoria", count: riesgo });
      }

      const byAtr = new Map<string, number>();
      for (const r of atr.data ?? []) byAtr.set(r.alumno_id, (byAtr.get(r.alumno_id) ?? 0) + 1);
      const atrReit = Array.from(byAtr.values()).filter((n) => n >= cfg!.atrasos_alerta).length;
      if (atrReit > 0) out.push({ id: "atrasos", title: `${atrReit} estudiante(s) con atrasos reiterados`, severity: "info", to: "/inspectoria/atrasos", count: atrReit });

      const byRet = new Map<string, number>();
      for (const r of ret.data ?? []) byRet.set(r.alumno_id, (byRet.get(r.alumno_id) ?? 0) + 1);
      const retFreq = Array.from(byRet.values()).filter((n) => n >= cfg!.retiros_alerta).length;
      if (retFreq > 0) out.push({ id: "retiros", title: `${retFreq} estudiante(s) con retiros frecuentes`, severity: "info", to: "/inspectoria/atrasos", count: retFreq });

      return out;
    },
  });
}
