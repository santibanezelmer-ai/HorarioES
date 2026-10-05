import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MiHorarioSemana } from "@/components/MiHorarioSemana";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useMyDocente } from "@/lib/use-my-docente";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { CalendarCheck, ClipboardList, NotebookPen, BookOpen } from "lucide-react";

export const Route = createFileRoute("/mis-clases")({
  head: () => ({ meta: [{ title: "Mi horario — HorarioES" }] }),
  component: MisClasesPage,
});

interface Bloque { id: string; nombre: string; hora: string; orden: number; tipo: string }
interface Slot {
  id: string; dia: number; slot: number;
  curso_id: string; asignatura_id: string | null; espacio_id: string | null;
}

function MisClasesPage() {
  const [tab, setTab] = useState<"hoy" | "semana">(
    typeof window !== "undefined" && window.location.search.includes("tab=semana") ? "semana" : "hoy",
  );
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const { data: docente, isLoading: loadingDoc } = useMyDocente();
  const docenteId = docente?.id;
  // 0 = Lunes en este sistema; getDay(): 0=Dom, 1=Lun ...
  const jsDay = new Date().getDay();
  const dia = jsDay === 0 ? 0 : jsDay - 1; // Domingo cae en lunes vista

  const { data: bloques = [] } = useQuery({
    queryKey: ["bloques", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bloques").select("id, nombre, hora, orden, tipo")
        .eq("colegio_id", colegioId!).order("orden");
      if (error) throw error;
      return data as Bloque[];
    },
  });

  const { data: slots = [] } = useQuery({
    queryKey: ["mis-slots-hoy", docenteId, dia],
    enabled: !!docenteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_slots")
        .select("id, dia, slot, curso_id, asignatura_id, espacio_id")
        .eq("docente_id", docenteId!)
        .eq("dia", dia);
      if (error) throw error;
      return data as Slot[];
    },
  });

  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-min", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase.from("cursos")
        .select("id, nombre").eq("colegio_id", colegioId!);
      if (error) throw error;
      return data as { id: string; nombre: string }[];
    },
  });

  const { data: asignaturas = [] } = useQuery({
    queryKey: ["asignaturas-min", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase.from("asignaturas")
        .select("id, nombre, color").eq("colegio_id", colegioId!);
      if (error) throw error;
      return data as { id: string; nombre: string; color: string }[];
    },
  });

  const cursoMap = Object.fromEntries(cursos.map((c) => [c.id, c]));
  const asigMap = Object.fromEntries(asignaturas.map((a) => [a.id, a]));
  const bloqueMap = Object.fromEntries(bloques.map((b) => [b.orden, b]));

  const ordered = [...slots].sort((a, b) => a.slot - b.slot);
  const today = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <PageHeader
        title="Mi horario"
        subtitle={`${docente?.nombre ?? "Docente"} · ${today}`}
      />

      <div className="inline-flex rounded-md border border-border overflow-hidden mb-4 no-print">
        {(["hoy", "semana"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-surface hover:bg-surface-2 text-muted-foreground"
            }`}
          >
            {t === "hoy" ? "Hoy" : "Semana"}
          </button>
        ))}
      </div>

      {tab === "semana" && <MiHorarioSemana />}

      {tab === "hoy" && !loadingDoc && !docente && (
        <EmptyState
          icon={CalendarCheck}
          title="Tu cuenta aún no está vinculada a un docente"
          description="Pide a un administrador del colegio que vincule tu correo con tu ficha en la sección Docentes."
        />
      )}

      {tab === "hoy" && docente && ordered.length === 0 && (
        <EmptyState
          icon={CalendarCheck}
          title="Sin clases programadas para hoy"
          description="Disfruta el día. Puedes revisar tu horario completo desde el menú lateral."
        />
      )}

      <div className="space-y-3">
        {(tab === "hoy" ? ordered : []).map((s) => {
          const bloque = bloqueMap[s.slot];
          const curso = cursoMap[s.curso_id];
          const asig = s.asignatura_id ? asigMap[s.asignatura_id] : null;
          return (
            <div key={s.id} className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-1.5 h-12 rounded-full shrink-0"
                    style={{ background: asig?.color ?? docente?.color ?? "#4f8ef7" }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{bloque?.hora ?? `Bloque ${s.slot + 1}`}</div>
                    <div className="text-base font-semibold truncate">{curso?.nombre ?? "Curso"}</div>
                    <div className="text-sm text-muted-foreground truncate">{asig?.nombre ?? "Sin asignatura"}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <Link to="/asistencia" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-surface-2 hover:bg-sidebar-accent transition-colors">
                    <ClipboardList className="w-3.5 h-3.5" /> Asistencia
                  </Link>
                  <Link to="/calificaciones" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-surface-2 hover:bg-sidebar-accent transition-colors">
                    <NotebookPen className="w-3.5 h-3.5" /> Notas
                  </Link>
                  <Link to="/libro-clases" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-surface-2 hover:bg-sidebar-accent transition-colors">
                    <BookOpen className="w-3.5 h-3.5" /> Libro
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
