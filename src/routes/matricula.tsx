import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  Search,
  Filter,
  Download,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  Users,
  Eye,
  FileSpreadsheet,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import type { Matricula, MatriculaEstado } from "@/lib/matricula.types";

export const Route = createFileRoute("/matricula")({
  head: () => ({ meta: [{ title: "Matrícula — HorarioES" }] }),
  component: MatriculaAdminPage,
});

const ESTADO_BADGE: Record<
  MatriculaEstado,
  { label: string; bg: string; text: string; border: string }
> = {
  borrador: {
    label: "Borrador",
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  },
  solicitada: {
    label: "Nueva Solicitud",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    border: "border-blue-500/30",
  },
  en_revision: {
    label: "En Revisión",
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    border: "border-amber-500/30",
  },
  observada: {
    label: "Observada",
    bg: "bg-orange-500/10",
    text: "text-orange-500",
    border: "border-orange-500/30",
  },
  aprobada: {
    label: "Matriculado(a)",
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    border: "border-emerald-500/30",
  },
  rechazada: {
    label: "Rechazada",
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/30",
  },
  retirada: {
    label: "Retirado(a)",
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  },
};

function MatriculaAdminPage() {
  const { profile, user } = useAuth();
  const colegioId = profile?.colegio_id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [cursoFilter, setCursoFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("todas");
  const [approvingMatricula, setApprovingMatricula] = useState<Matricula | null>(null);
  const [selectedCursoId, setSelectedCursoId] = useState("");

  // Periodo activo
  const { data: periodoActivo } = useQuery({
    queryKey: ["periodo-activo", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("periodos_matricula")
        .select("*")
        .eq("colegio_id", colegioId!)
        .eq("activo", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Lista de cursos
  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-matricula", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select("id, nombre, nivel")
        .eq("colegio_id", colegioId!)
        .order("nombre");
      if (error) throw error;
      return data || [];
    },
  });

  // Lista de matrículas
  const { data: matriculas = [], isLoading } = useQuery({
    queryKey: ["matriculas-list", colegioId, periodoActivo?.id],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select(`
          *,
          cursos_postula:curso_postula_id(id, nombre, nivel),
          cursos_asignado:curso_asignado_id(id, nombre, nivel)
        `)
        .eq("colegio_id", colegioId!)
        .order("numero_matricula", { nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Matricula[];
    },
  });

  // Mutación para aprobar matrícula mediante función RPC
  const aprobarMutation = useMutation({
    mutationFn: async ({ matId, cursoId }: { matId: string; cursoId: string }) => {
      const { data, error } = await supabase.rpc("aprobar_matricula", {
        p_matricula_id: matId,
        p_curso_id: cursoId,
        p_revisor_id: user?.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("¡Matrícula aprobada exitosamente y alumno sincronizado!");
      setApprovingMatricula(null);
      queryClient.invalidateQueries({ queryKey: ["matriculas-list"] });
      queryClient.invalidateQueries({ queryKey: ["alumnos-all"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Error al aprobar matrícula");
    },
  });

  // Filtrado
  const filtered = useMemo(() => {
    return matriculas.filter((m) => {
      if (estadoFilter !== "todas" && m.estado !== estadoFilter) return false;
      const cId = m.curso_asignado_id || m.curso_postula_id;
      if (cursoFilter && cId !== cursoFilter) return false;

      if (q.trim()) {
        const term = q.trim().toLowerCase();
        const fullEst = `${m.estudiante_nombres} ${m.estudiante_apellidos}`.toLowerCase();
        const rutEst = (m.estudiante_rut || "").toLowerCase();
        const cod = (m.codigo_seguimiento || "").toLowerCase();
        const apoderado = `${m.apoderado_titular_nombres} ${m.apoderado_titular_apellidos}`.toLowerCase();
        if (
          !fullEst.includes(term) &&
          !rutEst.includes(term) &&
          !cod.includes(term) &&
          !apoderado.includes(term)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [matriculas, estadoFilter, cursoFilter, q]);

  // Contadores estadísticos
  const stats = useMemo(() => {
    const total = matriculas.length;
    const aprobadas = matriculas.filter((m) => m.estado === "aprobada").length;
    const pendientes = matriculas.filter((m) =>
      ["solicitada", "en_revision"].includes(m.estado)
    ).length;
    const observadas = matriculas.filter((m) => m.estado === "observada").length;
    return { total, aprobadas, pendientes, observadas };
  }, [matriculas]);

  // Exportar a CSV (compatible con Excel / SIGE)
  const exportarCSV = () => {
    if (matriculas.length === 0) {
      toast.error("No hay registros para exportar");
      return;
    }

    const headers = [
      "N_Matricula",
      "Estado",
      "Codigo_Seguimiento",
      "RUT_Estudiante",
      "Nombres",
      "Apellidos",
      "Fecha_Nacimiento",
      "Genero",
      "Curso_Asignado",
      "Apoderado_Titular",
      "RUT_Apoderado",
      "Telefono_Apoderado",
      "Email_Apoderado",
      "Direccion",
      "Comuna",
      "PIE",
      "Fecha_Aprobacion",
    ];

    const rows = filtered.map((m) => [
      m.numero_matricula || "",
      m.estado,
      m.codigo_seguimiento,
      m.estudiante_rut || "",
      `"${m.estudiante_nombres}"`,
      `"${m.estudiante_apellidos}"`,
      m.estudiante_fecha_nacimiento || "",
      m.estudiante_genero || "",
      `"${m.cursos_asignado?.nombre || m.cursos_postula?.nombre || ""}"`,
      `"${m.apoderado_titular_nombres} ${m.apoderado_titular_apellidos}"`,
      m.apoderado_titular_rut,
      m.apoderado_titular_telefono,
      m.apoderado_titular_email || "",
      `"${m.estudiante_direccion || ""}"`,
      m.estudiante_comuna || "",
      m.es_pie ? "SI" : "NO",
      m.fecha_aprobacion ? m.fecha_aprobacion.split("T")[0] : "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(";"), ...rows.map((e) => e.join(";"))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `libro_matricula_${periodoActivo?.anio || "2026"}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Libro de matrícula exportado exitosamente");
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Libro Oficial de Matrícula"
        subtitle={`Gestión administrativa de matrículas · Periodo ${
          periodoActivo?.anio || "2026"
        }`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={exportarCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface border border-border hover:bg-surface-2 rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Exportar Libro (Excel)
            </button>
            <Link
              to="/c/$slug/matricula"
              params={{ slug: "porvenir" }}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs shadow-elegant hover:bg-primary/90 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Portal de Apoderados
            </Link>
          </div>
        }
      />

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium mb-1 flex items-center justify-between">
            <span>Matriculados Oficiales</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {stats.aprobadas}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Con número correlativo asignado
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium mb-1 flex items-center justify-between">
            <span>Nuevas Solicitudes</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {stats.pendientes}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Pendientes de revisión
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium mb-1 flex items-center justify-between">
            <span>Observadas / Documentos</span>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {stats.observadas}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Requieren regularización
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium mb-1 flex items-center justify-between">
            <span>Total Fichas Registradas</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {stats.total}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            En periodo escolar activo
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por alumno, RUT, apoderado o código MAT-2026…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <select
          value={cursoFilter}
          onChange={(e) => setCursoFilter(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos los cursos</option>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="todas">Todos los estados</option>
          <option value="solicitada">Nuevas solicitudes</option>
          <option value="en_revision">En revisión</option>
          <option value="aprobada">Matriculados (Aprobadas)</option>
          <option value="observada">Observadas</option>
          <option value="retirada">Retiradas</option>
        </select>
      </div>

      {/* Tabla del Libro de Matrícula */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-12 text-center">
            Cargando libro de matrícula…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No se encontraron registros de matrícula"
            description="Las nuevas solicitudes ingresadas por los apoderados aparecerán aquí para su validación."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2/60 border-b border-border text-muted-foreground uppercase font-bold tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 w-16">N° Mat.</th>
                  <th className="py-3 px-4">Estudiante</th>
                  <th className="py-3 px-4">RUT / IPE</th>
                  <th className="py-3 px-4">Curso</th>
                  <th className="py-3 px-4">Apoderado Titular</th>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((m) => {
                  const estStyle = ESTADO_BADGE[m.estado] || ESTADO_BADGE.solicitada;
                  const cursoNombre =
                    m.cursos_asignado?.nombre || m.cursos_postula?.nombre || "Sin asignar";

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-surface-2/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-primary">
                        {m.numero_matricula ? `#${m.numero_matricula}` : "—"}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        {m.estudiante_apellidos}, {m.estudiante_nombres}
                        {m.es_pie && (
                          <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 border border-purple-500/30">
                            PIE
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground">
                        {m.estudiante_rut || "Sin RUT"}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        {cursoNombre}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        <div className="text-foreground font-medium">
                          {m.apoderado_titular_nombres} {m.apoderado_titular_apellidos}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {m.apoderado_titular_telefono}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">
                        {m.codigo_seguimiento}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${estStyle.bg} ${estStyle.text} ${estStyle.border}`}
                        >
                          {estStyle.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {m.estado !== "aprobada" && (
                            <button
                              onClick={() => {
                                setApprovingMatricula(m);
                                setSelectedCursoId(
                                  m.curso_asignado_id || m.curso_postula_id || cursos[0]?.id || ""
                                );
                              }}
                              title="Aprobar matrícula"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-md font-semibold text-[11px] transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" /> Aprobar
                            </button>
                          )}
                          <Link
                            to="/matricula/$id"
                            params={{ id: m.id }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-2 hover:bg-surface-3 text-foreground rounded-md font-semibold text-[11px] transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver Ficha
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Confirmación de Aprobación */}
      {approvingMatricula && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Aprobar Matrícula Oficial
              </h3>
              <button
                onClick={() => setApprovingMatricula(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Estás a punto de aprobar la matrícula de{" "}
              <strong className="text-foreground">
                {approvingMatricula.estudiante_nombres} {approvingMatricula.estudiante_apellidos}
              </strong>
              . Se le asignará automáticamente el siguiente número correlativo en el libro y se
              sincronizará con la nómina de estudiantes.
            </p>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Curso Definitivo Asignado *
              </label>
              <select
                value={selectedCursoId}
                onChange={(e) => setSelectedCursoId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring font-medium"
              >
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.nivel || "General"})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApprovingMatricula(null)}
                className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={aprobarMutation.isPending || !selectedCursoId}
                onClick={() =>
                  aprobarMutation.mutate({
                    matId: approvingMatricula.id,
                    cursoId: selectedCursoId,
                  })
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {aprobarMutation.isPending ? "Aprobando…" : "Confirmar y Matricular"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
