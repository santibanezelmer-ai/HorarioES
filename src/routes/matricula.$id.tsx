import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  Clock,
  X,
  Check,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  HeartPulse,
  BookOpen,
  User,
  ShieldCheck,
  FileCheck2,
  Upload,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { printFit } from "@/lib/print";
import type {
  Matricula,
  MatriculaEstado,
  MatriculaDocumento,
} from "@/lib/matricula.types";

export const Route = createFileRoute("/matricula/$id")({
  head: () => ({ meta: [{ title: "Ficha de Matrícula — HorarioES" }] }),
  component: FichaMatriculaAdminPage,
});

const ESTADO_BADGE: Record<
  MatriculaEstado,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  borrador: {
    label: "Borrador",
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
    icon: Clock,
  },
  solicitada: {
    label: "Nueva Solicitud",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    border: "border-blue-500/30",
    icon: Sparkles,
  },
  en_revision: {
    label: "En Revisión",
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    border: "border-amber-500/30",
    icon: Clock,
  },
  observada: {
    label: "Observada",
    bg: "bg-orange-500/10",
    text: "text-orange-500",
    border: "border-orange-500/30",
    icon: AlertTriangle,
  },
  aprobada: {
    label: "Matriculado / Aprobado",
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    border: "border-emerald-500/30",
    icon: CheckCircle2,
  },
  rechazada: {
    label: "Rechazada",
    bg: "bg-rose-500/10",
    text: "text-rose-500",
    border: "border-rose-500/30",
    icon: X,
  },
  retirada: {
    label: "Retirado",
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/30",
    icon: AlertCircle,
  },
};

function FichaMatriculaAdminPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const colegioId = profile?.colegio_id;
  const queryClient = useQueryClient();

  const [obsInterna, setObsInterna] = useState("");
  const [obsModificada, setObsModificada] = useState(false);
  const [isApprovingModalOpen, setIsApprovingModalOpen] = useState(false);
  const [selectedCursoId, setSelectedCursoId] = useState("");
  const [isObservarModalOpen, setIsObservarModalOpen] = useState(false);
  const [motivoObservacion, setMotivoObservacion] = useState("");

  // Cargar registro de matrícula completo
  const {
    data: matricula,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["matricula-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select(
          `
          *,
          cursos_postula:cursos!matriculas_curso_postula_id_fkey(id, nombre, nivel),
          cursos_asignado:cursos!matriculas_curso_asignado_id_fkey(id, nombre, nivel),
          periodos_matricula:periodos_matricula(id, anio, nombre)
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      const mat = data as unknown as Matricula;
      setObsInterna(mat.observaciones_internas || "");
      setSelectedCursoId(
        mat.curso_asignado_id || mat.curso_postula_id || ""
      );
      return mat;
    },
  });

  // Cargar colegio info para la impresión
  const { data: colegioData } = useQuery({
    queryKey: ["colegio-info", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data } = await supabase
        .from("colegios")
        .select("id, nombre, slug, logo_url")
        .eq("id", colegioId!)
        .maybeSingle();
      return data;
    },
  });

  // Cargar documentos asociados a esta matrícula
  const { data: documentos = [], refetch: refetchDocs } = useQuery({
    queryKey: ["matricula-docs", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matricula_documentos")
        .select("*")
        .eq("matricula_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as MatriculaDocumento[];
    },
  });

  // Cursos disponibles para asignar
  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-select", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select("id, nombre, nivel")
        .eq("colegio_id", colegioId!)
        .order("nombre", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Mutación: Guardar observaciones internas
  const mutationObs = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase
        .from("matriculas")
        .update({
          observaciones_internas: text,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Observaciones internas actualizadas");
      setObsModificada(false);
      queryClient.invalidateQueries({ queryKey: ["matricula-detail", id] });
    },
    onError: (err: any) => {
      toast.error(`Error al guardar: ${err.message}`);
    },
  });

  // Mutación: Aprobar Matrícula (RPC atómica)
  const mutationAprobar = useMutation({
    mutationFn: async ({ cursoId }: { cursoId: string }) => {
      const { data, error } = await supabase.rpc("aprobar_matricula", {
        p_matricula_id: id,
        p_curso_id: cursoId,
        p_revisor_id: user?.id || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(
        `¡Matrícula aprobada exitosamente! Asignado N° ${data?.numero_matricula || ""}`
      );
      setIsApprovingModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["matricula-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["matriculas-list"] });
      queryClient.invalidateQueries({ queryKey: ["matriculas-stats"] });
      refetch();
    },
    onError: (err: any) => {
      toast.error(`Error al aprobar matrícula: ${err.message}`);
    },
  });

  // Mutación: Cambiar Estado
  const mutationCambiarEstado = useMutation({
    mutationFn: async ({
      nuevoEstado,
      observacion,
    }: {
      nuevoEstado: MatriculaEstado;
      observacion?: string;
    }) => {
      const updates: any = {
        estado: nuevoEstado,
        updated_at: new Date().toISOString(),
      };
      if (observacion !== undefined) {
        updates.observaciones_internas = observacion;
      }
      const { error } = await supabase
        .from("matriculas")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`Estado cambiado a ${variables.nuevoEstado}`);
      setIsObservarModalOpen(false);
      setMotivoObservacion("");
      queryClient.invalidateQueries({ queryKey: ["matricula-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["matriculas-list"] });
      refetch();
    },
    onError: (err: any) => {
      toast.error(`Error al actualizar estado: ${err.message}`);
    },
  });

  // Mutación: Actualizar estado de documento
  const mutationDocEstado = useMutation({
    mutationFn: async ({
      docId,
      estado,
    }: {
      docId: string;
      estado: "pendiente" | "aprobado" | "rechazado";
    }) => {
      const { error } = await supabase
        .from("matricula_documentos")
        .update({ estado })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado del documento actualizado");
      refetchDocs();
    },
    onError: (err: any) => {
      toast.error(`Error en documento: ${err.message}`);
    },
  });

  const handlePrint = () => {
    printFit("ficha-matricula-print", "portrait");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Cargando ficha oficial de matrícula…</p>
      </div>
    );
  }

  if (!matricula) {
    return (
      <div className="space-y-6">
        <Link
          to="/matricula"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Matrícula
        </Link>
        <div className="text-center py-16 bg-surface border border-border rounded-xl">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold">Ficha no encontrada</h2>
          <p className="text-sm text-muted-foreground mt-1">
            El registro de matrícula solicitado no existe o no tienes permisos para visualizarlo.
          </p>
        </div>
      </div>
    );
  }

  const badge = ESTADO_BADGE[matricula.estado] || ESTADO_BADGE.solicitada;
  const BadgeIcon = badge.icon;
  const cursoActual =
    matricula.cursos_asignado?.nombre ||
    matricula.cursos_postula?.nombre ||
    "Sin curso asignado";

  return (
    <div className="space-y-6 pb-16">
      {/* Barra de navegación superior */}
      <div className="flex items-center justify-between">
        <Link
          to="/matricula"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Libro de Matrícula
        </Link>

        {/* Acciones de Cabecera */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface hover:bg-surface-2 text-foreground border border-border rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Printer className="w-4 h-4 text-primary" /> Imprimir Ficha Oficial
          </button>

          {matricula.estado !== "aprobada" && (
            <button
              onClick={() => setIsApprovingModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" /> Aprobar Matrícula
            </button>
          )}

          {matricula.estado !== "observada" && (
            <button
              onClick={() => setIsObservarModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg text-xs font-semibold transition-all"
            >
              <AlertTriangle className="w-4 h-4" /> Observar
            </button>
          )}

          {matricula.estado === "solicitada" && (
            <button
              onClick={() =>
                mutationCambiarEstado.mutate({ nuevoEstado: "en_revision" })
              }
              className="inline-flex items-center gap-2 px-3 py-2 bg-surface-2 hover:bg-surface-3 text-foreground rounded-lg text-xs font-semibold transition-all"
            >
              <Clock className="w-4 h-4" /> En Revisión
            </button>
          )}
        </div>
      </div>

      {/* Tarjeta de Resumen / Status Banner */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <User className="w-7 h-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                  {matricula.estudiante_apellidos}, {matricula.estudiante_nombres}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                >
                  <BadgeIcon className="w-3.5 h-3.5" />
                  {badge.label}
                </span>
                {matricula.es_pie && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/30">
                    Estudiante PIE
                  </span>
                )}
                {matricula.prioritario_preferente && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/30">
                    Alumno Prioritario SEP
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                <span className="font-mono bg-surface-2 px-2 py-0.5 rounded text-foreground">
                  RUT: {matricula.estudiante_rut || "Sin RUT (IPE)"}
                </span>
                <span>
                  Curso: <strong className="text-foreground">{cursoActual}</strong>
                </span>
                <span>
                  Período:{" "}
                  <strong className="text-foreground">
                    {matricula.periodos_matricula?.nombre || "2026"}
                  </strong>
                </span>
                <span className="font-mono">
                  Seguimiento:{" "}
                  <strong className="text-primary">
                    {matricula.codigo_seguimiento}
                  </strong>
                </span>
                {matricula.numero_matricula && (
                  <span className="font-mono font-bold text-emerald-500">
                    N° Matrícula: #{matricula.numero_matricula}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right text-xs text-muted-foreground border-t md:border-t-0 pt-3 md:pt-0">
            <div>
              Registrado el:{" "}
              <strong className="text-foreground">
                {new Date(matricula.created_at).toLocaleDateString("es-CL", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </strong>
            </div>
            {matricula.fecha_aprobacion && (
              <div className="mt-1 text-emerald-500 font-medium">
                Aprobado el:{" "}
                {new Date(matricula.fecha_aprobacion).toLocaleDateString("es-CL")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid Principal de Datos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda / Central: Ficha Técnica (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Datos Personales del Estudiante */}
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <User className="w-4 h-4 text-primary" />
                1. Antecedentes del Estudiante
              </h3>
              <span className="text-[11px] text-muted-foreground font-mono">
                Identificación Oficial
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Nombres completos</span>
                <span className="font-semibold text-foreground text-sm">
                  {matricula.estudiante_nombres}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Apellidos</span>
                <span className="font-semibold text-foreground text-sm">
                  {matricula.estudiante_apellidos}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">RUN / IPE</span>
                <span className="font-mono font-medium text-foreground">
                  {matricula.estudiante_rut || "No registra"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Fecha de Nacimiento</span>
                <span className="font-medium text-foreground">
                  {matricula.estudiante_fecha_nacimiento || "No especificada"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Sexo / Género</span>
                <span className="font-medium text-foreground capitalize">
                  {matricula.estudiante_genero || "No especificado"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Nacionalidad</span>
                <span className="font-medium text-foreground">
                  {matricula.estudiante_nacionalidad || "Chilena"}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground block text-[11px]">Dirección y Residencia</span>
                <span className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  {matricula.estudiante_direccion || "Sin dirección registrada"}
                  {matricula.estudiante_comuna ? `, ${matricula.estudiante_comuna}` : ""}
                  {matricula.estudiante_region ? ` (${matricula.estudiante_region})` : ""}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Vive con</span>
                <span className="font-medium text-foreground">
                  {matricula.estudiante_vive_con || "Ambos padres / Apoderado"}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Antecedentes Académicos */}
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <BookOpen className="w-4 h-4 text-primary" />
                2. Antecedentes Académicos y Curso
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Curso que Postula</span>
                <span className="font-semibold text-foreground text-sm">
                  {matricula.cursos_postula?.nombre || "No especificado"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Curso Definitivo Asignado</span>
                <span className="font-semibold text-emerald-500 text-sm">
                  {matricula.cursos_asignado?.nombre || "Pendiente de aprobación"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Colegio de Procedencia</span>
                <span className="font-medium text-foreground">
                  {matricula.colegio_procedencia || "Estudiante de continuidad"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">¿Repite Grado?</span>
                <span className="font-medium text-foreground">
                  {matricula.repite_grado ? "Sí (Repitente)" : "No (Promovido)"}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Salud y Programa PIE */}
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <HeartPulse className="w-4 h-4 text-rose-500" />
                3. Salud y Necesidades de Apoyo (PIE)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Previsión de Salud</span>
                <span className="font-medium text-foreground">
                  {matricula.prevision_salud || "FONASA / Sin registrar"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Pertenece a PIE</span>
                <span
                  className={`font-bold ${
                    matricula.es_pie ? "text-purple-500" : "text-muted-foreground"
                  }`}
                >
                  {matricula.es_pie ? "Sí, requiere apoyo PIE" : "No"}
                </span>
              </div>
              {matricula.es_pie && (
                <div className="sm:col-span-2 bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                  <span className="text-purple-600 block text-[11px] font-bold">
                    Diagnóstico / Condición PIE
                  </span>
                  <p className="text-foreground mt-0.5 text-xs font-medium">
                    {matricula.diagnostico_pie || "En evaluación psicopedagógica"}
                  </p>
                </div>
              )}
              <div className="sm:col-span-2">
                <span className="text-muted-foreground block text-[11px]">
                  Alergias / Enfermedades Crónicas
                </span>
                <p className="text-foreground mt-0.5 font-medium">
                  {matricula.alergias_enfermedades || "Ninguna declarada"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground block text-[11px]">
                  Medicamentos habituales / Protocolo de emergencia
                </span>
                <p className="text-foreground mt-0.5 font-medium">
                  {matricula.medicamentos || "Ninguno declarado"}
                </p>
              </div>
            </div>
          </div>

          {/* 4. Apoderados */}
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                4. Apoderados y Contacto
              </h3>
            </div>

            {/* Apoderado Titular */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Apoderado Titular
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-surface-2/40 p-3.5 rounded-lg border border-border">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Nombre Completo</span>
                  <span className="font-semibold text-foreground">
                    {matricula.apoderado_titular_nombres}{" "}
                    {matricula.apoderado_titular_apellidos}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">RUT</span>
                  <span className="font-mono font-medium text-foreground">
                    {matricula.apoderado_titular_rut}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Parentesco</span>
                  <span className="font-medium text-foreground">
                    {matricula.apoderado_titular_parentesco}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Teléfono</span>
                  <span className="font-mono text-foreground">
                    {matricula.apoderado_titular_telefono}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Email</span>
                  <span className="text-foreground">
                    {matricula.apoderado_titular_email || "Sin email"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Ocupación</span>
                  <span className="text-foreground">
                    {matricula.apoderado_titular_ocupacion || "No especificada"}
                  </span>
                </div>
              </div>
            </div>

            {/* Apoderado Suplente */}
            {matricula.apoderado_suplente_nombres && (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Apoderado Suplente (Contacto Secundario)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-surface-2/20 p-3 rounded-lg border border-border">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Nombre Completo</span>
                    <span className="font-medium text-foreground">
                      {matricula.apoderado_suplente_nombres}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">RUT</span>
                    <span className="font-mono text-foreground">
                      {matricula.apoderado_suplente_rut || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Teléfono</span>
                    <span className="font-mono text-foreground">
                      {matricula.apoderado_suplente_telefono || "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Documentos, Notas y Gestión (1 col) */}
        <div className="space-y-6">
          {/* Documentos Adjuntos */}
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <FileCheck2 className="w-4 h-4 text-primary" />
                Documentación ({documentos.length})
              </h3>
            </div>

            {documentos.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No se adjuntaron certificados digitales.
              </p>
            ) : (
              <div className="space-y-3">
                {documentos.map((doc) => {
                  const docColors = {
                    pendiente: "text-amber-500 bg-amber-500/10 border-amber-500/30",
                    aprobado: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
                    rechazado: "text-rose-500 bg-rose-500/10 border-rose-500/30",
                  }[doc.estado];

                  return (
                    <div
                      key={doc.id}
                      className="p-3 bg-surface-2/50 border border-border rounded-lg text-xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-foreground">
                            {doc.tipo_documento}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                            {doc.nombre_archivo}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${docColors}`}
                        >
                          {doc.estado}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/50">
                        <a
                          href={doc.archivo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold"
                        >
                          <Download className="w-3.5 h-3.5" /> Ver / Descargar
                        </a>

                        <div className="flex items-center gap-1">
                          {doc.estado !== "aprobado" && (
                            <button
                              onClick={() =>
                                mutationDocEstado.mutate({
                                  docId: doc.id,
                                  estado: "aprobado",
                                })
                              }
                              title="Aprobar documento"
                              className="p-1 hover:bg-emerald-500/20 text-emerald-500 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {doc.estado !== "rechazado" && (
                            <button
                              onClick={() =>
                                mutationDocEstado.mutate({
                                  docId: doc.id,
                                  estado: "rechazado",
                                })
                              }
                              title="Rechazar documento"
                              className="p-1 hover:bg-rose-500/20 text-rose-500 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Observaciones del Apoderado al Registrarse */}
          {matricula.observaciones_apoderado && (
            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Comentarios del Apoderado
              </h4>
              <p className="text-xs text-foreground bg-surface-2/40 p-3 rounded-lg border border-border italic">
                "{matricula.observaciones_apoderado}"
              </p>
            </div>
          )}

          {/* Notas y Observaciones Internas (Colegio) */}
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Notas y Observaciones Internas
              </h4>
              {obsModificada && (
                <span className="text-[10px] text-amber-500 font-semibold">
                  Cambios sin guardar
                </span>
              )}
            </div>

            <textarea
              value={obsInterna}
              onChange={(e) => {
                setObsInterna(e.target.value);
                setObsModificada(true);
              }}
              rows={4}
              placeholder="Escribe notas de secretaría, verificación de antecedentes, compromisos..."
              className="w-full bg-surface-2 border border-border rounded-lg p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />

            <button
              onClick={() => mutationObs.mutate(obsInterna)}
              disabled={mutationObs.isPending || !obsModificada}
              className="w-full py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg text-xs shadow-sm transition-all disabled:opacity-50"
            >
              {mutationObs.isPending ? "Guardando…" : "Guardar Observaciones"}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: Aprobar Matrícula */}
      {isApprovingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Confirmar Aprobación de Matrícula
              </h3>
              <button
                onClick={() => setIsApprovingModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Al aprobar esta matrícula, el sistema asignará el correlativo oficial{" "}
              <strong>N° de Matrícula</strong> para el período 2026 y registrará
              automáticamente al estudiante en la nómina oficial del curso.
            </p>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-foreground">
                Asignar a Curso Definitivo:
              </label>
              <select
                value={selectedCursoId}
                onChange={(e) => setSelectedCursoId(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              >
                <option value="">Seleccione el curso</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.nivel ? `(${c.nivel})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsApprovingModalOpen(false)}
                className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-foreground rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedCursoId || mutationAprobar.isPending}
                onClick={() =>
                  mutationAprobar.mutate({ cursoId: selectedCursoId })
                }
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {mutationAprobar.isPending ? "Aprobando…" : "Confirmar y Matricular"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Observar Matrícula */}
      {isObservarModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Observar Solicitud de Matrícula
              </h3>
              <button
                onClick={() => setIsObservarModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Ingresa el motivo de la observación (documentos faltantes, corrección de RUT,
              etc.). El apoderado podrá visualizar este estado en el portal público.
            </p>

            <textarea
              value={motivoObservacion}
              onChange={(e) => setMotivoObservacion(e.target.value)}
              rows={4}
              placeholder="Ej: Falta adjuntar el Certificado Anual de Estudios del colegio de procedencia..."
              className="w-full bg-surface-2 border border-border rounded-lg p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsObservarModalOpen(false)}
                className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-foreground rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!motivoObservacion.trim() || mutationCambiarEstado.isPending}
                onClick={() =>
                  mutationCambiarEstado.mutate({
                    nuevoEstado: "observada",
                    observacion: motivoObservacion,
                  })
                }
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold disabled:opacity-50"
              >
                {mutationCambiarEstado.isPending ? "Guardando…" : "Marcar como Observada"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FICHA OFICIAL IMPRIMIBLE (#ficha-matricula-print / #print-area)           */}
      {/* Formato ministerial estricto para impresión escolar chilena              */}
      {/* ========================================================================= */}
      <div
        id="ficha-matricula-print"
        className="hidden print:block text-black bg-white p-8 max-w-[760px] mx-auto text-[10pt] font-sans leading-tight"
        style={{ color: "#000" }}
      >
        {/* Cabecera Oficial */}
        <div className="border-b-2 border-black pb-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8pt] font-bold uppercase tracking-widest text-neutral-600">
                República de Chile — Ministerio de Educación
              </p>
              <h2 className="text-xl font-bold uppercase tracking-tight text-black">
                {colegioData?.nombre || "Establecimiento Educacional"}
              </h2>
              <p className="text-[9pt] text-neutral-800">
                Libro de Matrícula y Registro Escolar Oficial
              </p>
            </div>
            <div className="text-right border border-black p-2 rounded">
              <div className="text-[8pt] uppercase font-bold text-neutral-700">
                N° de Matrícula
              </div>
              <div className="text-lg font-bold font-mono text-black">
                {matricula.numero_matricula ? `#${matricula.numero_matricula}` : "PENDIENTE"}
              </div>
              <div className="text-[7.5pt] font-mono text-neutral-600 mt-0.5">
                Cód: {matricula.codigo_seguimiento}
              </div>
            </div>
          </div>
        </div>

        <div className="text-center font-bold text-sm uppercase underline mb-4">
          Ficha Única de Matrícula — Año Escolar{" "}
          {matricula.periodos_matricula?.anio || 2026}
        </div>

        {/* I. Antecedentes del Estudiante */}
        <div className="mb-4">
          <div className="bg-neutral-200 font-bold px-2 py-1 text-[9pt] border border-black uppercase">
            I. Identificación del Estudiante
          </div>
          <table className="w-full border-collapse border border-black text-[9pt]">
            <tbody>
              <tr>
                <td className="border border-black p-1.5 font-bold w-1/3">Apellidos:</td>
                <td className="border border-black p-1.5" colSpan={3}>
                  {matricula.estudiante_apellidos}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1.5 font-bold">Nombres:</td>
                <td className="border border-black p-1.5" colSpan={3}>
                  {matricula.estudiante_nombres}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1.5 font-bold">RUN / IPE:</td>
                <td className="border border-black p-1.5 font-mono">
                  {matricula.estudiante_rut || "Sin RUN (IPE registrado)"}
                </td>
                <td className="border border-black p-1.5 font-bold w-1/4">F. Nacimiento:</td>
                <td className="border border-black p-1.5">
                  {matricula.estudiante_fecha_nacimiento || "—"}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1.5 font-bold">Sexo / Género:</td>
                <td className="border border-black p-1.5 capitalize">
                  {matricula.estudiante_genero || "—"}
                </td>
                <td className="border border-black p-1.5 font-bold">Nacionalidad:</td>
                <td className="border border-black p-1.5">
                  {matricula.estudiante_nacionalidad || "Chilena"}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1.5 font-bold">Domicilio:</td>
                <td className="border border-black p-1.5" colSpan={3}>
                  {matricula.estudiante_direccion || "—"},{" "}
                  {matricula.estudiante_comuna || ""}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1.5 font-bold">Vive con:</td>
                <td className="border border-black p-1.5" colSpan={3}>
                  {matricula.estudiante_vive_con || "Ambos Padres"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* II. Antecedentes Académicos */}
        <div className="mb-4">
          <div className="bg-neutral-200 font-bold px-2 py-1 text-[9pt] border border-black uppercase">
            II. Antecedentes Académicos
          </div>
          <table className="w-full border-collapse border border-black text-[9pt]">
            <tbody>
              <tr>
                <td className="border border-black p-1.5 font-bold w-1/3">Curso Asignado:</td>
                <td className="border border-black p-1.5 font-bold">
                  {matricula.cursos_asignado?.nombre || matricula.cursos_postula?.nombre}
                </td>
                <td className="border border-black p-1.5 font-bold w-1/4">Repitente:</td>
                <td className="border border-black p-1.5">
                  {matricula.repite_grado ? "SÍ" : "NO"}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1.5 font-bold">Colegio Procedencia:</td>
                <td className="border border-black p-1.5" colSpan={3}>
                  {matricula.colegio_procedencia || "Establecimiento actual (Continuidad)"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* III. Antecedentes de Salud y PIE */}
        <div className="mb-4">
          <div className="bg-neutral-200 font-bold px-2 py-1 text-[9pt] border border-black uppercase">
            III. Antecedentes de Salud y Apoyo Escolar
          </div>
          <table className="w-full border-collapse border border-black text-[9pt]">
            <tbody>
              <tr>
                <td className="border border-black p-1.5 font-bold w-1/3">Previsión Médica:</td>
                <td className="border border-black p-1.5">
                  {matricula.prevision_salud || "FONASA"}
                </td>
                <td className="border border-black p-1.5 font-bold w-1/4">Pertenece a PIE:</td>
                <td className="border border-black p-1.5 font-bold">
                  {matricula.es_pie ? "SÍ" : "NO"}
                </td>
              </tr>
              {matricula.es_pie && (
                <tr>
                  <td className="border border-black p-1.5 font-bold">Diagnóstico PIE:</td>
                  <td className="border border-black p-1.5" colSpan={3}>
                    {matricula.diagnostico_pie || "En proceso de diagnóstico"}
                  </td>
                </tr>
              )}
              <tr>
                <td className="border border-black p-1.5 font-bold">Alergias / Patologías:</td>
                <td className="border border-black p-1.5" colSpan={3}>
                  {matricula.alergias_enfermedades || "Ninguna declarada"}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1.5 font-bold">Medicamentos habituales:</td>
                <td className="border border-black p-1.5" colSpan={3}>
                  {matricula.medicamentos || "Ninguno declarado"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* IV. Datos de los Apoderados */}
        <div className="mb-4">
          <div className="bg-neutral-200 font-bold px-2 py-1 text-[9pt] border border-black uppercase">
            IV. Identificación de Apoderados
          </div>
          <table className="w-full border-collapse border border-black text-[9pt]">
            <tbody>
              <tr>
                <td className="border border-black p-1.5 font-bold w-1/3">Apoderado Titular:</td>
                <td className="border border-black p-1.5" colSpan={3}>
                  {matricula.apoderado_titular_nombres} {matricula.apoderado_titular_apellidos}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1.5 font-bold">RUN Titular:</td>
                <td className="border border-black p-1.5 font-mono">
                  {matricula.apoderado_titular_rut}
                </td>
                <td className="border border-black p-1.5 font-bold w-1/4">Parentesco:</td>
                <td className="border border-black p-1.5">
                  {matricula.apoderado_titular_parentesco}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1.5 font-bold">Teléfono de Contacto:</td>
                <td className="border border-black p-1.5 font-mono">
                  {matricula.apoderado_titular_telefono}
                </td>
                <td className="border border-black p-1.5 font-bold">Correo Electrónico:</td>
                <td className="border border-black p-1.5">
                  {matricula.apoderado_titular_email || "—"}
                </td>
              </tr>
              {matricula.apoderado_suplente_nombres && (
                <>
                  <tr>
                    <td className="border border-black p-1.5 font-bold">Apoderado Suplente:</td>
                    <td className="border border-black p-1.5" colSpan={3}>
                      {matricula.apoderado_suplente_nombres} (
                      {matricula.apoderado_suplente_parentesco || "Suplente"}) — Fono:{" "}
                      {matricula.apoderado_suplente_telefono || "—"}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* V. Declaración y Compromiso */}
        <div className="border border-black p-2.5 text-[8pt] text-justify mb-8 leading-snug">
          <strong>DECLARACIÓN JURADA Y COMPROMISO:</strong> El apoderado que suscribe declara bajo
          juramento que todos los datos contenidos en el presente documento son fidedignos y
          actualizados. Asimismo, declara tomar conocimiento y aceptar el Proyecto Educativo
          Institucional (PEI) y el Reglamento Interno de Convivencia Escolar (RICE), comprometiéndose
          a velar por la asistencia regular, puntualidad y cumplimiento escolar del estudiante.
        </div>

        {/* Cuadro de Firmas */}
        <div className="grid grid-cols-2 gap-12 pt-8 text-center text-[9pt]">
          <div className="border-t border-black pt-2">
            <p className="font-bold">
              {matricula.apoderado_titular_nombres} {matricula.apoderado_titular_apellidos}
            </p>
            <p className="font-mono text-[8pt]">RUN: {matricula.apoderado_titular_rut}</p>
            <p className="text-[8pt] text-neutral-600">Firma Apoderado Titular</p>
          </div>
          <div className="border-t border-black pt-2">
            <p className="font-bold">Dirección / Encargado de Matrícula</p>
            <p className="text-[8pt] text-neutral-600">
              {colegioData?.nombre || "Establecimiento Educacional"}
            </p>
            <p className="text-[8pt] text-neutral-600">Firma y Timbre Oficial</p>
          </div>
        </div>

        <div className="text-center text-[7pt] text-neutral-500 mt-6 pt-2 border-t border-neutral-300">
          Documento generado por HorarioES — Fecha de emisión:{" "}
          {new Date().toLocaleDateString("es-CL")} {new Date().toLocaleTimeString("es-CL")}
        </div>
      </div>
    </div>
  );
}
