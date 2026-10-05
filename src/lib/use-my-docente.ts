import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface MyDocente {
  id: string;
  nombre: string;
  color: string;
}

export function useMyDocente() {
  const { user, profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const userId = user?.id;

  return useQuery({
    queryKey: ["my-docente", userId, colegioId],
    enabled: !!userId && !!colegioId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("docentes")
        .select("id, nombre, color")
        .eq("colegio_id", colegioId!)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as MyDocente | null;
    },
  });
}
