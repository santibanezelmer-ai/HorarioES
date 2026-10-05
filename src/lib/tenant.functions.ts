import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  TENANT_ROLES,
  getColegioBySlugImpl,
  validateAndSetActiveColegioImpl,
  createColegioImpl,
  listColegiosImpl,
  toggleColegioActivoImpl,
  createInvitacionImpl,
  listInvitacionesImpl,
  revokeInvitacionImpl,
  getInvitacionImpl,
  acceptInvitacionImpl,
  checkSuperadminImpl,
  registerOrganizationImpl,
  getColegioDetailImpl,
  updateColegioImpl,
  deleteColegioImpl,
  linkPendingInvitationsImpl,
} from "./tenant.server";

export const registerOrganization = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      nombre: z.string().trim().min(2, "Nombre muy corto").max(120),
      slug: z.string().trim().toLowerCase().min(2).max(64)
        .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
      adminEmail: z.string().trim().toLowerCase().email().max(255),
      adminPassword: z.string().min(8, "Mínimo 8 caracteres").max(128),
      adminName: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(40).optional(),
    }).parse(input))
  .handler(async ({ data }) => registerOrganizationImpl(data));

export const getColegioBySlug = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ slug: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/) }).parse(input))
  .handler(async ({ data }) => getColegioBySlugImpl(data.slug));

export const validateAndSetActiveColegio = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      accessToken: z.string().min(1),
      slug: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
    }).parse(input))
  .handler(async ({ data }) => validateAndSetActiveColegioImpl(data.accessToken, data.slug));

export const createColegio = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      accessToken: z.string().min(1),
      nombre: z.string().min(2).max(120),
      slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
      adminEmail: z.string().email().optional(),
    }).parse(input))
  .handler(async ({ data }) => createColegioImpl(data));

export const listColegios = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ accessToken: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => listColegiosImpl(data.accessToken));

export const toggleColegioActivo = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ accessToken: z.string().min(1), id: z.string().uuid(), activo: z.boolean() }).parse(input))
  .handler(async ({ data }) => toggleColegioActivoImpl(data.accessToken, data.id, data.activo));

export const createInvitacion = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      accessToken: z.string().min(1),
      colegioId: z.string().uuid(),
      email: z.string().email().max(255),
      role: z.enum(TENANT_ROLES),
    }).parse(input))
  .handler(async ({ data }) => createInvitacionImpl(data));

export const listInvitaciones = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ accessToken: z.string().min(1), colegioId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => listInvitacionesImpl(data.accessToken, data.colegioId));

export const revokeInvitacion = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ accessToken: z.string().min(1), id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => revokeInvitacionImpl(data.accessToken, data.id));

export const getInvitacion = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data }) => getInvitacionImpl(data.token));

export const acceptInvitacion = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      token: z.string().min(8).max(128),
      password: z.string().min(8).max(128).optional(),
      fullName: z.string().min(1).max(120).optional(),
      accessToken: z.string().optional(),
    }).parse(input))
  .handler(async ({ data }) => acceptInvitacionImpl(data));

export const checkSuperadmin = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ accessToken: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => checkSuperadminImpl(data.accessToken));

export const linkPendingInvitations = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ accessToken: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => linkPendingInvitationsImpl(data.accessToken));

export const getColegioDetail = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ accessToken: z.string().min(1), id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => getColegioDetailImpl(data.accessToken, data.id));

export const updateColegio = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      accessToken: z.string().min(1),
      id: z.string().uuid(),
      nombre: z.string().trim().min(2).max(120).optional(),
      slug: z.string().trim().toLowerCase().min(2).max(64).regex(/^[a-z0-9-]+$/).optional(),
    }).parse(input))
  .handler(async ({ data }) => updateColegioImpl(data));

export const deleteColegio = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      accessToken: z.string().min(1),
      id: z.string().uuid(),
      confirmSlug: z.string().min(1).max(64),
    }).parse(input))
  .handler(async ({ data }) => deleteColegioImpl(data.accessToken, data.id, data.confirmSlug));
