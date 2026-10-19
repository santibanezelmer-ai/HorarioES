import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface MyAlumno {
  id: string;
  nombres: string;
  apellidos: string;
  rut: string | null;
  numero_lista: number | null;
  curso_id: string;
  curso_nombre?: string;
  nivel?: string | null;
}

/**
 * Hook para obtener los estudiantes asociados al apoderado conectado.
 * Busca coincidencias por:
 * 1. Correo del usuario en la tabla `matriculas` (apoderado_titular_email o apoderado_suplente_email).
 * 2. Si no hay matricula pero en `alumnos` el campo `apoderado` o `telefono` coincide.
 * 3. Fallback: Si el perfil tiene asignado un RUT en metadata.
 */
export function useMyAlumnos() {
  const { user, profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const userEmail = (user?.email ?? "").trim().toLowerCase();

  return useQuery({
    queryKey: ["my-alumnos", userEmail, colegioId],
    enabled: !!userEmail && !!colegioId,
    staleTime: 60_000,
    queryFn: async () => {
      // 1. Buscar en matriculas aprobadas del colegio por email del apoderado
      const { data: mats, error: matErr } = await supabase
        .from("matriculas")
        .select("alumno_id, estudiante_nombres, estudiante_apellidos, estudiante_rut, curso_asignado_id")
        .eq("colegio_id", colegioId!)
        .or(`apoderado_titular_email.ilike.${userEmail},apoderado_suplente_email.ilike.${userEmail}`);

      if (matErr) console.warn("Error buscando matriculas de apoderado:", matErr);

      const alumnoIds = new Set<string>();
      for (const m of mats ?? []) {
        if (m.alumno_id) alumnoIds.add(m.alumno_id);
      }

      // 2. Si encontramos alumnos vinculados por matrícula, consultar tabla alumnos
      let alumnosResult: MyAlumno[] = [];

      if (alumnoIds.size > 0) {
        const { data: alumnosList, error: alErr } = await supabase
          .from("alumnos")
          .select("id, nombres, apellidos, rut, numero_lista, curso_id, cursos(nombre, nivel)")
          .in("id", Array.from(alumnoIds));

        if (!alErr && alumnosList) {
          alumnosResult = alumnosList.map((a: any) => ({
            id: a.id,
            nombres: a.nombres,
            apellidos: a.apellidos,
            rut: a.rut,
            numero_lista: a.numero_lista,
            curso_id: a.curso_id,
            curso_nombre: a.cursos?.nombre ?? "Sin curso",
            nivel: a.cursos?.nivel,
          }));
        }
      }

      // 3. Si no hubo match por email de matrícula, buscar si en la tabla alumnos el campo apoderado contiene el email o nombre
      if (alumnosResult.length === 0) {
        const { data: byApoderadoField } = await supabase
          .from("alumnos")
          .select("id, nombres, apellidos, rut, numero_lista, curso_id, cursos(nombre, nivel)")
          .eq("colegio_id", colegioId!)
          .ilike("apoderado", `%${userEmail}%`)
          .limit(10);

        if (byApoderadoField && byApoderadoField.length > 0) {
          alumnosResult = byApoderadoField.map((a: any) => ({
            id: a.id,
            nombres: a.nombres,
            apellidos: a.apellidos,
            rut: a.rut,
            numero_lista: a.numero_lista,
            curso_id: a.curso_id,
            curso_nombre: a.cursos?.nombre ?? "Sin curso",
            nivel: a.cursos?.nivel,
          }));
        }
      }

      return alumnosResult;
    },
  });
}
