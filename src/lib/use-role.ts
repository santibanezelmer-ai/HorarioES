import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type AppRole =
  | "admin"
  | "utp"
  | "editor"
  | "viewer"
  | "docente"
  | "superadmin"
  | "direccion"
  | "inspectoria";

const PRIVILEGED: AppRole[] = ["admin", "utp", "editor", "viewer", "direccion", "inspectoria", "superadmin"];

export function useUserRoles() {
  const { user, profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const userId = user?.id;

  return useQuery({
    queryKey: ["user-roles", userId, colegioId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, colegio_id")
        .eq("user_id", userId!);
      if (error) throw error;
      const rows = data ?? [];
      return rows.map((r) => r.role as AppRole);
    },
  });
}

export function useIsDocenteOnly() {
  const { data: roles = [], isLoading } = useUserRoles();
  const privileged = roles.some((r) => PRIVILEGED.includes(r));
  const isDocente = roles.includes("docente");
  return { isDocenteOnly: isDocente && !privileged, isLoading, roles };
}
