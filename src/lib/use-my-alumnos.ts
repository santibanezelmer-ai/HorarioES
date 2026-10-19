import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { getMyAlumnosSecure } from "@/lib/apoderados.functions";

export interface MyAlumno {
  id: string;
  nombres: string;
  apellidos: string;
  rut: string | null;
  numero_lista: number | null;
  curso_id: string;
  curso_nombre?: string;
  nivel?: string | null;
  colegio_id?: string;
}

/**
 * Hook seguro para obtener los estudiantes asociados al apoderado conectado.
 * Utiliza una Server Function (BFF) con validación criptográfica de sesión y
 * resolución del correo autenticado directamente desde Supabase Auth Admin.
 * Previene el acceso a estudiantes de otros apoderados y asegura Zero-Trust.
 */
export function useMyAlumnos() {
  const { session, profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const accessToken = session?.access_token;

  return useQuery({
    queryKey: ["my-alumnos-secure", colegioId, session?.user?.id],
    enabled: !!accessToken,
    staleTime: 60_000,
    queryFn: async () => {
      const pupils = await getMyAlumnosSecure({
        data: { accessToken: accessToken!, colegioId: colegioId ?? undefined },
      });
      return pupils as MyAlumno[];
    },
  });
}
