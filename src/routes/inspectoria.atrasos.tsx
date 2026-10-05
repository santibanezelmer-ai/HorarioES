import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Clock, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/inspectoria/atrasos")({
  head: () => ({ meta: [{ title: "Atrasos y retiros — Inspectoría" }] }),
  component: AtrasosPage,
});

interface Alumno { id: string; nombres: string; apellidos: string; curso_id: string | null }
interface Curso { id: string; nombre: string }
interface Atraso {
  id: string; alumno_id: string; curso_id: string | null; fecha: string;
  hora: string | null; motivo: string | null; justificado: boolean;
}
interface Retiro {
  id: string; alumno_id: string; curso_id: string | null; fecha: string;
  hora: string | null; retirado_por: string | null; motivo: string | null;
}

function AtrasosPage() {
  const { profile, user } = useAuth();
  const colegioId = profile?.colegio_id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<"atrasos" | "retiros">("atrasos");
  const today = new Date().toISOString().slice(0, 10);
  const [fechaFiltro, setFechaFiltro] = useState(today);
  const [showForm, setShowForm] = useState(false);

  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-min", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase.from("cursos").select("id, nombre").eq("colegio_id", colegioId!).order("nombre");
      if (error) throw error;
      return data as Curso[];
    },
  });

  const { data: alumnos = [] } = useQuery({
    queryKey: ["alumnos-all", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase.from("alumnos")
        .select("id, nombres, apellidos, curso_id").eq("colegio_id", colegioId!)
        .is("retirado_en", null).order("apellidos");
      if (error) throw error;
      return data as Alumno[];
    },
  });

  const cursoMap = useMemo(() => Object.fromEntries(cursos.map((c) => [c.id, c])), [cursos]);
  const alumnoMap = useMemo(() => Object.fromEntries(alumnos.map((a) => [a.id, a])), [alumnos]);

  const { data: atrasos = [] } = useQuery({
    queryKey: ["atrasos", colegioId, fechaFiltro], enabled: !!colegioId && tab === "atrasos",
    queryFn: async () => {
      const { data, error } = await supabase.from("atrasos")
        .select("id, alumno_id, curso_id, fecha, hora, motivo, justificado")
        .eq("colegio_id", colegioId!).eq("fecha", fechaFiltro).order("hora", { nullsFirst: false });
      if (error) throw error;
      return data as Atraso[];
    },
  });

  const { data: retiros = [] } = useQuery({
    queryKey: ["retiros", colegioId, fechaFiltro], enabled: !!colegioId && tab === "retiros",
    queryFn: async () => {
      const { data, error } = await supabase.from("retiros")
        .select("id, alumno_id, curso_id, fecha, hora, retirado_por, motivo")
        .eq("colegio_id", colegioId!).eq("fecha", fechaFiltro).order("hora", { nullsFirst: false });
      if (error) throw error;
      return data as Retiro[];
    },
  });

  const createAtraso = useMutation({
    mutationFn: async (p: { alumno_id: string; hora: string; motivo: string }) => {
      const al = alumnoMap[p.alumno_id];
      const { error } = await supabase.from("atrasos").insert({
        colegio_id: colegioId!, alumno_id: p.alumno_id, curso_id: al?.curso_id ?? null,
        fecha: fechaFiltro, hora: p.hora || null, motivo: p.motivo || null,
        registrado_por: user?.id,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["atrasos"] }); setShowForm(false); toast.success("Atraso registrado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createRetiro = useMutation({
    mutationFn: async (p: { alumno_id: string; hora: string; retirado_por: string; motivo: string }) => {
      const al = alumnoMap[p.alumno_id];
      const { error } = await supabase.from("retiros").insert({
        colegio_id: colegioId!, alumno_id: p.alumno_id, curso_id: al?.curso_id ?? null,
        fecha: fechaFiltro, hora: p.hora || null, retirado_por: p.retirado_por || null,
        motivo: p.motivo || null, registrado_por: user?.id,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["retiros"] }); setShowForm(false); toast.success("Retiro registrado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleJustif = useMutation({
    mutationFn: async (a: Atraso) => {
      const { error } = await supabase.from("atrasos").update({ justificado: !a.justificado }).eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["atrasos"] }),
  });

  const remove = useMutation({
    mutationFn: async ({ table, id }: { table: "atrasos" | "retiros"; id: string }) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: [v.table] }),
  });

  return (
    <div>
      <PageHeader
        title="Atrasos y retiros"
        subtitle="Registro diario y seguimiento"
        actions={
          <div className="flex gap-2">
            <input
              type="date" value={fechaFiltro} onChange={(e) => setFechaFiltro(e.target.value)}
              className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm"
            />
            <button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Nuevo
            </button>
          </div>
        }
      />

      <div className="flex gap-1 mb-4 border-b border-border">
        {(["atrasos", "retiros"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            {t === "atrasos" ? <Clock className="w-4 h-4 inline mr-1" /> : <LogOut className="w-4 h-4 inline mr-1" />}
            {t}
          </button>
        ))}
      </div>

      {showForm && (
        <RegistroForm
          tipo={tab} alumnos={alumnos} cursoMap={cursoMap}
          onCancel={() => setShowForm(false)}
          onSubmit={(p) => tab === "atrasos" ? createAtraso.mutate(p as never) : createRetiro.mutate(p as never)}
        />
      )}

      {tab === "atrasos" ? (
        atrasos.length === 0 ? (
          <EmptyState icon={Clock} title="Sin atrasos en esta fecha" description="Registra el primer atraso del día." />
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left px-3 py-2">Hora</th><th className="text-left px-3 py-2">Estudiante</th><th className="text-left px-3 py-2">Curso</th><th className="text-left px-3 py-2">Motivo</th><th className="text-center px-3 py-2">Justif.</th><th></th></tr>
              </thead>
              <tbody>
                {atrasos.map((a) => {
                  const al = alumnoMap[a.alumno_id];
                  return (
                    <tr key={a.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{a.hora?.slice(0,5) ?? "—"}</td>
                      <td className="px-3 py-2">{al ? `${al.apellidos}, ${al.nombres}` : "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{a.curso_id ? cursoMap[a.curso_id]?.nombre : "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{a.motivo ?? "—"}</td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={a.justificado} onChange={() => toggleJustif.mutate(a)} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => remove.mutate({ table: "atrasos", id: a.id })} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        retiros.length === 0 ? (
          <EmptyState icon={LogOut} title="Sin retiros en esta fecha" description="Registra el primer retiro del día." />
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left px-3 py-2">Hora</th><th className="text-left px-3 py-2">Estudiante</th><th className="text-left px-3 py-2">Curso</th><th className="text-left px-3 py-2">Retira</th><th className="text-left px-3 py-2">Motivo</th><th></th></tr>
              </thead>
              <tbody>
                {retiros.map((r) => {
                  const al = alumnoMap[r.alumno_id];
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{r.hora?.slice(0,5) ?? "—"}</td>
                      <td className="px-3 py-2">{al ? `${al.apellidos}, ${al.nombres}` : "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.curso_id ? cursoMap[r.curso_id]?.nombre : "—"}</td>
                      <td className="px-3 py-2">{r.retirado_por ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.motivo ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => remove.mutate({ table: "retiros", id: r.id })} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function RegistroForm({ tipo, alumnos, cursoMap, onCancel, onSubmit }: {
  tipo: "atrasos" | "retiros"; alumnos: Alumno[]; cursoMap: Record<string, Curso>;
  onCancel: () => void; onSubmit: (p: Record<string, string>) => void;
}) {
  const [alumnoId, setAlumnoId] = useState("");
  const [hora, setHora] = useState(new Date().toTimeString().slice(0, 5));
  const [retiradoPor, setRetiradoPor] = useState("");
  const [motivo, setMotivo] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!alumnoId) return;
        const base: Record<string, string> = { alumno_id: alumnoId, hora, motivo };
        if (tipo === "retiros") base.retirado_por = retiradoPor;
        onSubmit(base);
      }}
      className="bg-surface border border-border rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-2"
    >
      <select required value={alumnoId} onChange={(e) => setAlumnoId(e.target.value)} className="md:col-span-2 bg-surface-2 border border-border rounded px-2 py-1.5 text-sm">
        <option value="">— Selecciona estudiante —</option>
        {alumnos.map((a) => (
          <option key={a.id} value={a.id}>
            {a.apellidos}, {a.nombres} {a.curso_id ? `· ${cursoMap[a.curso_id]?.nombre}` : ""}
          </option>
        ))}
      </select>
      <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="bg-surface-2 border border-border rounded px-2 py-1.5 text-sm" />
      {tipo === "retiros" && (
        <input value={retiradoPor} onChange={(e) => setRetiradoPor(e.target.value)} placeholder="Persona que retira" className="bg-surface-2 border border-border rounded px-2 py-1.5 text-sm" />
      )}
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional)" className="md:col-span-4 bg-surface-2 border border-border rounded px-2 py-1.5 text-sm" />
      <div className="md:col-span-4 flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm px-3 py-1.5 rounded border border-border">Cancelar</button>
        <button type="submit" className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground">Registrar</button>
      </div>
    </form>
  );
}
