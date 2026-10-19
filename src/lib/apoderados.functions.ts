import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { uidFromToken } from "@/lib/tenant.server";

const getMyAlumnosSchema = z.object({
  accessToken: z.string().min(1),
  colegioId: z.string().uuid().optional(),
});

export const getMyAlumnosSecure = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof getMyAlumnosSchema>) =>
    getMyAlumnosSchema.parse(input)
  )
  .handler(async ({ data }) => {
    const { getApoderadoAlumnosImpl } = await import("@/lib/apoderados.server");
    const uid = await uidFromToken(data.accessToken);
    return await getApoderadoAlumnosImpl(uid, data.colegioId);
  });

const getFichaAlumnoSchema = z.object({
  accessToken: z.string().min(1),
  colegioId: z.string().uuid().optional(),
  alumnoId: z.string().uuid(),
});

export const getFichaAlumnoSecure = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof getFichaAlumnoSchema>) =>
    getFichaAlumnoSchema.parse(input)
  )
  .handler(async ({ data }) => {
    const { getFichaAlumnoApoderadoImpl } = await import("@/lib/apoderados.server");
    const uid = await uidFromToken(data.accessToken);
    return await getFichaAlumnoApoderadoImpl(uid, data.alumnoId, data.colegioId);
  });

const loginOrActivateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const loginOrActivateApoderado = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof loginOrActivateSchema>) =>
    loginOrActivateSchema.parse(input)
  )
  .handler(async ({ data }) => {
    const { loginOrActivateApoderadoImpl } = await import("@/lib/apoderados.server");
    return await loginOrActivateApoderadoImpl(data.email, data.password);
  });

const resendActivationSchema = z.object({
  email: z.string().email(),
});

export const resendApoderadoActivation = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof resendActivationSchema>) =>
    resendActivationSchema.parse(input)
  )
  .handler(async ({ data }) => {
    const { resendApoderadoActivationImpl } = await import("@/lib/apoderados.server");
    return await resendApoderadoActivationImpl(data.email);
  });

const ensureLinkedSchema = z.object({
  accessToken: z.string().min(1),
});

export const ensureApoderadoLinked = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof ensureLinkedSchema>) =>
    ensureLinkedSchema.parse(input)
  )
  .handler(async ({ data }) => {
    const { ensureApoderadoLinkedImpl } = await import("@/lib/apoderados.server");
    const uid = await uidFromToken(data.accessToken);
    return await ensureApoderadoLinkedImpl(uid);
  });

