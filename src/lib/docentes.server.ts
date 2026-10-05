import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function requireColegioAdmin(uid: string, colegioId: string) {
  const { data: sa } = await supabaseAdmin
    .from("user_roles").select("id")
    .eq("user_id", uid).eq("role", "superadmin").is("colegio_id", null).maybeSingle();
  if (sa) return;
  const { data } = await supabaseAdmin
    .from("user_roles").select("id")
    .eq("user_id", uid).eq("colegio_id", colegioId)
    .in("role", ["admin", "utp"]).maybeSingle();
  if (!data) throw new Error("Solo administradores del colegio pueden invitar docentes");
}

export async function findUserByEmail(email: string): Promise<string | null> {
  // Supabase admin doesn't expose a direct "find by email" without pagination;
  // we use the listUsers admin endpoint with a filter when possible.
  const cleaned = email.trim().toLowerCase();
  let page = 1;
  // Iterate a few pages defensively (most deployments are small).
  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === cleaned);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
    page += 1;
  }
  return null;
}
