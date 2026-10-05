import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getProfileForAccessToken } from "./profile.server";

export interface ReemplazoInput {
  docente_id: string;
  titular_id?: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  observaciones?: string | null;
}

async function getSchoolContext(accessToken: string) {
  const profile = await getProfileForAccessToken(accessToken);
  if (!profile?.colegio_id) throw new Error("No se pudo identificar tu colegio.");
  const colegioId = profile.colegio_id;
  const userId = profile.user_id;

  // Verify membership before using admin client (which bypasses RLS).
  const [memberRes, superRes] = await Promise.all([
    supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("colegio_id", colegioId)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "superadmin")
      .is("colegio_id", null)
      .limit(1)
      .maybeSingle(),
  ]);
  if (memberRes.error) throw memberRes.error;
  if (superRes.error) throw superRes.error;
  if (!memberRes.data && !superRes.data) {
    throw new Error("No perteneces a este colegio.");
  }

  return { colegioId, userId };
}

async function ensureCanEdit(userId: string, colegioId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("colegio_id", colegioId)
    .in("role", ["admin", "editor"])
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No tienes permisos para realizar esta acción.");
}

export async function getReemplazosForAccessToken(accessToken: string) {
  const { colegioId } = await getSchoolContext(accessToken);

  const [docentesResult, reemplazosResult] = await Promise.all([
    supabaseAdmin.from("docentes").select("id, nombre, color").eq("colegio_id", colegioId).order("nombre"),
    supabaseAdmin
      .from("reemplazantes")
      .select("id, docente_id, titular_id, fecha_inicio, fecha_fin, observaciones")
      .eq("colegio_id", colegioId)
      .order("fecha_inicio", { ascending: false }),
  ]);

  if (docentesResult.error) throw docentesResult.error;
  if (reemplazosResult.error) throw reemplazosResult.error;

  return {
    colegioId,
    docentes: docentesResult.data ?? [],
    reemplazos: reemplazosResult.data ?? [],
  };
}

export async function createReemplazoForAccessToken(accessToken: string, reemplazo: ReemplazoInput) {
  const { colegioId, userId } = await getSchoolContext(accessToken);
  await ensureCanEdit(userId, colegioId);

  const { error } = await supabaseAdmin.from("reemplazantes").insert({
    ...reemplazo,
    colegio_id: colegioId,
    titular_id: reemplazo.titular_id ?? null,
    observaciones: reemplazo.observaciones ?? null,
  });

  if (error) throw error;
  return { ok: true };
}

export async function createDocenteForAccessToken(
  accessToken: string,
  docente: { nombre: string; color?: string },
) {
  const { colegioId, userId } = await getSchoolContext(accessToken);
  await ensureCanEdit(userId, colegioId);

  const { data, error } = await supabaseAdmin
    .from("docentes")
    .insert({
      nombre: docente.nombre,
      color: docente.color ?? "#4f8ef7",
      colegio_id: colegioId,
    })
    .select("id, nombre, color")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteReemplazoForAccessToken(accessToken: string, id: string) {
  const { colegioId, userId } = await getSchoolContext(accessToken);
  await ensureCanEdit(userId, colegioId);

  const { error } = await supabaseAdmin.from("reemplazantes").delete().eq("id", id).eq("colegio_id", colegioId);
  if (error) throw error;
  return { ok: true };
}