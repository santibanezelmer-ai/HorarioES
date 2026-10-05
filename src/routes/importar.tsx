import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, FileJson, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "@/lib/auth-context";
import { importSchoolData } from "@/lib/school.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { handleDbError } from "@/lib/db-errors";

export const Route = createFileRoute("/importar")({
  head: () => ({ meta: [{ title: "Importar datos — HorarioES" }] }),
  component: ImportarPage,
});

type AnyRow = Record<string, unknown>;

interface ImportPayload {
  asignaturas?: AnyRow[];
  docentes?: AnyRow[];
  cursos?: AnyRow[];
  bloques?: AnyRow[];
  espacios?: AnyRow[];
  horarios?: AnyRow[]; // schedule_slots
  schedule_slots?: AnyRow[];
  pie_plan?: AnyRow[];
  alumnos?: AnyRow[];
}

interface StepLog {
  label: string;
  ok: boolean;
  detail: string;
}

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

const payloadCount = (payload: ImportPayload) =>
  Object.values(payload).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);

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

const pieTipo = (value: unknown): "aula_recurso" | "acompanamiento" => {
  const n = norm(value);
  return n.includes("recurso") ? "aula_recurso" : "acompanamiento";
};

const deriveNamedRows = (rows: AnyRow[], aliases: string[]) => {
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const nombre = textField(row, ...aliases);
    const key = norm(nombre);
    if (!nombre || seen.has(key)) return [];
    seen.add(key);
    return [{ nombre }];
  });
};

const deriveBloques = (rows: AnyRow[]) => {
  const slots = [...new Set(rows.map((row) => numberField(row, "slot", "bloque", "periodo", "orden")).filter((slot): slot is number => slot != null))];
  return slots.sort((a, b) => a - b).map((slot) => ({ nombre: `Bloque ${slot}`, orden: slot, hora: "08:00", tipo: "clase" }));
};

const classifySheet = (sheetName: string, rows: AnyRow[], fileName = ""): keyof ImportPayload | null => {
  const name = `${keyNorm(sheetName)} ${keyNorm(fileName)}`;
  if (name.includes("alumno") || name.includes("estudiante") || name.includes("student")) return "alumnos";
  if (name.includes("asignatura") || name.includes("subject") || name.includes("materia")) return "asignaturas";
  if (name.includes("docente") || name.includes("profesor") || name.includes("teacher")) return "docentes";
  if (name.includes("horario") || name.includes("schedule") || name.includes("slot")) return "horarios";
  if (name.includes("curso") || name.includes("course") || name.includes("clase")) return "cursos";
  if (name.includes("bloque") || name.includes("periodo") || name.includes("block")) return "bloques";
  if (name.includes("espacio") || name.includes("sala") || name.includes("space")) return "espacios";
  if (name.includes("pie")) return "pie_plan";

  const headers = new Set(rows.flatMap((row) => Object.keys(row).map(keyNorm)));
  const has = (...keys: string[]) => keys.some((key) => headers.has(keyNorm(key)));
  if (has("apellidos", "apellido", "rut", "apoderado") && has("nombres", "nombre")) return "alumnos";
  if (has("dia", "day", "día") && has("curso", "course", "clase")) return "horarios";
  if (has("hora", "duracion", "duración", "tipo") && has("bloque", "periodo", "orden")) return "bloques";
  if (has("nivel", "profesor jefe", "prof_jefe", "profjefe", "prof_jefe_id")) return "cursos";
  if (has("es pie", "es_pie", "espie", "horas utp", "horas_utp", "docente", "profesor") || (has("color", "dias") && has("nombre"))) return "docentes";
  if ((has("ciclos", "ciclo") && has("color")) || has("asignatura", "asignaturas", "materia")) return "asignaturas";
  if (has("espacio", "sala") || (has("color", "tipo") && has("nombre"))) return "espacios";
  return null;
};

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

