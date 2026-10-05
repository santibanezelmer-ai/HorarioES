import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface CursoMin { id: string; nombre: string; nivel: string }

/** Cursos visibles para el usuario actual (RLS los filtra). */
export function useCursosVisibles() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  return useQuery({
    queryKey: ["cursos-visibles", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select("id, nombre, nivel")
        .eq("colegio_id", colegioId!)
        .order("nombre");
      if (error) throw error;
      return (data ?? []) as CursoMin[];
    },
  });
}
