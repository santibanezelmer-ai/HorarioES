import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createDocenteForAccessToken,
  createReemplazoForAccessToken,
  deleteReemplazoForAccessToken,
  getReemplazosForAccessToken,
} from "./reemplazos.server";

const tokenSchema = z.object({ accessToken: z.string().min(1) });

const replacementSchema = z.object({
  docente_id: z.string().uuid(),
  titular_id: z.string().uuid().nullable().optional(),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observaciones: z.string().max(1000).nullable().optional(),
});

const newDocenteSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const getReemplazosData = createServerFn({ method: "POST" })
  .inputValidator((data) => tokenSchema.parse(data))
  .handler(async ({ data }) => getReemplazosForAccessToken(data.accessToken));

export const createReemplazo = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ accessToken: z.string().min(1), reemplazo: replacementSchema }).parse(data))
  .handler(async ({ data }) => createReemplazoForAccessToken(data.accessToken, data.reemplazo));

export const createDocenteReemplazante = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ accessToken: z.string().min(1), docente: newDocenteSchema }).parse(data))
  .handler(async ({ data }) => createDocenteForAccessToken(data.accessToken, data.docente));

export const deleteReemplazo = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ accessToken: z.string().min(1), id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => deleteReemplazoForAccessToken(data.accessToken, data.id));