function ImportarPage() {
  const { profile, session } = useAuth();
  const colegioId = profile?.colegio_id;
  const accessToken = session?.access_token;
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<StepLog[]>([]);
  const [preview, setPreview] = useState<ImportPayload | null>(null);
  const [replace, setReplace] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = () => inputRef.current?.click();

  const onFiles = async (files: FileList | File[]) => {
    setLogs([]);
    setPreview(null);
    try {
      const merged: ImportPayload = {};
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop()?.toLowerCase();
        let payload: ImportPayload = {};
        if (ext === "json") {
          const text = await file.text();
          const raw = JSON.parse(text);
          payload = normalizePayload(raw);
        } else if (ext === "xlsx" || ext === "xls" || ext === "csv") {
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array" });
          for (const sheetName of wb.SheetNames) {
            const rows = XLSX.utils.sheet_to_json<AnyRow>(wb.Sheets[sheetName]);
            const section = classifySheet(sheetName, rows, file.name);
            if (section) payload[section] = [...(payload[section] ?? []), ...rows];
          }
        }
        for (const [key, rows] of Object.entries(payload)) {
          const k = key as keyof ImportPayload;
          if (Array.isArray(rows)) {
            merged[k] = [...(merged[k] ?? []), ...rows];
          }
        }
      }
      if (payloadCount(merged) === 0) {
        toast.error("No encontré hojas o secciones reconocibles para importar.");
        return;
      }
      if (merged.horarios?.length) {
        merged.asignaturas ??= deriveNamedRows(merged.horarios, ["asignatura", "materia", "subject"]);
        merged.docentes ??= deriveNamedRows(merged.horarios, ["docente", "profesor", "teacher"]);
        merged.cursos ??= deriveNamedRows(merged.horarios, ["curso", "course", "clase"]);
        merged.bloques ??= deriveBloques(merged.horarios);
      }
      setPreview(merged);
      toast.success("Archivos procesados correctamente. Revisa el resumen y confirma.");
    } catch (e) {
      console.error("[importar] read file", e);
      toast.error("No se pudo leer el archivo. Verifica el formato e inténtalo de nuevo.");
    }
  };

  const normalizePayload = (raw: unknown): ImportPayload => {
    if (!raw || typeof raw !== "object") return {};
    const r = raw as Record<string, unknown>;
    // Aceptar tanto el JSON "plano" como uno anidado bajo "data"
    const src = (r.data && typeof r.data === "object" ? r.data : r) as Record<string, unknown>;
    const get = (...keys: string[]): AnyRow[] | undefined => {
      const entries = Object.entries(src).map(([key, value]) => [keyNorm(key), value] as const);
      for (const k of keys.map(keyNorm)) {
        const v = entries.find(([key]) => key === k)?.[1];
        if (Array.isArray(v)) return v as AnyRow[];
      }
      return undefined;
    };
    return {
      asignaturas: get("asignaturas", "subjects"),
      docentes: get("docentes", "teachers", "profesores"),
      cursos: get("cursos", "courses", "clases"),
      bloques: get("bloques", "blocks", "periodos"),
      espacios: get("espacios", "spaces", "salas"),
      horarios: get("horarios", "schedule_slots", "slots", "schedule"),
      pie_plan: get("pie_plan", "pie"),
      alumnos: get("alumnos", "estudiantes", "students"),
    };
  };

  const log = (l: StepLog) => setLogs((prev) => [...prev, l]);

  const runImport = async () => {
    if (!preview) return;
    if (!colegioId || !accessToken) {
      toast.error("No se pudo identificar tu colegio. Recarga la página e inténtalo de nuevo.");
      return;
    }
    setBusy(true);
    setLogs([]);

    try {
      const result = await importSchoolData({ data: { accessToken, payload: preview, replace } });
      setLogs(result.logs ?? []);
      toast.success("Importación completada");
      await queryClient.invalidateQueries();
      setPreview(null);
    } catch (e) {
      const friendly = handleDbError(e);
      log({ label: "Error", ok: false, detail: friendly });
      toast.error(friendly);
    } finally {
      setBusy(false);
    }
  };

  const summary = preview ? [
    ["Asignaturas", preview.asignaturas?.length ?? 0],
    ["Docentes", preview.docentes?.length ?? 0],
    ["Cursos", preview.cursos?.length ?? 0],
    ["Bloques", preview.bloques?.length ?? 0],
    ["Espacios", preview.espacios?.length ?? 0],
    ["Horarios", (preview.horarios ?? preview.schedule_slots)?.length ?? 0],
    ["Plan PIE", preview.pie_plan?.length ?? 0],
    ["Alumnos", preview.alumnos?.length ?? 0],
  ] as const : [];

  return (
    <div>
      <PageHeader
        title="Importar datos"
        subtitle="Carga toda tu base anterior desde un archivo JSON o Excel"
      />

      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <div className="flex flex-col items-center text-center py-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-4">
            <Upload className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-semibold">Sube tu archivo</h2>
          <p className="text-sm text-muted-foreground max-w-md mt-1">
            Acepta <span className="font-mono text-xs">.json</span>,{" "}
            <span className="font-mono text-xs">.xlsx</span> o{" "}
            <span className="font-mono text-xs">.csv</span>. Los datos se asocian a tu colegio actual.
          </p>
          <div className="flex gap-2 mt-5">
            <Button onClick={pickFile} disabled={busy}>
              <FileJson className="w-4 h-4 mr-2" /> Elegir archivo
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".json,.xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) onFiles(files);
              e.target.value = "";
            }}
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground mt-6 cursor-pointer">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            Reemplazar datos existentes del colegio antes de importar
          </label>
        </div>
      </div>

      {preview && (
        <div className="bg-surface border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Resumen del archivo</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {summary.map(([label, count]) => (
              <div key={label} className="bg-background border border-border rounded-lg p-3">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={busy}>Cancelar</Button>
            <Button onClick={runImport} disabled={busy}>
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando…</> : "Confirmar importación"}
            </Button>
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Resultado</h3>
          <ul className="space-y-2">
            {logs.map((l, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                {l.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                )}
                <div>
                  <div className="font-medium">{l.label}</div>
                  <div className="text-xs text-muted-foreground">{l.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-surface/50 border border-border rounded-xl p-5 mt-6 text-xs text-muted-foreground leading-relaxed">
        <p className="font-medium text-foreground mb-2">Formato JSON esperado</p>
        <pre className="font-mono bg-background border border-border rounded p-3 overflow-x-auto text-[11px]">{`{
  "asignaturas": [{ "nombre": "Matemática", "color": "#4f8ef7" }],
  "docentes":    [{ "nombre": "María González", "es_pie": false }],
  "cursos":      [{ "nombre": "3°A", "nivel": "1er ciclo", "prof_jefe": "María González" }],
  "bloques":     [{ "nombre": "B1", "hora": "08:00", "tipo": "clase", "orden": 0 }],
  "espacios":    [{ "nombre": "Sala 12", "tipo": "sala" }],
  "horarios":    [{ "curso": "3°A", "dia": "lunes", "slot": 0,
                   "asignatura": "Matemática", "docente": "María González" }]
}`}</pre>
      </div>
    </div>
  );
}
