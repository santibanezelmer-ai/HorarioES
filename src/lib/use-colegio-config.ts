import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface ColegioConfig {
  asistencia_min_pct: number;
  riesgo_critico_pct: number;
  alerta_libro_dias: number;
  atrasos_alerta: number;
  retiros_alerta: number;
  categorias_convivencia: string[];
  tipos_anotacion: string[];
  periodos: { nombre: string; inicio: string; fin: string }[];
}

export const DEFAULT_CONFIG: ColegioConfig = {
  asistencia_min_pct: 85,
  riesgo_critico_pct: 75,
  alerta_libro_dias: 3,
  atrasos_alerta: 3,
  retiros_alerta: 2,
  categorias_convivencia: ["Respeto", "Responsabilidad", "Puntualidad", "Colaboración"],
  tipos_anotacion: ["positiva", "neutra", "negativa"],
  periodos: [],
};

export function useColegioConfig() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  return useQuery({
    queryKey: ["colegio-config", colegioId],
    enabled: !!colegioId,
    staleTime: 60_000,
    queryFn: async (): Promise<ColegioConfig> => {
      const { data, error } = await supabase
        .from("colegios").select("config").eq("id", colegioId!).maybeSingle();
      if (error) throw error;
      const cfg = (data?.config ?? {}) as Partial<ColegioConfig>;
      return { ...DEFAULT_CONFIG, ...cfg };
    },
  });
}
