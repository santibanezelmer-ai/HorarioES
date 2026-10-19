import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { uidFromToken } from "@/lib/tenant.server";

const getMyAlumnosSchema = z.object({
  accessToken: z.string().min(1),
  colegioId: z.string().uuid(),
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
  colegioId: z.string().uuid(),
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
