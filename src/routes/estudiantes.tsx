import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/estudiantes")({
  head: () => ({ meta: [{ title: "Estudiantes — HorarioES" }] }),
  component: EstudiantesPage,
});

interface Alumno {
  id: string;
  nombres: string;
  apellidos: string;
  rut: string | null;
  curso_id: string | null;
  numero_lista: number | null;
  apoderado: string | null;
  telefono: string | null;
  retirado_en: string | null;
}
interface Curso { id: string; nombre: string; nivel: string | null }

function EstudiantesPage() {
  const { profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const [q, setQ] = useState("");
  const [cursoFilter, setCursoFilter] = useState<string>("");

  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-min", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase.from("cursos")
        .select("id, nombre, nivel").eq("colegio_id", colegioId!).order("nombre");
      if (error) throw error;
      return data as Curso[];
    },
  });

  const { data: alumnos = [], isLoading } = useQuery({
    queryKey: ["alumnos-all", colegioId], enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase.from("alumnos")
        .select("id, nombres, apellidos, rut, curso_id, numero_lista, apoderado, telefono, retirado_en")
        .eq("colegio_id", colegioId!)
        .order("numero_lista", { nullsFirst: false })
        .order("apellidos");
      if (error) throw error;
      return data as Alumno[];
    },
  });

  const cursoMap = useMemo(() => Object.fromEntries(cursos.map((c) => [c.id, c])), [cursos]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return alumnos.filter((a) => {
      if (cursoFilter && a.curso_id !== cursoFilter) return false;
      if (!term) return true;
      return (
        a.nombres.toLowerCase().includes(term) ||
        a.apellidos.toLowerCase().includes(term) ||
        (a.rut ?? "").toLowerCase().includes(term)
      );
    });
  }, [alumnos, q, cursoFilter]);

  const totalActivos = alumnos.filter((a) => !a.retirado_en).length;

  return (
    <div>
      <PageHeader
        title="Estudiantes"
        subtitle={`${totalActivos} estudiantes activos · ${alumnos.length} total`}
      />

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, apellido o RUT…"
            className="w-full bg-surface border border-border rounded-md pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={cursoFilter} onChange={(e) => setCursoFilter(e.target.value)}
          className="bg-surface border border-border rounded-md px-3 py-2 text-sm"
        >
          <option value="">Todos los cursos</option>
          {cursos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Sin resultados" description="Ajusta los filtros o crea estudiantes desde Mis cursos." />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">N°</th>
                <th className="text-left px-3 py-2">Apellidos y nombres</th>
                <th className="text-left px-3 py-2">RUT</th>
                <th className="text-left px-3 py-2">Curso</th>
                <th className="text-left px-3 py-2">Apoderado</th>
                <th className="text-left px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const curso = a.curso_id ? cursoMap[a.curso_id] : null;
                return (
                  <tr key={a.id} className="border-t border-border hover:bg-surface-2 cursor-pointer">
                    <td className="px-3 py-2 text-muted-foreground"><Link to="/estudiantes/$id" params={{ id: a.id }} className="block">{a.numero_lista ?? "—"}</Link></td>
                    <td className="px-3 py-2 font-medium"><Link to="/estudiantes/$id" params={{ id: a.id }} className="block hover:text-primary">{a.apellidos}, {a.nombres}</Link></td>
                    <td className="px-3 py-2 text-muted-foreground">{a.rut ?? "—"}</td>
                    <td className="px-3 py-2">{curso?.nombre ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {a.apoderado ?? "—"}{a.telefono ? ` · ${a.telefono}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      {a.retirado_en ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-destructive/10 text-destructive">Retirado</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Activo</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
