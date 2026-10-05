import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/inspectoria/convivencia")({
  head: () => ({ meta: [{ title: "Convivencia — Inspectoría" }] }),
  component: ConvivenciaPage,
});

interface Alumno { id: string; nombres: string; apellidos: string; curso_id: string | null }
interface Curso { id: string; nombre: string }
interface Anotacion {
  id: string; alumno_id: string; curso_id: string | null; fecha: string;
  tipo: "positiva" | "neutra" | "negativa"; categoria: string | null; descripcion: string;
}

const TIPO_STYLE: Record<string, string> = {
  positiva: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  neutra: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
  negativa: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

function ConvivenciaPage() {
  const { profile, user } = useAuth();
  const colegioId = profile?.colegio_id;
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [tipoFilter, setTipoFilter] = useState<string>("");
  const [cursoFilter, setCursoFilter] = useState<string>("");

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

  const { data: anotaciones = [], isLoading } = useQuery({
    queryKey: ["anotaciones", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase.from("anotaciones")
        .select("id, alumno_id, curso_id, fecha, tipo, categoria, descripcion")
        .eq("colegio_id", colegioId!).order("fecha", { ascending: false }).limit(500);
      if (error) throw error;
      return data as Anotacion[];
    },
  });

  const filtered = useMemo(() => anotaciones.filter((a) =>
    (!tipoFilter || a.tipo === tipoFilter) && (!cursoFilter || a.curso_id === cursoFilter)
  ), [anotaciones, tipoFilter, cursoFilter]);

  const create = useMutation({
    mutationFn: async (p: { alumno_id: string; tipo: string; categoria: string; descripcion: string }) => {
      const al = alumnoMap[p.alumno_id];
      const { error } = await supabase.from("anotaciones").insert({
        colegio_id: colegioId!, alumno_id: p.alumno_id, curso_id: al?.curso_id ?? null,
        tipo: p.tipo, categoria: p.categoria || null, descripcion: p.descripcion,
        registrado_por: user?.id,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["anotaciones"] }); setShowForm(false); toast.success("Anotación registrada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("anotaciones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["anotaciones"] }),
  });

  const counts = useMemo(() => ({
    positiva: anotaciones.filter((a) => a.tipo === "positiva").length,
    neutra: anotaciones.filter((a) => a.tipo === "neutra").length,
    negativa: anotaciones.filter((a) => a.tipo === "negativa").length,
  }), [anotaciones]);

  return (
    <div>
      <PageHeader
        title="Convivencia escolar"
        subtitle="Anotaciones positivas, neutras y negativas"
        actions={
          <button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Nueva anotación
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        {(["positiva", "neutra", "negativa"] as const).map((t) => (
          <div key={t} className={`border rounded-lg p-3 ${TIPO_STYLE[t]}`}>
            <div className="text-xs uppercase">{t}</div>
            <div className="text-2xl font-bold">{counts[t]}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)} className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm">
          <option value="">Todos los tipos</option>
          <option value="positiva">Positivas</option>
          <option value="neutra">Neutras</option>
          <option value="negativa">Negativas</option>
        </select>
        <select value={cursoFilter} onChange={(e) => setCursoFilter(e.target.value)} className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm">
          <option value="">Todos los cursos</option>
          {cursos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {showForm && (
        <AnotacionForm alumnos={alumnos} cursoMap={cursoMap} onCancel={() => setShowForm(false)} onSubmit={(p) => create.mutate(p)} />
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Sin anotaciones" description="Registra la primera anotación de convivencia." />
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const al = alumnoMap[a.alumno_id];
            return (
              <div key={a.id} className={`border rounded-lg p-3 ${TIPO_STYLE[a.tipo]}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-semibold">{al ? `${al.apellidos}, ${al.nombres}` : "—"}</span>
                      {a.curso_id && <span className="text-muted-foreground">· {cursoMap[a.curso_id]?.nombre}</span>}
                      <span className="text-muted-foreground">· {new Date(a.fecha).toLocaleDateString()}</span>
                      {a.categoria && <span className="px-1.5 py-0.5 rounded bg-surface text-foreground text-[10px]">{a.categoria}</span>}
                    </div>
                    <p className="text-sm mt-1 text-foreground">{a.descripcion}</p>
                  </div>
                  <button onClick={() => remove.mutate(a.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnotacionForm({ alumnos, cursoMap, onCancel, onSubmit }: {
  alumnos: Alumno[]; cursoMap: Record<string, Curso>;
  onCancel: () => void;
  onSubmit: (p: { alumno_id: string; tipo: string; categoria: string; descripcion: string }) => void;
}) {
  const [alumnoId, setAlumnoId] = useState("");
  const [tipo, setTipo] = useState("neutra");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!alumnoId || !descripcion) return; onSubmit({ alumno_id: alumnoId, tipo, categoria, descripcion }); }}
      className="bg-surface border border-border rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-6 gap-2"
    >
      <select required value={alumnoId} onChange={(e) => setAlumnoId(e.target.value)} className="md:col-span-3 bg-surface-2 border border-border rounded px-2 py-1.5 text-sm">
        <option value="">— Selecciona estudiante —</option>
        {alumnos.map((a) => (
          <option key={a.id} value={a.id}>
            {a.apellidos}, {a.nombres} {a.curso_id ? `· ${cursoMap[a.curso_id]?.nombre}` : ""}
          </option>
        ))}
      </select>
      <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="bg-surface-2 border border-border rounded px-2 py-1.5 text-sm">
        <option value="positiva">Positiva</option>
        <option value="neutra">Neutra</option>
        <option value="negativa">Negativa</option>
      </select>
      <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Categoría" className="md:col-span-2 bg-surface-2 border border-border rounded px-2 py-1.5 text-sm" />
      <textarea required value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción de la anotación" className="md:col-span-6 bg-surface-2 border border-border rounded px-2 py-1.5 text-sm" rows={3} />
      <div className="md:col-span-6 flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm px-3 py-1.5 rounded border border-border">Cancelar</button>
        <button type="submit" className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground">Registrar</button>
      </div>
    </form>
  );
}
