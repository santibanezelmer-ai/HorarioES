import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useMyDocente } from "@/lib/use-my-docente";
import { EmptyState } from "@/components/EmptyState";
import { CalendarRange } from "lucide-react";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

interface Bloque { id: string; nombre: string; hora: string; orden: number; tipo: string }
interface Slot {
  id: string; dia: number; slot: number; curso_id: string;
  asignatura_id: string | null; espacio_id: string | null;
}

export function MiHorarioSemana() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const { data: docente, isLoading } = useMyDocente();

  const { data: bloques = [] } = useQuery({
    queryKey: ["bloques", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase.from("bloques")
        .select("id, nombre, hora, orden, tipo").eq("colegio_id", colegioId!).order("orden");
      if (error) throw error;
      return data as Bloque[];
    },
  });

  const { data: slots = [] } = useQuery({
    queryKey: ["mi-horario", docente?.id], enabled: !!docente?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("schedule_slots")
        .select("id, dia, slot, curso_id, asignatura_id, espacio_id")
        .eq("docente_id", docente!.id);
      if (error) throw error;
      return data as Slot[];
    },
  });

  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-min", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase.from("cursos")
        .select("id, nombre").eq("colegio_id", colegioId!);
      if (error) throw error;
      return data as { id: string; nombre: string }[];
    },
  });

  const { data: asignaturas = [] } = useQuery({
    queryKey: ["asignaturas-min", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase.from("asignaturas")
        .select("id, nombre, color").eq("colegio_id", colegioId!);
      if (error) throw error;
      return data as { id: string; nombre: string; color: string }[];
    },
  });

  const cursoMap = Object.fromEntries(cursos.map((c) => [c.id, c]));
  const asigMap = Object.fromEntries(asignaturas.map((a) => [a.id, a]));
  const slotByKey = Object.fromEntries(slots.map((s) => [`${s.dia}-${s.slot}`, s]));
  const bloquesClase = bloques.filter((b) => b.tipo === "clase");

  return (
    <div>
      {!isLoading && !docente && (
        <EmptyState icon={CalendarRange} title="Cuenta no vinculada" description="Pide al administrador que vincule tu cuenta a tu ficha de docente." />
      )}

      {docente && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground w-32">Bloque</th>
                  {DIAS.map((d) => (
                    <th key={d} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bloquesClase.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-3 py-2 align-top">
                      <div className="text-xs font-semibold">{b.nombre}</div>
                      <div className="text-[10px] text-muted-foreground">{b.hora}</div>
                    </td>
                    {DIAS.map((_, dia) => {
                      const s = slotByKey[`${dia}-${b.orden}`];
                      if (!s) return <td key={dia} className="px-2 py-2 align-top text-xs text-muted-foreground/60">—</td>;
                      const curso = cursoMap[s.curso_id];
                      const asig = s.asignatura_id ? asigMap[s.asignatura_id] : null;
                      return (
                        <td key={dia} className="px-2 py-2 align-top">
                          <div
                            className="rounded-md p-2 border-l-2"
                            style={{
                              borderColor: asig?.color ?? docente.color,
                              background: `${asig?.color ?? docente.color}14`,
                            }}
                          >
                            <div className="text-[11px] font-semibold truncate">{curso?.nombre ?? "—"}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{asig?.nombre ?? ""}</div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
