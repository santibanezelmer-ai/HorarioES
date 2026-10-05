import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, BookMarked, Target } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useUserRoles } from "@/lib/use-role";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/curriculum/unidades")({
  head: () => ({ meta: [{ title: "Unidades y OA — Currículum" }] }),
  component: UnidadesPage,
});

interface Asignatura { id: string; nombre: string; color: string }
interface Unidad {
  id: string; asignatura_id: string; nivel: string | null;
  numero: number | null; titulo: string; descripcion: string | null;
  fecha_inicio: string | null; fecha_fin: string | null;
}
interface OA {
  id: string; unidad_id: string | null; asignatura_id: string;
  nivel: string | null; codigo: string | null; descripcion: string;
}

const PRIV = ["admin","utp","editor","superadmin"];

function UnidadesPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const { data: roles = [] } = useUserRoles();
  const canEdit = roles.some((r) => PRIV.includes(r));
  const qc = useQueryClient();

  const [asigFilter, setAsigFilter] = useState<string>("");
  const [showUnidadForm, setShowUnidadForm] = useState(false);
  const [showOAForm, setShowOAForm] = useState<string | null>(null); // unidad_id or "free"

  const { data: asignaturas = [] } = useQuery({
    queryKey: ["asignaturas-min", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase.from("asignaturas")
        .select("id, nombre, color").eq("colegio_id", colegioId!).order("nombre");
      if (error) throw error;
      return data as Asignatura[];
    },
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["unidades", colegioId, asigFilter], enabled: !!colegioId,
    queryFn: async () => {
      let q = supabase.from("unidades_curriculares")
        .select("id, asignatura_id, nivel, numero, titulo, descripcion, fecha_inicio, fecha_fin")
        .eq("colegio_id", colegioId!);
      if (asigFilter) q = q.eq("asignatura_id", asigFilter);
      const { data, error } = await q.order("numero", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Unidad[];
    },
  });

  const { data: oas = [] } = useQuery({
    queryKey: ["oas", colegioId, asigFilter], enabled: !!colegioId,
    queryFn: async () => {
      let q = supabase.from("objetivos_aprendizaje")
        .select("id, unidad_id, asignatura_id, nivel, codigo, descripcion")
        .eq("colegio_id", colegioId!);
      if (asigFilter) q = q.eq("asignatura_id", asigFilter);
      const { data, error } = await q.order("codigo", { nullsFirst: false });
      if (error) throw error;
      return data as OA[];
    },
  });

  const asigMap = useMemo(() => Object.fromEntries(asignaturas.map((a) => [a.id, a])), [asignaturas]);
  const oasByUnidad = useMemo(() => {
    const m: Record<string, OA[]> = {};
    for (const o of oas) {
      const k = o.unidad_id ?? "_libres";
      (m[k] ??= []).push(o);
    }
    return m;
  }, [oas]);

  const createUnidad = useMutation({
    mutationFn: async (payload: Partial<Unidad>) => {
      const { error } = await supabase.from("unidades_curriculares")
        .insert({ ...payload, colegio_id: colegioId! } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["unidades"] }); setShowUnidadForm(false); toast.success("Unidad creada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUnidad = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("unidades_curriculares").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["unidades"] }),
  });

  const createOA = useMutation({
    mutationFn: async (payload: Partial<OA>) => {
      const { error } = await supabase.from("objetivos_aprendizaje")
        .insert({ ...payload, colegio_id: colegioId! } as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["oas"] }); setShowOAForm(null); toast.success("OA creado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteOA = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("objetivos_aprendizaje").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["oas"] }),
  });

  return (
    <div>
      <PageHeader
        title="Unidades y Objetivos de Aprendizaje"
        subtitle="Estructura curricular por asignatura"
        actions={canEdit && (
          <button
            onClick={() => setShowUnidadForm(true)}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Nueva unidad
          </button>
        )}
      />

      <div className="mb-4">
        <select
          value={asigFilter} onChange={(e) => setAsigFilter(e.target.value)}
          className="bg-surface border border-border rounded-md px-3 py-2 text-sm"
        >
          <option value="">Todas las asignaturas</option>
          {asignaturas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
      </div>

      {showUnidadForm && canEdit && (
        <UnidadForm
          asignaturas={asignaturas}
          onCancel={() => setShowUnidadForm(false)}
          onSubmit={(p) => createUnidad.mutate(p)}
        />
      )}

      {unidades.length === 0 ? (
        <EmptyState icon={BookMarked} title="Sin unidades" description="Crea la primera unidad curricular." />
      ) : (
        <div className="space-y-3">
          {unidades.map((u) => {
            const asig = asigMap[u.asignatura_id];
            const uoas = oasByUnidad[u.id] ?? [];
            return (
              <div key={u.id} className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-start gap-3 border-b border-border" style={{ borderLeft: `4px solid ${asig?.color ?? "#999"}` }}>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{asig?.nombre} {u.nivel && `· ${u.nivel}`}</div>
                    <div className="font-semibold text-sm">
                      {u.numero != null && <span className="text-muted-foreground mr-1">U{u.numero}.</span>}
                      {u.titulo}
                    </div>
                    {u.descripcion && <p className="text-xs text-muted-foreground mt-1">{u.descripcion}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowOAForm(u.id)}
                        className="text-xs px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 flex items-center gap-1"
                      >
                        <Target className="w-3.5 h-3.5" /> OA
                      </button>
                      <button
                        onClick={() => confirm("¿Eliminar unidad?") && deleteUnidad.mutate(u.id)}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="px-4 py-2 space-y-1">
                  {uoas.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-1">Sin OA registrados</div>
                  ) : uoas.map((o) => (
                    <div key={o.id} className="flex items-start gap-2 text-xs py-1">
                      <span className="font-mono text-primary shrink-0">{o.codigo ?? "—"}</span>
                      <span className="flex-1">{o.descripcion}</span>
                      {canEdit && (
                        <button onClick={() => deleteOA.mutate(o.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {showOAForm === u.id && (
                    <OAForm
                      unidad={u}
                      onCancel={() => setShowOAForm(null)}
                      onSubmit={(p) => createOA.mutate({ ...p, unidad_id: u.id, asignatura_id: u.asignatura_id, nivel: u.nivel })}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UnidadForm({ asignaturas, onCancel, onSubmit }: {
  asignaturas: Asignatura[]; onCancel: () => void;
  onSubmit: (p: Partial<Unidad>) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [asignaturaId, setAsignaturaId] = useState(asignaturas[0]?.id ?? "");
  const [numero, setNumero] = useState<string>("");
  const [nivel, setNivel] = useState("");
  const [descripcion, setDescripcion] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!titulo || !asignaturaId) return;
        onSubmit({
          titulo, asignatura_id: asignaturaId,
          numero: numero ? Number(numero) : null,
          nivel: nivel || null, descripcion: descripcion || null,
        });
      }}
      className="bg-surface border border-border rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-6 gap-2"
    >
      <select required value={asignaturaId} onChange={(e) => setAsignaturaId(e.target.value)} className="md:col-span-2 bg-surface-2 border border-border rounded px-2 py-1.5 text-sm">
        {asignaturas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
      </select>
      <input value={numero} onChange={(e) => setNumero(e.target.value)} type="number" placeholder="N°" className="bg-surface-2 border border-border rounded px-2 py-1.5 text-sm" />
      <input value={nivel} onChange={(e) => setNivel(e.target.value)} placeholder="Nivel" className="bg-surface-2 border border-border rounded px-2 py-1.5 text-sm" />
      <input required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" className="md:col-span-2 bg-surface-2 border border-border rounded px-2 py-1.5 text-sm" />
      <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción (opcional)" className="md:col-span-6 bg-surface-2 border border-border rounded px-2 py-1.5 text-sm" rows={2} />
      <div className="md:col-span-6 flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm px-3 py-1.5 rounded border border-border">Cancelar</button>
        <button type="submit" className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground">Guardar</button>
      </div>
    </form>
  );
}

function OAForm({ unidad, onCancel, onSubmit }: {
  unidad: Unidad; onCancel: () => void;
  onSubmit: (p: Partial<OA>) => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  void unidad;
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!descripcion) return; onSubmit({ codigo: codigo || null, descripcion }); }}
      className="flex flex-col md:flex-row gap-2 mt-2 pt-2 border-t border-border"
    >
      <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="OA01" className="md:w-24 bg-surface-2 border border-border rounded px-2 py-1.5 text-xs font-mono" />
      <input required value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción del OA" className="flex-1 bg-surface-2 border border-border rounded px-2 py-1.5 text-xs" />
      <div className="flex gap-1">
        <button type="button" onClick={onCancel} className="text-xs px-2 py-1.5 rounded border border-border">Cancelar</button>
        <button type="submit" className="text-xs px-2 py-1.5 rounded bg-primary text-primary-foreground">Añadir OA</button>
      </div>
    </form>
  );
}
