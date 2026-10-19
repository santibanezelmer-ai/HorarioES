import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { cleanRut } from "@/lib/rut";
import { findUserByEmail } from "@/lib/docentes.server";

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

/**
 * Autentica o activa la cuenta de un apoderado en su primer ingreso mediante la clave genérica
 * ('A' + RUN del estudiante, ej: A12345678K), solicitando validación de email para la activación.
 */
export async function loginOrActivateApoderadoImpl(emailInput: string, passwordInput: string) {
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();

  // 1. Buscar si el usuario ya existe en Supabase Auth
  const existingUserId = await findUserByEmail(email);
  if (existingUserId) {
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(existingUserId);
    const u = userRes?.user;
    if (!u) {
      throw new Error("No se pudo obtener información del usuario");
    }
    // Si la cuenta aún no está confirmada por email:
    if (!u.email_confirmed_at && !u.confirmed_at) {
      return {
        status: "activation_required" as const,
        email,
        message: "Tu cuenta de apoderado está registrada pero pendiente de activación. Revisa tu correo o solicita reenviar el enlace de activación.",
      };
    }
    // Usuario ya existe y está activo: proceder a login regular con contraseña
    return {
      status: "ready_to_signin" as const,
      email,
    };
  }

  // 2. Si el usuario NO existe en Auth: verificar si es un apoderado en matriculas o alumnos
  const { data: mats, error: matErr } = await supabaseAdmin
    .from("matriculas")
    .select("id, colegio_id, estudiante_rut, apoderado_titular_nombres, apoderado_titular_apellidos, apoderado_titular_email, apoderado_suplente_email")
    .or(`apoderado_titular_email.ilike.${email},apoderado_suplente_email.ilike.${email}`);

  if (matErr) {
    console.error("Error buscando matriculas:", matErr);
  }

  const { data: alumnosByField } = await supabaseAdmin
    .from("alumnos")
    .select("id, colegio_id, rut, apoderado")
    .ilike("apoderado", `%${email}%`);

  const studentRuts = new Set<string>();
  let primaryColegioId: string | null = null;
  let apoderadoNombre: string | null = null;

  for (const m of mats ?? []) {
    if (m.estudiante_rut) studentRuts.add(cleanRut(m.estudiante_rut));
    if (!primaryColegioId && m.colegio_id) primaryColegioId = m.colegio_id;
    if (!apoderadoNombre && m.apoderado_titular_nombres) {
      apoderadoNombre = `${m.apoderado_titular_nombres} ${m.apoderado_titular_apellidos ?? ""}`.trim();
    }
  }

  for (const a of alumnosByField ?? []) {
    if (a.rut) studentRuts.add(cleanRut(a.rut));
    if (!primaryColegioId && a.colegio_id) primaryColegioId = a.colegio_id;
  }

  if (studentRuts.size === 0 || !primaryColegioId) {
    return {
      status: "unregistered_email" as const,
      message: "Este correo no figura registrado como apoderado en ningún establecimiento del sistema. Verifica que sea el mismo correo que informaste en la ficha de matrícula.",
    };
  }

  // 3. Validar si la contraseña enviada coincide con el formato genérico de primer ingreso:
  // "A" + [RUT sin puntos ni guión]
  const normalizedInputPassword = password.toUpperCase().replace(/[\.\-\s]/g, "");
  const validInitialPasswords = Array.from(studentRuts).map((r) => `A${r.toUpperCase()}`);

  const isPasswordMatch = validInitialPasswords.includes(normalizedInputPassword);

  if (!isPasswordMatch) {
    return {
      status: "invalid_initial_password" as const,
      message: "La clave inicial no coincide con el RUN de tu estudiante. Recuerda que para el primer ingreso tu clave es la letra 'A' mayúscula seguida del RUT de tu pupilo (ejemplo: A12345678K).",
    };
  }

  // 4. Clave genérica válida! Crear la cuenta en Supabase Auth y solicitar confirmación de correo
  const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // Requiere validación de correo para activarse
    user_metadata: {
      nombre: apoderadoNombre || "Apoderado",
      role: "apoderado",
      must_change_password: true,
    },
  });

  if (createErr) {
    throw new Error(`Error creando la cuenta de apoderado: ${createErr.message}`);
  }

  const newUserId = newUser.user.id;

  // Asignar rol y colegio
  await supabaseAdmin.from("user_roles").insert({
    user_id: newUserId,
    colegio_id: primaryColegioId,
    role: "apoderado",
  } as never);

  await supabaseAdmin.from("profiles").upsert({
    user_id: newUserId,
    email,
    colegio_id: primaryColegioId,
    nombre: apoderadoNombre || "Apoderado",
  } as never);

  // Enviar email de confirmación / activación
  try {
    await supabaseAdmin.auth.resend({
      type: "signup",
      email,
    });
  } catch (resendErr) {
    console.warn("Aviso al enviar correo de activación:", resendErr);
  }

  return {
    status: "activation_sent" as const,
    email,
    message: "¡Cuenta creada exitosamente! Hemos enviado un correo de validación a tu dirección de email para activar tu acceso. Por favor ábrelo y pulsa en el enlace de activación.",
  };
}

/**
 * Reenvía el correo de activación para cuentas de apoderados pendientes de verificación.
 */
export async function resendApoderadoActivationImpl(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  const existingUserId = await findUserByEmail(email);
  if (!existingUserId) {
    throw new Error("No existe una cuenta registrada con este correo.");
  }

  const { error } = await supabaseAdmin.auth.resend({
    type: "signup",
    email,
  });

  if (error) {
    throw new Error(`Error al reenviar el correo: ${error.message}`);
  }

  return { ok: true, message: "Enlace de activación reenviado correctamente." };
}

/**
 * Asegura la vinculación del colegio y rol de un apoderado tras iniciar sesión (incluyendo Google OAuth).
 */
export async function ensureApoderadoLinkedImpl(uid: string) {
  const email = await getVerifiedUserEmail(uid);

  // Verificar si ya tiene colegio asignado en user_roles
  const { data: currentRole } = await supabaseAdmin
    .from("user_roles")
    .select("colegio_id, role")
    .eq("user_id", uid)
    .maybeSingle();

  if (currentRole?.colegio_id) {
    return { colegioId: currentRole.colegio_id, role: currentRole.role };
  }

  // Si no tiene colegio asignado, buscar en matriculas
  const { data: mats } = await supabaseAdmin
    .from("matriculas")
    .select("colegio_id")
    .or(`apoderado_titular_email.ilike.${email},apoderado_suplente_email.ilike.${email}`)
    .limit(1);

  let targetColegioId = mats?.[0]?.colegio_id;

  if (!targetColegioId) {
    const { data: als } = await supabaseAdmin
      .from("alumnos")
      .select("colegio_id")
      .ilike("apoderado", `%${email}%`)
      .limit(1);
    targetColegioId = als?.[0]?.colegio_id;
  }

  if (targetColegioId) {
    await supabaseAdmin.from("user_roles").upsert({
      user_id: uid,
      colegio_id: targetColegioId,
      role: "apoderado",
    } as never);

    await supabaseAdmin
      .from("profiles")
      .update({ colegio_id: targetColegioId })
      .eq("user_id", uid);

    return { colegioId: targetColegioId, role: "apoderado" };
  }

  return { colegioId: null, role: "apoderado" };
}

