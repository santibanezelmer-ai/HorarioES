import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  deleteCursoForAccessToken,
  getColegioForAccessToken,
  getCursosForAccessToken,
  importSchoolDataForAccessToken,
  saveCursoForAccessToken,
  updateColegioForAccessToken,
} from "./school.server";

const tokenSchema = z.object({ accessToken: z.string().min(1) });

const cursoSchema = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().trim().min(1),
  nivel: z.enum(["prebásica", "1er ciclo", "2do ciclo"]),
  prof_jefe_id: z.string().uuid().nullable().optional(),
});

const rowSchema = z.record(z.unknown());
const importPayloadSchema = z.object({
  asignaturas: z.array(rowSchema).optional(),
  docentes: z.array(rowSchema).optional(),
  cursos: z.array(rowSchema).optional(),
  bloques: z.array(rowSchema).optional(),
  espacios: z.array(rowSchema).optional(),
  horarios: z.array(rowSchema).optional(),
  schedule_slots: z.array(rowSchema).optional(),
  pie_plan: z.array(rowSchema).optional(),
  alumnos: z.array(rowSchema).optional(),
}).passthrough();

export const getCursosData = createServerFn({ method: "POST" })
  .inputValidator((data) => tokenSchema.parse(data))
  .handler(async ({ data }) => getCursosForAccessToken(data.accessToken));

export const saveCurso = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ accessToken: z.string().min(1), curso: cursoSchema }).parse(data))
  .handler(async ({ data }) => saveCursoForAccessToken(data.accessToken, data.curso));

export const deleteCurso = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ accessToken: z.string().min(1), id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => deleteCursoForAccessToken(data.accessToken, data.id));

export const getColegioData = createServerFn({ method: "POST" })
  .inputValidator((data) => tokenSchema.parse(data))
  .handler(async ({ data }) => getColegioForAccessToken(data.accessToken));

export const updateColegio = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    accessToken: z.string().min(1),
    colegio: z.object({ nombre: z.string().trim().min(1), logo_url: z.string().nullable().optional() }),
  }).parse(data))
  .handler(async ({ data }) => updateColegioForAccessToken(data.accessToken, data.colegio));

export const importSchoolData = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    accessToken: z.string().min(1),
    payload: importPayloadSchema,
    replace: z.boolean(),
  }).parse(data))
  .handler(async ({ data }) => importSchoolDataForAccessToken(data.accessToken, data.payload, data.replace));
