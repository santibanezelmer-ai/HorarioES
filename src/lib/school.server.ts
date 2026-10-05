import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getProfileForAccessToken } from "./profile.server";

type AnyRow = Record<string, unknown>;

export interface ImportPayload {
  asignaturas?: AnyRow[];
  docentes?: AnyRow[];
  cursos?: AnyRow[];
  bloques?: AnyRow[];
  espacios?: AnyRow[];
  horarios?: AnyRow[];
  schedule_slots?: AnyRow[];
  pie_plan?: AnyRow[];
  alumnos?: AnyRow[];
}

export interface CursoInput {
  id?: string;
  nombre: string;
  nivel: "prebásica" | "1er ciclo" | "2do ciclo";
  prof_jefe_id?: string | null;
}

export interface ColegioInput {
  nombre: string;
  logo_url?: string | null;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const norm = (s: unknown) =>
  String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const keyNorm = (s: unknown) => norm(s).replace(/[^a-z0-9]/g, "");

const getField = (row: AnyRow, ...aliases: string[]) => {
  const values = new Map(Object.entries(row).map(([key, value]) => [keyNorm(key), value]));
  for (const alias of aliases) {
    const value = values.get(keyNorm(alias));
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
};

const textField = (row: AnyRow, ...aliases: string[]) => String(getField(row, ...aliases) ?? "").trim();

const numberField = (row: AnyRow, ...aliases: string[]) => {
  const value = getField(row, ...aliases);
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const numericText = String(value).replace(",", ".").match(/-?\d+(?:\.\d+)?/)?.[0];
  const parsed = numericText ? Number(numericText) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const boolField = (row: AnyRow, ...aliases: string[]) => {
  const value = getField(row, ...aliases);
  if (typeof value === "boolean") return value;
  const normalized = norm(value);
  return ["1", "si", "sí", "true", "x", "yes", "pie"].includes(normalized);
};

const arrayField = (row: AnyRow, fallback: string[], ...aliases: string[]) => {
  const value = getField(row, ...aliases);
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(/[,;|]/).map((v) => v.trim()).filter(Boolean);
  return fallback;
};

const nivelCurso = (value: unknown): "prebásica" | "1er ciclo" | "2do ciclo" => {
  const n = norm(value);
  if (n.includes("pre") || n.includes("parv")) return "prebásica";
  if (n.includes("2") || n.includes("segundo") || n.includes("7") || n.includes("8")) return "2do ciclo";
  return "1er ciclo";
};

const bloqueTipo = (value: unknown): "clase" | "recreo" | "almuerzo" => {
  const n = norm(value);
  if (n.includes("recreo") || n.includes("break")) return "recreo";
  if (n.includes("almuerzo") || n.includes("colacion") || n.includes("comida")) return "almuerzo";
  return "clase";
};

const pieTipo = (value: unknown): "aula_recurso" | "acompanamiento" =>
  norm(value).includes("recurso") ? "aula_recurso" : "acompanamiento";

const dayIndex = (v: unknown): number | null => {
  if (typeof v === "number" && v >= 0 && v <= 4) return v;
  const n = norm(v);
  const map: Record<string, number> = {
    "0": 0, "1": 1, "2": 2, "3": 3, "4": 4,
    lunes: 0, lun: 0, mon: 0, monday: 0,
    martes: 1, mar: 1, tue: 1, tuesday: 1,
    miercoles: 2, mie: 2, mier: 2, wed: 2, wednesday: 2,
    jueves: 3, jue: 3, thu: 3, thursday: 3,
    viernes: 4, vie: 4, fri: 4, friday: 4,
  };
  return n in map ? map[n] : null;
};

function isTransientDbError(error: unknown) {
  const err = error as { code?: string; message?: string; status?: number };
  const msg = String(err?.message ?? "").toLowerCase();
  return (
    err?.status === 503 ||
    ["PGRST000", "PGRST001", "PGRST002", "PGRST003", "57P03"].includes(String(err?.code ?? "")) ||
    msg.includes("recovery mode") ||
    msg.includes("not accepting connections") ||
    msg.includes("database client error") ||
    msg.includes("schema cache") ||
    msg.includes("no connection") ||
    msg.includes("service unavailable") ||
    msg.includes("retrying the connection")
  );
}

function toLabeledError(label: string, error: unknown) {
  const err = error as { code?: string; message?: string };
  const message = err?.message ? `${label}: ${err.message}` : `${label}: error de base de datos`;
  return Object.assign(new Error(message), { code: err?.code });
}

async function withDbRetry<T>(label: string, action: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === attempts) break;
      await wait(450 * attempt);
    }
  }
  throw toLabeledError(label, lastError);
}

