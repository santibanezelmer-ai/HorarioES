import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/db-retry";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/conflictos")({
  head: () => ({ meta: [{ title: "Conflictos — HorarioES" }] }),
  component: ConflictosPage,
});

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

interface Slot {
  id: string; curso_id: string; dia: number; slot: number;
  docente_id: string | null; asignatura_id: string | null; espacio_id: string | null;
}
interface Named { id: string; nombre: string; color?: string }
interface Bloque { id: string; nombre: string; orden: number; }

interface Conflict {
  key: string;
  tipo: "docente" | "espacio";
  recurso: string;
  dia: number;
  slot: number;
  bloqueNombre: string;
  cursos: string[];
}

function ConflictosPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;

  const { data: slots = [] } = useQuery({
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
  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-min", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase.from("cursos").select("id, nombre").eq("colegio_id", colegioId!)
      );
      if (error) throw error; return data as Named[];
    },
  });
  const { data: docentes = [] } = useQuery({
    queryKey: ["docentes-min", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase.from("docentes").select("id, nombre, color").eq("colegio_id", colegioId!)
      );
      if (error) throw error; return data as Named[];
    },
  });
  const { data: espacios = [] } = useQuery({
    queryKey: ["espacios-min", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase.from("espacios").select("id, nombre, color").eq("colegio_id", colegioId!)
      );
      if (error) throw error; return data as Named[];
    },
  });
  const { data: bloques = [] } = useQuery({
    queryKey: ["bloques", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase.from("bloques").select("id, nombre, orden").eq("colegio_id", colegioId!).order("orden")
      );
      if (error) throw error; return data as Bloque[];
    },
  });

  const conflicts = useMemo<Conflict[]>(() => {
    const cursosMap = Object.fromEntries(cursos.map((c) => [c.id, c.nombre]));
    const docMap = Object.fromEntries(docentes.map((d) => [d.id, d.nombre]));
    const espMap = Object.fromEntries(espacios.map((e) => [e.id, e.nombre]));
    const buckets = new Map<string, { tipo: "docente" | "espacio"; recursoId: string; dia: number; slot: number; cursoIds: Set<string> }>();
    for (const s of slots) {
      if (s.docente_id) {
        const k = `D-${s.dia}-${s.slot}-${s.docente_id}`;
        let b = buckets.get(k);
        if (!b) { b = { tipo: "docente", recursoId: s.docente_id, dia: s.dia, slot: s.slot, cursoIds: new Set() }; buckets.set(k, b); }
        b.cursoIds.add(s.curso_id);
      }
      if (s.espacio_id) {
        const k = `E-${s.dia}-${s.slot}-${s.espacio_id}`;
        let b = buckets.get(k);
        if (!b) { b = { tipo: "espacio", recursoId: s.espacio_id, dia: s.dia, slot: s.slot, cursoIds: new Set() }; buckets.set(k, b); }
        b.cursoIds.add(s.curso_id);
      }
    }
    const out: Conflict[] = [];
    for (const [key, b] of buckets.entries()) {
      if (b.cursoIds.size < 2) continue;
      out.push({
        key,
        tipo: b.tipo,
        recurso: b.tipo === "docente" ? (docMap[b.recursoId] ?? "?") : (espMap[b.recursoId] ?? "?"),
        dia: b.dia,
        slot: b.slot,
        bloqueNombre: bloques[b.slot]?.nombre ?? `Bloque ${b.slot + 1}`,
        cursos: [...b.cursoIds].map((id) => cursosMap[id] ?? "?"),
      });
    }
    return out.sort((a, b) => a.dia - b.dia || a.slot - b.slot);
  }, [slots, cursos, docentes, espacios, bloques]);

  return (
    <div>
      <PageHeader
        title="Conflictos"
        subtitle="Choques de docentes o espacios asignados a la vez en distintos cursos"
        actions={
          <Link to="/horarios" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            Ir a horarios <ArrowRight className="w-3 h-3" />
          </Link>
        }
      />

      {conflicts.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Sin conflictos"
          description="Todos los docentes y espacios están asignados sin solapamientos."
        />
      ) : (
        <div className="space-y-2">
          {conflicts.map((c) => (
            <div key={c.key} className="bg-surface border border-amber-500/40 rounded-xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {c.tipo === "docente" ? "Docente" : "Espacio"}: <span className="text-amber-400">{c.recurso}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {DIAS[c.dia]} · {c.bloqueNombre} · asignado en {c.cursos.length} cursos
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {c.cursos.map((nombre) => (
                    <span key={nombre} className="text-[11px] px-2 py-0.5 rounded bg-background border border-border">
                      {nombre}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
