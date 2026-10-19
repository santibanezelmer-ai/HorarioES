import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { uidFromToken } from "@/lib/tenant.server";

const inviteSchema = z.object({
  accessToken: z.string().min(1),
  docenteId: z.string().uuid(),
  colegioId: z.string().uuid(),
  email: z.string().email(),
});

export const inviteOrLinkDocente = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof inviteSchema>) => inviteSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireColegioAdmin, findUserByEmail } = await import("@/lib/docentes.server");

    const uid = await uidFromToken(data.accessToken);
    await requireColegioAdmin(uid, data.colegioId);

    const email = data.email.trim().toLowerCase();

    // Ensure the docente exists in this colegio.
    const { data: docente, error: dErr } = await supabaseAdmin
      .from("docentes").select("id, colegio_id, user_id")
      .eq("id", data.docenteId).maybeSingle();
    if (dErr) throw dErr;
    if (!docente || docente.colegio_id !== data.colegioId) {
      throw new Error("Docente no encontrado en este colegio");
    }
    if (docente.user_id) throw new Error("Este docente ya tiene una cuenta vinculada");

    // 1) If the email belongs to an existing platform user, link directly.
    const existingUserId = await findUserByEmail(email);
    if (existingUserId) {
      const { error: updErr } = await supabaseAdmin
        .from("docentes")
        .update({ user_id: existingUserId, invited_email: null })
        .eq("id", data.docenteId);
      if (updErr) throw updErr;

      // Grant docente role (ignore duplicates).
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: existingUserId, colegio_id: data.colegioId, role: "docente" } as never);
      if (roleErr && !String(roleErr.message).toLowerCase().includes("duplicate")) throw roleErr;

      // Update profile colegio_id if missing.
      await supabaseAdmin
        .from("profiles")
        .update({ colegio_id: data.colegioId })
        .eq("user_id", existingUserId)
        .is("colegio_id", null);

      return { linked: true as const, invited: false as const };
    }

    // 2) Otherwise create/refresh an invitation and tag the docente row with the email.
    const { data: existing } = await supabaseAdmin
      .from("invitaciones")
      .select("id, accepted_at")
      .eq("colegio_id", data.colegioId)
      .ilike("email", email)
      .eq("role", "docente")
      .is("accepted_at", null)
      .maybeSingle();

    if (!existing) {
      const { error: invErr } = await supabaseAdmin.from("invitaciones").insert({
        colegio_id: data.colegioId,
        email,
        role: "docente",
        invited_by: uid,
      } as never);
      if (invErr) throw invErr;
    }

    const { error: tagErr } = await supabaseAdmin
      .from("docentes")
      .update({ invited_email: email })
      .eq("id", data.docenteId);
    if (tagErr) throw tagErr;

    return { linked: false as const, invited: true as const };
  });

const bulkInviteSchema = z.object({
  accessToken: z.string().min(1),
  colegioId: z.string().uuid(),
  items: z.array(
    z.object({
      docenteId: z.string().uuid(),
      email: z.string().email(),
    })
  ).min(1).max(200),
});

export const inviteDocentesBulk = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof bulkInviteSchema>) => bulkInviteSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireColegioAdmin, findUserByEmail } = await import("@/lib/docentes.server");

    const uid = await uidFromToken(data.accessToken);
    await requireColegioAdmin(uid, data.colegioId);

    const results: Array<{
      docenteId: string;
      email: string;
      status: "linked" | "invited" | "error";
      token?: string;
      message?: string;
    }> = [];

    // Cargar invitaciones existentes del colegio para no duplicar llamadas innecesarias
    const { data: existingInvitations } = await supabaseAdmin
      .from("invitaciones")
      .select("id, token, email, accepted_at")
      .eq("colegio_id", data.colegioId)
      .eq("role", "docente")
      .is("accepted_at", null);

    const invMap = new Map((existingInvitations ?? []).map((i) => [i.email.toLowerCase(), i.token]));

    for (const item of data.items) {
      const email = item.email.trim().toLowerCase();
      try {
        // Verificar que el docente pertenezca a este colegio
        const { data: doc, error: docErr } = await supabaseAdmin
          .from("docentes")
          .select("id, user_id")
          .eq("id", item.docenteId)
          .eq("colegio_id", data.colegioId)
          .maybeSingle();

        if (docErr) throw docErr;
        if (!doc) throw new Error("Docente no encontrado");
        if (doc.user_id) {
          results.push({ docenteId: item.docenteId, email, status: "linked", message: "Ya tenía cuenta vinculada" });
          continue;
        }

        // 1. Si el usuario ya existe en Supabase Auth, vincular de inmediato
        const existingUserId = await findUserByEmail(email);
        if (existingUserId) {
          await supabaseAdmin
            .from("docentes")
            .update({ user_id: existingUserId, invited_email: null })
            .eq("id", item.docenteId);

          const { error: roleErr } = await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: existingUserId, colegio_id: data.colegioId, role: "docente" } as never);
          if (roleErr && !String(roleErr.message).toLowerCase().includes("duplicate")) throw roleErr;

          await supabaseAdmin
            .from("profiles")
            .update({ colegio_id: data.colegioId })
            .eq("user_id", existingUserId)
            .is("colegio_id", null);

          results.push({ docenteId: item.docenteId, email, status: "linked" });
          continue;
        }

        // 2. Si no tiene cuenta, crear o reutilizar invitación
        let token = invMap.get(email);
        if (!token) {
          const { data: newInv, error: invErr } = await supabaseAdmin
            .from("invitaciones")
            .insert({
              colegio_id: data.colegioId,
              email,
              role: "docente",
              invited_by: uid,
            } as never)
            .select("token")
            .single();

          if (invErr) throw invErr;
          token = newInv.token;
          invMap.set(email, token);
        }

        await supabaseAdmin
          .from("docentes")
          .update({ invited_email: email })
          .eq("id", item.docenteId);

        results.push({ docenteId: item.docenteId, email, status: "invited", token });
      } catch (err) {
        results.push({
          docenteId: item.docenteId,
          email,
          status: "error",
          message: err instanceof Error ? err.message : "Error inesperado",
        });
      }
    }

    return results;
  });