async function runQuery<T>(label: string, action: () => unknown) {
  return withDbRetry(label, async () => {
    const { data, error } = await (action() as PromiseLike<{ data: T | null; error: unknown }>);
    if (error) throw error;
    return data;
  });
}

async function getSchoolContext(accessToken: string) {
  const profile = await getProfileForAccessToken(accessToken);
  if (!profile?.colegio_id) throw new Error("No se pudo identificar tu colegio.");
  const colegioId = profile.colegio_id;
  const userId = profile.user_id;

  // Verify membership: prevents tenant pivot via profile.colegio_id tampering,
  // since admin client queries below bypass RLS.
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

type AppRole = "admin" | "editor" | "viewer";

async function ensureRole(userId: string, colegioId: string, roles: AppRole[]) {
  const data = await runQuery<{ id: string }[]>("Permisos", () =>
    supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("colegio_id", colegioId)
      .in("role", roles)
      .limit(1)
  );
  if (!data?.length) throw new Error("No tienes permisos para realizar esta acción.");
}

export async function getCursosForAccessToken(accessToken: string) {
  const { colegioId } = await getSchoolContext(accessToken);
  const [cursos, docentes] = await Promise.all([
    runQuery("Cursos", () =>
      supabaseAdmin.from("cursos").select("id, nombre, nivel, prof_jefe_id").eq("colegio_id", colegioId).order("nombre")
    ),
    runQuery("Docentes", () =>
      supabaseAdmin.from("docentes").select("id, nombre, color").eq("colegio_id", colegioId).order("nombre")
    ),
  ]);
  return { colegioId, cursos: cursos ?? [], docentes: docentes ?? [] };
}

export async function saveCursoForAccessToken(accessToken: string, curso: CursoInput) {
  const { colegioId, userId } = await getSchoolContext(accessToken);
  await ensureRole(userId, colegioId, ["admin", "editor"]);
  const payload = {
    nombre: curso.nombre.trim(),
    nivel: curso.nivel,
    prof_jefe_id: curso.prof_jefe_id ?? null,
  };

  const cursoId = curso.id;
  if (cursoId) {
    await runQuery("Actualizar curso", () =>
      supabaseAdmin.from("cursos").update(payload).eq("id", cursoId).eq("colegio_id", colegioId)
    );
  } else {
    await runQuery("Crear curso", () =>
      supabaseAdmin.from("cursos").insert({ ...payload, colegio_id: colegioId } as never)
    );
  }
  return { ok: true };
}

export async function deleteCursoForAccessToken(accessToken: string, id: string) {
  const { colegioId, userId } = await getSchoolContext(accessToken);
  await ensureRole(userId, colegioId, ["admin", "editor"]);
  await runQuery("Eliminar horario del curso", () =>
    supabaseAdmin.from("schedule_slots").delete().eq("curso_id", id).eq("colegio_id", colegioId)
  );
  await runQuery("Eliminar curso", () =>
    supabaseAdmin.from("cursos").delete().eq("id", id).eq("colegio_id", colegioId)
  );
  return { ok: true };
}

export async function getColegioForAccessToken(accessToken: string) {
  const { colegioId } = await getSchoolContext(accessToken);
  const colegio = await runQuery<{ id: string; nombre: string; logo_url: string | null }>("Colegio", () =>
    supabaseAdmin.from("colegios").select("id, nombre, logo_url").eq("id", colegioId).maybeSingle()
  );
  return colegio ?? null;
}

export async function updateColegioForAccessToken(accessToken: string, input: ColegioInput) {
  const { colegioId, userId } = await getSchoolContext(accessToken);
  await ensureRole(userId, colegioId, ["admin"]);
  await runQuery("Actualizar colegio", () =>
    supabaseAdmin
      .from("colegios")
      .update({ nombre: input.nombre.trim(), logo_url: input.logo_url?.trim() || null })
      .eq("id", colegioId)
  );
  return { ok: true };
}

export async function importSchoolDataForAccessToken(accessToken: string, payload: ImportPayload, replace: boolean) {
  const { colegioId, userId } = await getSchoolContext(accessToken);
  await ensureRole(userId, colegioId, ["admin", "editor"]);
  const logs: { label: string; ok: boolean; detail: string }[] = [];

  if (replace) {
    const tables = ["schedule_slots", "pie_plan", "docente_blocks", "cursos", "docentes", "asignaturas", "espacios", "bloques"] as const;
    for (const table of tables) {
      await runQuery(`Limpiar ${table}`, () => supabaseAdmin.from(table).delete().eq("colegio_id", colegioId));
    }
    logs.push({ label: "Limpieza previa", ok: true, detail: "Datos anteriores eliminados" });
  }

  const asigMap = new Map<string, string>();
  if (payload.asignaturas?.length) {
    const rows = payload.asignaturas.map((a, i) => ({
      colegio_id: colegioId,
      nombre: textField(a, "nombre", "name", "asignatura", "materia", "subject"),
      color: String(getField(a, "color") ?? "#4f8ef7"),
      ciclos: arrayField(a, ["prebásica", "1er ciclo", "2do ciclo"], "ciclos", "ciclo", "niveles"),
      orden: numberField(a, "orden", "order", "n°", "numero") ?? i,
    })).filter((a) => a.nombre);
    if (rows.length) {
      const data = await runQuery<{ id: string; nombre: string }[]>("Asignaturas", () =>
        supabaseAdmin.from("asignaturas").insert(rows as never).select("id, nombre")
      );
      data?.forEach((d) => asigMap.set(norm(d.nombre), d.id));
    }
    logs.push({ label: "Asignaturas", ok: true, detail: `${rows.length} importadas` });
  }

  const docMap = new Map<string, string>();
  if (payload.docentes?.length) {
    const rows = payload.docentes.map((d) => ({
      colegio_id: colegioId,
      nombre: textField(d, "nombre", "name", "docente", "profesor", "teacher"),
      color: String(getField(d, "color") ?? "#4f8ef7"),
      ciclos: arrayField(d, [], "ciclos", "ciclo", "niveles"),
      dias: Array.isArray(getField(d, "dias", "días", "days")) ? getField(d, "dias", "días", "days") as number[] : [0, 1, 2, 3, 4],
      es_pie: boolField(d, "es_pie", "es pie", "pie", "programa integracion"),
      horas_utp: numberField(d, "horas_utp", "horas utp", "utp"),
    })).filter((d) => d.nombre);
    if (rows.length) {
      const data = await runQuery<{ id: string; nombre: string }[]>("Docentes", () =>
        supabaseAdmin.from("docentes").insert(rows as never).select("id, nombre")
      );
      data?.forEach((d) => docMap.set(norm(d.nombre), d.id));
    }
    logs.push({ label: "Docentes", ok: true, detail: `${rows.length} importados` });
  }

  const espMap = new Map<string, string>();
  if (payload.espacios?.length) {
    const rows = payload.espacios.map((e) => ({
      colegio_id: colegioId,
      nombre: textField(e, "nombre", "name", "espacio", "sala", "space"),
      tipo: String(getField(e, "tipo", "type") ?? "sala"),
      color: String(getField(e, "color") ?? "#34d399"),
    })).filter((e) => e.nombre);
    if (rows.length) {
      const data = await runQuery<{ id: string; nombre: string }[]>("Espacios", () =>
        supabaseAdmin.from("espacios").insert(rows as never).select("id, nombre")
      );
      data?.forEach((d) => espMap.set(norm(d.nombre), d.id));
    }
    logs.push({ label: "Espacios", ok: true, detail: `${rows.length} importados` });
  }

  if (payload.bloques?.length) {
    const rows = payload.bloques.map((b, i) => ({
      colegio_id: colegioId,
      nombre: textField(b, "nombre", "name", "bloque", "periodo") || `Bloque ${i + 1}`,
      hora: String(getField(b, "hora", "time", "inicio") ?? "08:00"),
      duracion: numberField(b, "duracion", "duración", "duration") ?? 45,
      tipo: bloqueTipo(getField(b, "tipo", "type", "nombre", "name")),
      orden: numberField(b, "orden", "order", "slot", "bloque", "periodo") ?? i,
    }));
    if (rows.length) {
      await runQuery("Bloques", () => supabaseAdmin.from("bloques").insert(rows as never).select("id"));
    }
    logs.push({ label: "Bloques", ok: true, detail: `${rows.length} importados` });
  }

  const cursoMap = new Map<string, string>();
  if (payload.cursos?.length) {
    const rows = payload.cursos.map((c) => {
      const jefeNom = getField(c, "prof_jefe", "profesor_jefe", "profesor jefe", "jefe");
      return {
        colegio_id: colegioId,
        nombre: textField(c, "nombre", "name", "curso", "course", "clase"),
        nivel: nivelCurso(getField(c, "nivel", "ciclo", "level", "nombre", "curso")),
        prof_jefe_id: jefeNom ? docMap.get(norm(jefeNom)) ?? null : null,
      };
    }).filter((c) => c.nombre);
    if (rows.length) {
      const data = await runQuery<{ id: string; nombre: string }[]>("Cursos", () =>
        supabaseAdmin.from("cursos").insert(rows as never).select("id, nombre")
      );
      data?.forEach((d) => cursoMap.set(norm(d.nombre), d.id));
    }
    logs.push({ label: "Cursos", ok: true, detail: `${rows.length} importados` });
  }

  const horarios = payload.horarios ?? payload.schedule_slots;
  if (horarios?.length) {
    const rows: AnyRow[] = [];
    let skipped = 0;
    for (const h of horarios) {
      const cursoId = (getField(h, "curso_id", "curso id") as string | undefined) ?? cursoMap.get(norm(getField(h, "curso", "course", "clase")));
      const dia = dayIndex(getField(h, "dia", "día", "day"));
      const slot = numberField(h, "slot", "bloque", "periodo", "orden");
      if (!cursoId || dia == null || slot == null || Number.isNaN(slot)) { skipped++; continue; }
      rows.push({
        colegio_id: colegioId,
        curso_id: cursoId,
        dia,
        slot,
        asignatura_id: (getField(h, "asignatura_id", "asignatura id") as string | undefined) ?? asigMap.get(norm(getField(h, "asignatura", "materia", "subject"))) ?? null,
        docente_id: (getField(h, "docente_id", "docente id") as string | undefined) ?? docMap.get(norm(getField(h, "docente", "profesor", "teacher"))) ?? null,
        espacio_id: (getField(h, "espacio_id", "espacio id") as string | undefined) ?? espMap.get(norm(getField(h, "espacio", "sala", "space"))) ?? null,
      });
    }
    for (let i = 0; i < rows.length; i += 200) {
      await runQuery("Horarios", () => supabaseAdmin.from("schedule_slots").insert(rows.slice(i, i + 200) as never).select("id"));
    }
    logs.push({ label: "Horarios", ok: true, detail: `${rows.length} celdas importadas${skipped ? ` · ${skipped} omitidas` : ""}` });
  }

  if (payload.pie_plan?.length) {
    const rows: AnyRow[] = [];
    for (const p of payload.pie_plan) {
      const docenteId = (getField(p, "docente_id", "docente id") as string | undefined) ?? docMap.get(norm(getField(p, "docente", "profesor")));
      const dia = dayIndex(getField(p, "dia", "día", "day"));
      const slot = numberField(p, "slot", "bloque", "periodo", "orden");
      if (!docenteId || dia == null || slot == null || Number.isNaN(slot)) continue;
      rows.push({
        colegio_id: colegioId,
        docente_id: docenteId,
        dia,
        slot,
        tipo: pieTipo(getField(p, "tipo", "type")),
        curso_id: (getField(p, "curso_id", "curso id") as string | undefined) ?? cursoMap.get(norm(getField(p, "curso", "course"))) ?? null,
        asignatura_id: (getField(p, "asignatura_id", "asignatura id") as string | undefined) ?? asigMap.get(norm(getField(p, "asignatura", "materia"))) ?? null,
        docente_titular_id: (getField(p, "docente_titular_id", "docente titular id") as string | undefined) ?? docMap.get(norm(getField(p, "docente_titular", "docente titular"))) ?? null,
      });
    }
    if (rows.length) {
      await runQuery("PIE", () => supabaseAdmin.from("pie_plan").insert(rows as never).select("id"));
    }
    logs.push({ label: "Plan PIE", ok: true, detail: `${rows.length} entradas importadas` });
  }

  if (payload.alumnos?.length) {
    const rows: AnyRow[] = [];
    let skipped = 0;
    for (const a of payload.alumnos) {
      const cursoId = (getField(a, "curso_id", "curso id") as string | undefined) ?? cursoMap.get(norm(getField(a, "curso", "course", "clase")));
      const nombres = textField(a, "nombres", "nombre", "first_name", "name");
      const apellidos = textField(a, "apellidos", "apellido", "last_name", "surname");
      if (!cursoId || (!nombres && !apellidos)) { skipped++; continue; }
      rows.push({
        colegio_id: colegioId,
        curso_id: cursoId,
        nombres: nombres || "(sin nombre)",
        apellidos: apellidos || "",
        rut: textField(a, "rut", "run", "dni") || null,
        fecha_nacimiento: textField(a, "fecha_nacimiento", "fecha nacimiento", "nacimiento", "birthdate") || null,
        nivel: textField(a, "nivel") || null,
        apoderado: textField(a, "apoderado", "tutor", "guardian") || null,
        telefono: textField(a, "telefono", "teléfono", "phone") || null,
        numero_lista: numberField(a, "numero_lista", "n° lista", "n lista", "lista", "n"),
      });
    }
    if (replace) {
      await runQuery("Limpiar alumnos", () => supabaseAdmin.from("alumnos").delete().eq("colegio_id", colegioId));
    }
    for (let i = 0; i < rows.length; i += 200) {
      await runQuery("Alumnos", () => supabaseAdmin.from("alumnos").insert(rows.slice(i, i + 200) as never).select("id"));
    }
    logs.push({ label: "Alumnos", ok: true, detail: `${rows.length} importados${skipped ? ` · ${skipped} omitidos` : ""}` });
  }

  return { ok: true, logs };
}
