import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

export const TENANT_ROLES = ["admin", "utp", "editor", "viewer", "docente"] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export async function uidFromToken(accessToken: string): Promise<string> {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const c = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.auth.getClaims(accessToken);
  if (error || !data?.claims?.sub) throw new Error("No autenticado");
  return data.claims.sub as string;
}

export async function requireSuperadmin(uid: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles").select("id")
    .eq("user_id", uid).eq("role", "superadmin").is("colegio_id", null).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Solo superadmin puede ejecutar esto");
}

export async function requireAdminOf(uid: string, colegioId: string) {
  const { data: sa } = await supabaseAdmin
    .from("user_roles").select("id")
    .eq("user_id", uid).eq("role", "superadmin").is("colegio_id", null).maybeSingle();
  if (sa) return;
  const { data, error } = await supabaseAdmin
    .from("user_roles").select("id")
    .eq("user_id", uid).eq("colegio_id", colegioId).eq("role", "admin").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Solo admin del colegio puede ejecutar esto");
}

export async function getColegioBySlugImpl(slug: string) {
  const { data: c, error } = await supabaseAdmin
    .from("colegios")
    .select("id, nombre, slug, logo_url, color_primario, activo")
    .ilike("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!c || !c.activo) return null;
  return c;
}

export async function validateAndSetActiveColegioImpl(accessToken: string, slug: string) {
  const uid = await uidFromToken(accessToken);
  const { data: c } = await supabaseAdmin
    .from("colegios").select("id, nombre, slug, logo_url, color_primario")
    .ilike("slug", slug).eq("activo", true).maybeSingle();
  if (!c) throw new Error("Colegio no encontrado");

  const { data: sa } = await supabaseAdmin
    .from("user_roles").select("id")
    .eq("user_id", uid).eq("role", "superadmin").is("colegio_id", null).maybeSingle();

  if (!sa) {
    const { data: m } = await supabaseAdmin
      .from("user_roles").select("role")
      .eq("user_id", uid).eq("colegio_id", c.id);
    if (!m || m.length === 0) throw new Error("No perteneces a este colegio");
  }

  await supabaseAdmin.from("profiles").update({ colegio_id: c.id }).eq("user_id", uid);
  return c;
}

export async function createColegioImpl(args: {
  accessToken: string; nombre: string; slug: string; adminEmail?: string;
}) {
  const uid = await uidFromToken(args.accessToken);
  await requireSuperadmin(uid);

  const { data: dup } = await supabaseAdmin
    .from("colegios").select("id").ilike("slug", args.slug).maybeSingle();
  if (dup) throw new Error("Ese slug ya existe");

  const { data: created, error } = await supabaseAdmin
    .from("colegios").insert({
      nombre: args.nombre, slug: args.slug, owner_id: uid, activo: true,
    } as never).select("id, slug, nombre").single();
  if (error) throw error;

  if (args.adminEmail) {
    await supabaseAdmin.from("invitaciones").insert({
      colegio_id: created.id, email: args.adminEmail.toLowerCase(),
      role: "admin", invited_by: uid,
    } as never);
  }
  return created;
}

export async function registerOrganizationImpl(args: {
  nombre: string;
  slug: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  phone?: string;
}) {
  const email = args.adminEmail.trim().toLowerCase();
  const slug = args.slug.trim().toLowerCase();

  const { data: dup } = await supabaseAdmin
    .from("colegios").select("id").ilike("slug", slug).maybeSingle();
  if (dup) throw new Error("Ese identificador ya está en uso. Elige otro.");

  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const found = existing.users.find((u) => (u.email ?? "").toLowerCase() === email);
  if (found) throw new Error("Ese correo ya tiene una cuenta. Inicia sesión en tu colegio.");

  const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: args.adminPassword,
    email_confirm: true,
    user_metadata: { full_name: args.adminName, phone: args.phone ?? null },
  });
  if (cErr || !created?.user) {
    console.error("registerOrganization createUser failed", cErr);
    throw new Error("No se pudo crear la cuenta. Verifica el correo e intenta nuevamente.");
  }
  const userId = created.user.id;

  const { data: colegio, error: colErr } = await supabaseAdmin
    .from("colegios").insert({
      nombre: args.nombre, slug, owner_id: userId, activo: true,
    } as never).select("id, slug, nombre").single();
  if (colErr) {
    console.error("registerOrganization createColegio failed", colErr);
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error("No se pudo crear la organización. Intenta nuevamente.");
  }

  await supabaseAdmin.from("user_roles").insert({
    user_id: userId, colegio_id: colegio.id, role: "admin",
  } as never);

  await supabaseAdmin.from("profiles").update({ colegio_id: colegio.id }).eq("user_id", userId);

  return { ok: true, slug: colegio.slug, colegioId: colegio.id };
}

