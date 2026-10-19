import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface SecurePupil {
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
 * Verifica y obtiene el correo electrónico autenticado directamente del servicio Auth Admin de Supabase.
 * Esto garantiza que el correo proviene de una sesión criptográficamente válida y no de datos manipulables por el cliente.
 */
export async function getVerifiedUserEmail(uid: string): Promise<string> {
  const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(uid);
  if (userErr || !userData?.user?.email) {
    throw new Error("No fue posible validar la identidad del usuario.");
  }
  return userData.user.email.toLowerCase().trim();
}

/**
 * Consulta de forma segura y aislada en el servidor los alumnos vinculados al apoderado autenticado.
 */
export async function getApoderadoAlumnosImpl(
  uid: string,
  colegioId: string
): Promise<SecurePupil[]> {
  const userEmail = await getVerifiedUserEmail(uid);

  // 1. Buscar en matriculas aprobadas/registradas por correo del apoderado
  const { data: mats, error: matErr } = await supabaseAdmin
    .from("matriculas")
    .select("alumno_id, estudiante_nombres, estudiante_apellidos, estudiante_rut, curso_asignado_id")
    .eq("colegio_id", colegioId)
    .or(`apoderado_titular_email.ilike.${userEmail},apoderado_suplente_email.ilike.${userEmail}`);

  if (matErr) {
    console.error("[apoderados.server] Error consultando matriculas:", matErr);
  }

  const alumnoIds = new Set<string>();
  for (const m of mats ?? []) {
    if (m.alumno_id) alumnoIds.add(m.alumno_id);
  }

  let pupils: SecurePupil[] = [];

  // 2. Si encontramos alumnos vinculados por matrícula, consultar tabla alumnos
  if (alumnoIds.size > 0) {
    const { data: alumnosList, error: alErr } = await supabaseAdmin
      .from("alumnos")
      .select("id, nombres, apellidos, rut, numero_lista, curso_id, cursos(nombre, nivel)")
      .in("id", Array.from(alumnoIds));

    if (!alErr && alumnosList) {
      pupils = alumnosList.map((a: any) => ({
        id: a.id,
        nombres: a.nombres,
        apellidos: a.apellidos,
        rut: a.rut,
        numero_lista: a.numero_lista,
        curso_id: a.curso_id,
        curso_nombre: a.cursos?.nombre ?? "Sin curso",
        nivel: a.cursos?.nivel ?? null,
      }));
    }
  }

  // 3. Fallback: Buscar en la tabla alumnos si el campo apoderado contiene el correo
  if (pupils.length === 0) {
    const { data: byApoderadoField } = await supabaseAdmin
      .from("alumnos")
      .select("id, nombres, apellidos, rut, numero_lista, curso_id, cursos(nombre, nivel)")
      .eq("colegio_id", colegioId)
      .ilike("apoderado", `%${userEmail}%`)
      .limit(10);

    if (byApoderadoField && byApoderadoField.length > 0) {
      pupils = byApoderadoField.map((a: any) => ({
        id: a.id,
        nombres: a.nombres,
        apellidos: a.apellidos,
        rut: a.rut,
        numero_lista: a.numero_lista,
        curso_id: a.curso_id,
        curso_nombre: a.cursos?.nombre ?? "Sin curso",
        nivel: a.cursos?.nivel ?? null,
      }));
    }
  }

  return pupils;
}

/**
 * Valida de forma estricta que un estudiante pertenezca al apoderado autenticado
 * antes de entregar información confidencial de notas, asistencia u hoja de vida.
 */
export async function assertApoderadoOwnsAlumno(
  uid: string,
  alumnoId: string,
  colegioId: string
): Promise<void> {
  const authorizedPupils = await getApoderadoAlumnosImpl(uid, colegioId);
  const isAuthorized = authorizedPupils.some((p) => p.id === alumnoId);

  if (!isAuthorized) {
    // También verificar si el usuario tiene rol de personal (docente, utp, director, admin)
    const { data: staffRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("colegio_id", colegioId)
      .in("role", ["admin", "utp", "direccion", "inspectoria", "docente"])
      .maybeSingle();

    if (!staffRole) {
      throw new Error("No tienes autorización para acceder a los datos de este estudiante.");
    }
  }
}

/**
 * Obtiene los registros académicos de un estudiante asegurando validación Zero-Trust.
 */
export async function getFichaAlumnoApoderadoImpl(
  uid: string,
  alumnoId: string,
  colegioId: string
) {
  // Verificación estricta de autorización
  await assertApoderadoOwnsAlumno(uid, alumnoId, colegioId);

  const [asis, califs, asigs, atrasos, anots] = await Promise.all([
    supabaseAdmin
      .from("asistencias")
      .select("fecha, estado")
      .eq("alumno_id", alumnoId)
      .order("fecha", { ascending: false })
      .limit(300),
    supabaseAdmin
      .from("calificaciones")
      .select("asignatura_id, nota, descripcion, fecha, ponderacion")
      .eq("alumno_id", alumnoId)
      .order("fecha", { ascending: false }),
    supabaseAdmin
      .from("asignaturas")
      .select("id, nombre, color")
      .eq("colegio_id", colegioId),
    supabaseAdmin
      .from("atrasos")
      .select("fecha, hora, motivo, justificado")
      .eq("alumno_id", alumnoId)
      .order("fecha", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("anotaciones")
      .select("fecha, tipo, categoria, descripcion")
      .eq("alumno_id", alumnoId)
      .order("fecha", { ascending: false })
      .limit(50),
  ]);

  return {
    asis: asis.data ?? [],
    califs: califs.data ?? [],
    asigs: asigs.data ?? [],
    atrasos: atrasos.data ?? [],
    anots: anots.data ?? [],
  };
}