export async function listColegiosImpl(accessToken: string) {
  const uid = await uidFromToken(accessToken);
  await requireSuperadmin(uid);
  const { data: rows, error } = await supabaseAdmin
    .from("colegios").select("id, nombre, slug, activo, created_at").order("nombre");
  if (error) throw error;
  return rows;
}

export async function toggleColegioActivoImpl(accessToken: string, id: string, activo: boolean) {
  const uid = await uidFromToken(accessToken);
  await requireSuperadmin(uid);
  const { error } = await supabaseAdmin.from("colegios").update({ activo }).eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function getColegioDetailImpl(accessToken: string, id: string) {
  const uid = await uidFromToken(accessToken);
  await requireSuperadmin(uid);

  const { data: c, error } = await supabaseAdmin
    .from("colegios")
    .select("id, nombre, slug, logo_url, color_primario, activo, owner_id, created_at, updated_at")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  if (!c) throw new Error("Colegio no encontrado");

  let ownerEmail: string | null = null;
  let ownerName: string | null = null;
  let ownerPhone: string | null = null;
  let ownerLastSignIn: string | null = null;
  try {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(c.owner_id);
    ownerEmail = u.user?.email ?? null;
    const meta = (u.user?.user_metadata ?? {}) as Record<string, unknown>;
    ownerName = (meta.full_name as string) ?? (meta.name as string) ?? null;
    ownerPhone = (meta.phone as string) ?? u.user?.phone ?? null;
    ownerLastSignIn = u.user?.last_sign_in_at ?? null;
  } catch (e) {
    console.error("getColegioDetail owner lookup failed", e);
  }

  const [{ count: miembros }, { count: docentes }, { count: cursos }, { count: invitaciones }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("colegio_id", c.id),
    supabaseAdmin.from("docentes").select("id", { count: "exact", head: true }).eq("colegio_id", c.id),
    supabaseAdmin.from("cursos").select("id", { count: "exact", head: true }).eq("colegio_id", c.id),
    supabaseAdmin.from("invitaciones").select("id", { count: "exact", head: true }).eq("colegio_id", c.id).is("accepted_at", null),
  ]);

  return {
    colegio: c,
    owner: { email: ownerEmail, name: ownerName, phone: ownerPhone, lastSignInAt: ownerLastSignIn },
    counts: {
      miembros: miembros ?? 0,
      docentes: docentes ?? 0,
      cursos: cursos ?? 0,
      invitacionesPendientes: invitaciones ?? 0,
    },
  };
}

export async function updateColegioImpl(args: {
  accessToken: string; id: string; nombre?: string; slug?: string;
}) {
  const uid = await uidFromToken(args.accessToken);
  await requireSuperadmin(uid);
  const patch: { nombre?: string; slug?: string } = {};
  if (args.nombre !== undefined) patch.nombre = args.nombre.trim();
  if (args.slug !== undefined) {
    const slug = args.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,64}$/.test(slug)) throw new Error("Slug inválido");
    const { data: dup } = await supabaseAdmin
      .from("colegios").select("id").ilike("slug", slug).neq("id", args.id).maybeSingle();
    if (dup) throw new Error("Ese slug ya está en uso");
    patch.slug = slug;
  }
  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await supabaseAdmin.from("colegios").update(patch).eq("id", args.id);
  if (error) throw error;
  return { ok: true };
}

export async function deleteColegioImpl(accessToken: string, id: string, confirmSlug: string) {
  const uid = await uidFromToken(accessToken);
  await requireSuperadmin(uid);
  const { data: c } = await supabaseAdmin
    .from("colegios").select("id, slug").eq("id", id).maybeSingle();
  if (!c) throw new Error("Colegio no encontrado");
  if (c.slug.toLowerCase() !== confirmSlug.trim().toLowerCase()) {
    throw new Error("La confirmación no coincide con el slug");
  }
  const { error } = await supabaseAdmin.from("colegios").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function createInvitacionImpl(args: {
  accessToken: string; colegioId: string; email: string; role: TenantRole;
}) {
  const uid = await uidFromToken(args.accessToken);
  await requireAdminOf(uid, args.colegioId);
  const email = args.email.trim().toLowerCase();
  const { data: row, error } = await supabaseAdmin.from("invitaciones").insert({
    colegio_id: args.colegioId, email, role: args.role, invited_by: uid,
  } as never).select("id, token, email, role, expires_at").single();
  if (error) throw error;
  return row;
}

export async function listInvitacionesImpl(accessToken: string, colegioId: string) {
  const uid = await uidFromToken(accessToken);
  await requireAdminOf(uid, colegioId);
  const { data: rows, error } = await supabaseAdmin.from("invitaciones")
    .select("id, email, role, token, expires_at, accepted_at, created_at")
    .eq("colegio_id", colegioId).order("created_at", { ascending: false });
  if (error) throw error;
  return rows;
}

export async function revokeInvitacionImpl(accessToken: string, id: string) {
  const uid = await uidFromToken(accessToken);
  const { data: inv } = await supabaseAdmin.from("invitaciones")
    .select("colegio_id").eq("id", id).maybeSingle();
  if (!inv) throw new Error("Invitación no existe");
  await requireAdminOf(uid, inv.colegio_id);
  await supabaseAdmin.from("invitaciones").delete().eq("id", id);
  return { ok: true };
}

export async function getInvitacionImpl(token: string) {
  const { data: inv } = await supabaseAdmin.from("invitaciones")
    .select("id, email, role, colegio_id, expires_at, accepted_at")
    .eq("token", token).maybeSingle();
  if (!inv) return null;
  if (inv.accepted_at) return { ...inv, _status: "accepted" as const };
  if (new Date(inv.expires_at) < new Date()) return { ...inv, _status: "expired" as const };
  const { data: c } = await supabaseAdmin.from("colegios")
    .select("nombre, slug, logo_url, color_primario").eq("id", inv.colegio_id).maybeSingle();
  return { ...inv, _status: "valid" as const, colegio: c };
}

export async function acceptInvitacionImpl(args: {
  token: string; password?: string; fullName?: string; accessToken?: string;
}) {
  const { data: inv } = await supabaseAdmin.from("invitaciones")
    .select("id, email, role, colegio_id, expires_at, accepted_at, token")
    .eq("token", args.token).maybeSingle();
  if (!inv) throw new Error("Invitación inválida");
  if (inv.accepted_at) throw new Error("Esta invitación ya fue usada");
  if (new Date(inv.expires_at) < new Date()) throw new Error("Invitación expirada");

  let userId: string;
  if (args.accessToken) {
    userId = await uidFromToken(args.accessToken);
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    if ((u.user?.email ?? "").toLowerCase() !== inv.email.toLowerCase()) {
      throw new Error("Esta invitación es para otro correo");
    }
  } else {
    if (!args.password) throw new Error("Falta contraseña");
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const found = existing.users.find((u) => (u.email ?? "").toLowerCase() === inv.email.toLowerCase());
    if (found) throw new Error("Ese correo ya tiene cuenta. Inicia sesión y vuelve a abrir el enlace.");

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: inv.email,
      password: args.password,
      email_confirm: true,
      user_metadata: { full_name: args.fullName ?? inv.email.split("@")[0] },
    });
    if (cErr || !created?.user) {
      console.error("acceptInvitacion createUser failed", cErr);
      throw new Error("No se pudo crear la cuenta. Intenta de nuevo o contacta al administrador.");
    }
    userId = created.user.id;
  }

  await supabaseAdmin.from("user_roles").insert({
    user_id: userId, colegio_id: inv.colegio_id, role: inv.role,
  } as never);
  await supabaseAdmin.from("profiles").update({ colegio_id: inv.colegio_id }).eq("user_id", userId);
  await supabaseAdmin.from("invitaciones").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);

  const { data: c } = await supabaseAdmin.from("colegios").select("slug").eq("id", inv.colegio_id).single();
  return { ok: true, slug: c!.slug };
}

export async function linkPendingInvitationsImpl(accessToken: string) {
  const uid = await uidFromToken(accessToken);
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(uid);
  if (userError) throw userError;

  const email = (userData.user?.email ?? "").trim().toLowerCase();
  if (!email) return [];

  const { data: invitations, error } = await supabaseAdmin
    .from("invitaciones")
    .select("id, colegio_id, role")
    .ilike("email", email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString());
  if (error) throw error;

  const linked: Array<{ colegio_id: string; role: string }> = [];

  for (const inv of invitations ?? []) {
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: uid, colegio_id: inv.colegio_id, role: inv.role } as never, {
        onConflict: "user_id,colegio_id,role",
        ignoreDuplicates: true,
      });

    if (inv.role === "docente") {
      await supabaseAdmin
        .from("docentes")
        .update({ user_id: uid, invited_email: null } as never)
        .eq("colegio_id", inv.colegio_id)
        .ilike("invited_email", email)
        .is("user_id", null);
    }

    await supabaseAdmin
      .from("profiles")
      .update({ colegio_id: inv.colegio_id } as never)
      .eq("user_id", uid)
      .is("colegio_id", null);

    await supabaseAdmin
      .from("invitaciones")
      .update({ accepted_at: new Date().toISOString() } as never)
      .eq("id", inv.id);

    linked.push({ colegio_id: inv.colegio_id, role: inv.role });
  }

  return linked;
}

export async function checkSuperadminImpl(accessToken: string) {
  try {
    const uid = await uidFromToken(accessToken);
    const { data: r } = await supabaseAdmin
      .from("user_roles").select("id")
      .eq("user_id", uid).eq("role", "superadmin").is("colegio_id", null).maybeSingle();
    return { isSuperadmin: !!r };
  } catch {
    return { isSuperadmin: false };
  }
}
