import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  GraduationCap,
  ClipboardCheck,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  FileText,
  User,
  ShieldCheck,
  HeartPulse,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Printer,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Calendar,
  X,
  FileCheck2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getColegioBySlug } from "@/lib/tenant.functions";
import { validateRut, formatRut } from "@/lib/rut";
import type { MatriculaEstado, Matricula } from "@/lib/matricula.types";

export const Route = createFileRoute("/c/$slug/matricula")({
  head: () => ({ meta: [{ title: "Portal de Matrícula — HorarioES" }] }),
  component: PublicMatriculaPortal,
});

const ESTADO_INFO: Record<
  MatriculaEstado,
  { label: string; desc: string; bg: string; text: string; border: string; icon: any }
> = {
  borrador: {
    label: "Borrador",
    desc: "La solicitud aún no ha sido enviada al establecimiento.",
    bg: "bg-neutral-500/10",
    text: "text-neutral-500",
    border: "border-neutral-500/30",
    icon: Clock,
  },
  solicitada: {
    label: "Solicitud Recibida",
    desc: "Tu solicitud ha sido ingresada con éxito y está en lista de espera para revisión administrativa.",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    border: "border-blue-500/30",
    icon: Sparkles,
  },
  en_revision: {
    label: "En Revisión por Secretaría",
    desc: "El equipo directivo y secretaría están verificando los antecedentes y documentación.",
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    border: "border-amber-500/30",
    icon: Clock,
  },
  observada: {
    label: "Solicitud Observada",
    desc: "Se requiere subsanar información o aportar documentos adicionales según se detalla a continuación.",
    bg: "bg-orange-500/10",
    text: "text-orange-500",
    border: "border-orange-500/30",
    icon: AlertTriangle,
  },
  aprobada: {
    label: "¡Matrícula Aprobada y Oficializada!",
    desc: "El estudiante se encuentra formalmente matriculado e inscrito en los registros oficiales del establecimiento.",
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    border: "border-emerald-500/30",
    icon: CheckCircle2,
  },
  rechazada: {
    label: "Solicitud No Aceptada",
    desc: "La solicitud no pudo ser aprobada por falta de cupos o incumplimiento de requisitos.",
    bg: "bg-rose-500/10",
    text: "text-rose-500",
    border: "border-rose-500/30",
    icon: X,
  },
  retirada: {
    label: "Matrícula Retirada",
    desc: "El estudiante ha sido dado de baja o retirado a petición del apoderado.",
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/30",
    icon: Info,
  },
};

function PublicMatriculaPortal() {
  const { slug } = useParams({ from: "/c/$slug/matricula" });
  const [activeTab, setActiveTab] = useState<"formulario" | "seguimiento">("formulario");

  // Consulta de seguimiento
  const [trackingCodeInput, setTrackingCodeInput] = useState("");
  const [searchTriggeredCode, setSearchTriggeredCode] = useState<string | null>(null);

  // Formulario multi-pasos (1 a 4)
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);
  const [successMatricula, setSuccessMatricula] = useState<any | null>(null);
  const [hpField, setHpField] = useState("");

  // Datos del Formulario
  const [formData, setFormData] = useState({
    // Estudiante
    estudiante_nombres: "",
    estudiante_apellidos: "",
    estudiante_rut: "",
    estudiante_fecha_nacimiento: "",
    estudiante_genero: "femenino",
    estudiante_nacionalidad: "Chilena",
    estudiante_direccion: "",
    estudiante_comuna: "",
    estudiante_region: "Región Metropolitana",
    estudiante_vive_con: "Ambos padres",

    // Salud & PIE
    prevision_salud: "FONASA",
    es_pie: false,
    diagnostico_pie: "",
    alergias_enfermedades: "",
    medicamentos: "",

    // Académico
    curso_postula_id: "",
    colegio_procedencia: "",
    repite_grado: false,
    prioritario_preferente: false,

    // Apoderado Titular
    apoderado_titular_nombres: "",
    apoderado_titular_apellidos: "",
    apoderado_titular_rut: "",
    apoderado_titular_parentesco: "Madre",
    apoderado_titular_telefono: "",
    apoderado_titular_email: "",
    apoderado_titular_direccion: "",
    apoderado_titular_nivel_estudios: "Educación Media Completa",
    apoderado_titular_ocupacion: "",

    // Apoderado Suplente
    apoderado_suplente_nombres: "",
    apoderado_suplente_rut: "",
    apoderado_suplente_telefono: "",
    apoderado_suplente_parentesco: "Padre",
    apoderado_suplente_email: "",

    // Observaciones
    observaciones_apoderado: "",
  });

  // Archivos adjuntos
  const [filesToUpload, setFilesToUpload] = useState<{
    nacimiento: File | null;
    notas: File | null;
    salud: File | null;
  }>({
    nacimiento: null,
    notas: null,
    salud: null,
  });

  // 1. Cargar colegio por slug
  const { data: colegio, isLoading: loadingColegio } = useQuery({
    queryKey: ["colegio-slug", slug],
    queryFn: () => getColegioBySlug({ data: { slug } }),
  });

  const colegioId = colegio?.id;

  // 2. Cargar período de matrícula activo del colegio
  const { data: periodoActivo } = useQuery({
    queryKey: ["periodo-activo", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data } = await supabase
        .from("periodos_matricula")
        .select("*")
        .eq("colegio_id", colegioId!)
        .eq("activo", true)
        .order("anio", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // 3. Cursos del colegio
  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-publicos", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data } = await supabase
        .from("cursos")
        .select("id, nombre, nivel")
        .eq("colegio_id", colegioId!)
        .order("nombre", { ascending: true });
      return data || [];
    },
  });

  // 4. Búsqueda de seguimiento por código o RUT
  const { data: trackingResult, isLoading: loadingTracking, refetch: refetchTracking } = useQuery({
    queryKey: ["tracking-matricula", searchTriggeredCode],
    enabled: !!searchTriggeredCode,
    queryFn: async () => {
      const code = searchTriggeredCode!.trim();

      // 1. Intentar consulta RPC protegida (sin exponer la tabla completa)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "consultar_seguimiento_matricula",
          {
            p_codigo: code,
            p_rut: code,
          }
        );

        if (!rpcError && rpcData) {
          return {
            id: rpcData.id,
            codigo_seguimiento: rpcData.codigo_seguimiento,
            estado: rpcData.estado,
            numero_matricula: rpcData.numero_matricula,
            estudiante_nombres: rpcData.estudiante_nombres,
            estudiante_apellidos: rpcData.estudiante_apellidos,
            estudiante_rut: rpcData.estudiante_rut,
            cursos_postula: rpcData.curso_postula_nombre ? { nombre: rpcData.curso_postula_nombre } : null,
            cursos_asignado: rpcData.curso_asignado_nombre ? { nombre: rpcData.curso_asignado_nombre } : null,
            apoderado_titular_nombres: rpcData.apoderado_titular_nombre,
            apoderado_titular_apellidos: "",
            observaciones_internas: rpcData.observaciones_colegio,
            created_at: rpcData.created_at,
          } as any;
        }
      } catch (e) {
        // Fallback si la función aún no fue creada
      }

      // 2. Consulta de respaldo con filtrado específico
      let query = supabase
        .from("matriculas")
        .select(
          `
          *,
          cursos_postula:cursos!matriculas_curso_postula_id_fkey(id, nombre),
          cursos_asignado:cursos!matriculas_curso_asignado_id_fkey(id, nombre),
          periodos_matricula:periodos_matricula(id, anio, nombre)
        `
        )
        .or(`codigo_seguimiento.ilike.${code},estudiante_rut.eq.${code}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data, error } = await query;
      if (error) throw error;
      return data as (Matricula & { [k: string]: any }) | null;
    },
  });

  // Mutación: Enviar solicitud de matrícula
  const mutationSubmit = useMutation({
    mutationFn: async () => {
      // Bloqueo silencioso de bots mediante honeypot
      if (hpField.trim() !== "") {
        console.warn("Spam bot request deflected");
        return {
          id: "bot",
          estudiante_nombres: formData.estudiante_nombres,
          estudiante_apellidos: formData.estudiante_apellidos,
          codigo_seguimiento: "MAT-2026-OK",
        };
      }

      if (!colegioId) throw new Error("Colegio no encontrado");
      if (!periodoActivo) {
        throw new Error(
          "El período de matrícula no se encuentra habilitado en este establecimiento actualmente."
        );
      }
      if (!formData.estudiante_nombres.trim() || !formData.estudiante_apellidos.trim()) {
        throw new Error("Por favor completa los nombres y apellidos del estudiante.");
      }
      if (!formData.apoderado_titular_nombres.trim() || !formData.apoderado_titular_telefono.trim()) {
        throw new Error("Por favor completa los datos de contacto del apoderado titular.");
      }

      // Formateo y limpieza de RUTs
      const cleanRutEst = formData.estudiante_rut.trim()
        ? formatRut(formData.estudiante_rut.trim())
        : null;
      const cleanRutApo = formatRut(formData.apoderado_titular_rut.trim());
      const cleanRutSup = formData.apoderado_suplente_rut.trim()
        ? formatRut(formData.apoderado_suplente_rut.trim())
        : null;

      // 1. Insertar registro en matriculas
      const insertData = {
        colegio_id: colegioId,
        periodo_id: periodoActivo.id,
        curso_postula_id: formData.curso_postula_id || null,
        estado: "solicitada" as MatriculaEstado,

        estudiante_nombres: formData.estudiante_nombres.trim(),
        estudiante_apellidos: formData.estudiante_apellidos.trim(),
        estudiante_rut: cleanRutEst,
        estudiante_fecha_nacimiento: formData.estudiante_fecha_nacimiento || null,
        estudiante_genero: formData.estudiante_genero,
        estudiante_nacionalidad: formData.estudiante_nacionalidad,
        estudiante_direccion: formData.estudiante_direccion.trim() || null,
        estudiante_comuna: formData.estudiante_comuna.trim() || null,
        estudiante_region: formData.estudiante_region,
        estudiante_vive_con: formData.estudiante_vive_con,

        prevision_salud: formData.prevision_salud,
        es_pie: formData.es_pie,
        diagnostico_pie: formData.es_pie ? formData.diagnostico_pie.trim() || null : null,
        alergias_enfermedades: formData.alergias_enfermedades.trim() || null,
        medicamentos: formData.medicamentos.trim() || null,

        apoderado_titular_nombres: formData.apoderado_titular_nombres.trim(),
        apoderado_titular_apellidos: formData.apoderado_titular_apellidos.trim(),
        apoderado_titular_rut: cleanRutApo,
        apoderado_titular_parentesco: formData.apoderado_titular_parentesco,
        apoderado_titular_telefono: formData.apoderado_titular_telefono.trim(),
        apoderado_titular_email: formData.apoderado_titular_email.trim() || null,
        apoderado_titular_direccion: formData.apoderado_titular_direccion.trim() || null,
        apoderado_titular_nivel_estudios: formData.apoderado_titular_nivel_estudios,
        apoderado_titular_ocupacion: formData.apoderado_titular_ocupacion.trim() || null,

        apoderado_suplente_nombres: formData.apoderado_suplente_nombres.trim() || null,
        apoderado_suplente_rut: cleanRutSup,
        apoderado_suplente_telefono: formData.apoderado_suplente_telefono.trim() || null,
        apoderado_suplente_parentesco: formData.apoderado_suplente_parentesco || null,
        apoderado_suplente_email: formData.apoderado_suplente_email.trim() || null,

        colegio_procedencia: formData.colegio_procedencia.trim() || null,
        repite_grado: formData.repite_grado,
        prioritario_preferente: formData.prioritario_preferente,
        observaciones_apoderado: formData.observaciones_apoderado.trim() || null,
      };

      const { data: nuevaMatricula, error: insertError } = await supabase
        .from("matriculas")
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;

      // 2. Subir archivos a Storage si fueron adjuntados
      const uploadPromises: Promise<any>[] = [];

      const uploadDoc = async (file: File, tipo: string) => {
        const fileExt = file.name.split(".").pop();
        const filePath = `${colegioId}/${nuevaMatricula.id}/${Date.now()}_${tipo}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("matriculas")
          .upload(filePath, file);

        if (!uploadError) {
          const { data: pubUrl } = supabase.storage
            .from("matriculas")
            .getPublicUrl(filePath);

          await supabase.from("matricula_documentos").insert({
            matricula_id: nuevaMatricula.id,
            tipo_documento: tipo,
            nombre_archivo: file.name,
            archivo_url: pubUrl.publicUrl,
            estado: "pendiente",
          });
        }
      };

      if (filesToUpload.nacimiento) {
        uploadPromises.push(
          uploadDoc(filesToUpload.nacimiento, "Certificado de Nacimiento")
        );
      }
      if (filesToUpload.notas) {
        uploadPromises.push(
          uploadDoc(filesToUpload.notas, "Certificado de Estudios / Notas")
        );
      }
      if (filesToUpload.salud) {
        uploadPromises.push(
          uploadDoc(filesToUpload.salud, "Informe de Salud / PIE")
        );
      }

      if (uploadPromises.length > 0) {
        await Promise.allSettled(uploadPromises);
      }

      return nuevaMatricula;
    },
    onSuccess: (data) => {
      setSuccessMatricula(data);
      toast.success("¡Solicitud de matrícula enviada con éxito!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al procesar la matrícula");
    },
  });

  const handleSearchTracking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingCodeInput.trim()) {
      toast.error("Ingresa tu código de seguimiento o RUT");
      return;
    }
    setSearchTriggeredCode(trackingCodeInput.trim());
  };

  if (loadingColegio) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Cargando portal de matrícula…</p>
      </div>
    );
  }

  if (!colegio) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Establecimiento no encontrado</h1>
        <p className="text-sm text-muted-foreground mb-6">
          La dirección web ingresada no corresponde a un colegio registrado en HorarioES.
        </p>
        <Link
          to="/"
          className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm"
        >
          Ir al Inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 flex flex-col">
      {/* Encabezado Institucional */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            {colegio.logo_url ? (
              <img
                src={colegio.logo_url}
                alt={colegio.nombre}
                className="w-10 h-10 object-contain rounded-lg bg-surface-2 p-1 border border-border"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-base">
                {colegio.nombre.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">
                {colegio.nombre}
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-primary" />
                Portal Oficial de Matrícula {periodoActivo?.anio || 2026}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/c/$slug/login"
              params={{ slug }}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border hover:bg-surface-2"
            >
              Acceso Funcionarios
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Banner de pestañas */}
        <div className="flex items-center justify-center mb-8">
          <div className="bg-surface-2/80 p-1 rounded-xl border border-border inline-flex">
            <button
              onClick={() => setActiveTab("formulario")}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "formulario"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              Nueva Matrícula
            </button>
            <button
              onClick={() => setActiveTab("seguimiento")}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "seguimiento"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Search className="w-4 h-4" />
              Consultar Estado
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECCIÓN 1: FORMULARIO DE MATRÍCULA                                        */}
        {/* ========================================================================= */}
        {activeTab === "formulario" && (
          <div>
            {/* Pantalla de Éxito si ya envió */}
            {successMatricula ? (
              <div className="bg-surface border border-border rounded-2xl p-8 max-w-2xl mx-auto text-center space-y-6 shadow-xl animate-in zoom-in-95">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    ¡Solicitud de Matrícula Recibida!
                  </h2>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Los antecedentes de{" "}
                    <strong className="text-foreground">
                      {successMatricula.estudiante_nombres}{" "}
                      {successMatricula.estudiante_apellidos}
                    </strong>{" "}
                    fueron enviados exitosamente al equipo de secretaría de{" "}
                    {colegio.nombre}.
                  </p>
                </div>

                {/* Código de Seguimiento */}
                <div className="bg-surface-2 border-2 border-dashed border-primary/40 rounded-xl p-5 max-w-sm mx-auto space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Tu Código de Seguimiento
                  </span>
                  <div className="text-2xl font-mono font-bold text-primary tracking-wider">
                    {successMatricula.codigo_seguimiento}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Guarda este código para consultar el avance y confirmación de la matrícula.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setSearchTriggeredCode(successMatricula.codigo_seguimiento);
                      setActiveTab("seguimiento");
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs shadow-md transition-all hover:bg-primary/90 flex items-center justify-center gap-2"
                  >
                    <Search className="w-4 h-4" /> Ver Estado en Vivo
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="w-full sm:w-auto px-5 py-2.5 bg-surface-2 hover:bg-surface-3 text-foreground font-semibold rounded-lg text-xs border border-border flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> Imprimir Comprobante
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-8">
                {/* Stepper Header */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { num: 1, label: "Estudiante", icon: User },
                    { num: 2, label: "Apoderados", icon: ShieldCheck },
                    { num: 3, label: "Salud y Curso", icon: HeartPulse },
                    { num: 4, label: "Documentos", icon: FileCheck2 },
                  ].map((s) => {
                    const StepIcon = s.icon;
                    const isActive = paso === s.num;
                    const isDone = paso > s.num;

                    return (
                      <button
                        key={s.num}
                        type="button"
                        onClick={() => {
                          if (isDone) setPaso(s.num as any);
                        }}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          isActive
                            ? "bg-primary/10 border-primary text-primary"
                            : isDone
                            ? "bg-surface-2 border-border text-foreground hover:bg-surface-3 cursor-pointer"
                            : "bg-surface border-border/50 text-muted-foreground opacity-60 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <StepIcon className="w-4 h-4" />
                          <span className="text-[11px] font-bold uppercase tracking-wider">
                            Paso {s.num}
                          </span>
                        </div>
                        <div className="text-xs font-semibold truncate">{s.label}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Contenedor del Formulario */}
                <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm relative">
                  {/* Honeypot invisible para protección contra bots */}
                  <input
                    type="text"
                    name="website_protection_hp"
                    tabIndex={-1}
                    autoComplete="off"
                    value={hpField}
                    onChange={(e) => setHpField(e.target.value)}
                    style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }}
                    aria-hidden="true"
                  />
                  {/* PASO 1: ESTUDIANTE */}
                  {paso === 1 && (
                    <div className="space-y-6 animate-in fade-in-50">
                      <div className="border-b border-border pb-4">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <User className="w-5 h-5 text-primary" />
                          Paso 1: Identificación del Estudiante
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">
                          Ingresa los datos del alumno tal como figuran en su Cédula de Identidad o Certificado de Nacimiento.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            Nombres del estudiante *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. Lucas Andrés"
                            value={formData.estudiante_nombres}
                            onChange={(e) =>
                              setFormData({ ...formData, estudiante_nombres: e.target.value })
                            }
                            className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            Apellidos *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. Silva Morales"
                            value={formData.estudiante_apellidos}
                            onChange={(e) =>
                              setFormData({ ...formData, estudiante_apellidos: e.target.value })
                            }
                            className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
                            <span>RUN del estudiante (o IPE) *</span>
                            {formData.estudiante_rut && validateRut(formData.estudiante_rut) && (
                              <span className="text-[10px] text-emerald-500 font-bold">RUT Válido ✓</span>
                            )}
                            {formData.estudiante_rut && !validateRut(formData.estudiante_rut) && formData.estudiante_rut.length >= 7 && (
                              <span className="text-[10px] text-amber-500 font-medium">RUN no verificado / IPE</span>
                            )}
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. 23.456.789-K"
                            value={formData.estudiante_rut}
                            onChange={(e) =>
                              setFormData({ ...formData, estudiante_rut: e.target.value })
                            }
                            onBlur={() => {
                              if (formData.estudiante_rut.trim()) {
                                setFormData((prev) => ({
                                  ...prev,
                                  estudiante_rut: formatRut(prev.estudiante_rut),
                                }));
                              }
                            }}
                            className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            Fecha de Nacimiento *
                          </label>
                          <input
                            type="date"
                            value={formData.estudiante_fecha_nacimiento}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                estudiante_fecha_nacimiento: e.target.value,
                              })
                            }
                            className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            Sexo / Género
                          </label>
                          <select
                            value={formData.estudiante_genero}
                            onChange={(e) =>
                              setFormData({ ...formData, estudiante_genero: e.target.value })
                            }
                            className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="femenino">Femenino</option>
                            <option value="masculino">Masculino</option>
                            <option value="otro">Otro / Prefiero no declarar</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            Nacionalidad
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. Chilena"
                            value={formData.estudiante_nacionalidad}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                estudiante_nacionalidad: e.target.value,
                              })
                            }
                            className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            Dirección de Domicilio *
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. Av. Los Quillayes 1234, Block B, Depto 402"
                            value={formData.estudiante_direccion}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                estudiante_direccion: e.target.value,
                              })
                            }
                            className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            Comuna *
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. La Florida, Santiago, Maipú..."
                            value={formData.estudiante_comuna}
                            onChange={(e) =>
                              setFormData({ ...formData, estudiante_comuna: e.target.value })
                            }
                            className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            Con quién vive el estudiante
                          </label>
                          <select
                            value={formData.estudiante_vive_con}
                            onChange={(e) =>
                              setFormData({ ...formData, estudiante_vive_con: e.target.value })
                            }
                            className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="Ambos padres">Ambos padres</option>
                            <option value="Solo Madre">Solo Madre</option>
                            <option value="Solo Padre">Solo Padre</option>
                            <option value="Abuelos">Abuelos</option>
                            <option value="Tutor Legal">Tutor Legal</option>
                            <option value="Otro familiar">Otro familiar</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              !formData.estudiante_nombres.trim() ||
                              !formData.estudiante_apellidos.trim()
                            ) {
                              toast.error("Por favor completa los nombres y apellidos.");
                              return;
                            }
                            setPaso(2);
                          }}
                          className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs shadow-md transition-all hover:bg-primary/90 flex items-center gap-2"
                        >
                          Siguiente: Apoderados <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PASO 2: APODERADOS */}
                  {paso === 2 && (
                    <div className="space-y-6 animate-in fade-in-50">
                      <div className="border-b border-border pb-4">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-primary" />
                          Paso 2: Datos de Apoderados
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">
                          El apoderado titular es el responsable legal ante el colegio y quien recibirá comunicaciones oficiales.
                        </p>
                      </div>

                      {/* Apoderado Titular */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                          Apoderado Titular (Obligatorio)
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                              Nombres *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Ej. Marcela Elena"
                              value={formData.apoderado_titular_nombres}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  apoderado_titular_nombres: e.target.value,
                                })
                              }
                              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                              Apellidos *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Ej. Morales Vargas"
                              value={formData.apoderado_titular_apellidos}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  apoderado_titular_apellidos: e.target.value,
                                })
                              }
                              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
                              <span>RUN Apoderado Titular *</span>
                              {formData.apoderado_titular_rut && validateRut(formData.apoderado_titular_rut) && (
                                <span className="text-[10px] text-emerald-500 font-bold">RUT Válido ✓</span>
                              )}
                              {formData.apoderado_titular_rut && !validateRut(formData.apoderado_titular_rut) && formData.apoderado_titular_rut.length >= 7 && (
                                <span className="text-[10px] text-rose-500 font-bold">RUN Inválido</span>
                              )}
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Ej. 14.234.567-8"
                              value={formData.apoderado_titular_rut}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  apoderado_titular_rut: e.target.value,
                                })
                              }
                              onBlur={() => {
                                if (formData.apoderado_titular_rut.trim()) {
                                  setFormData((prev) => ({
                                    ...prev,
                                    apoderado_titular_rut: formatRut(prev.apoderado_titular_rut),
                                  }));
                                }
                              }}
                              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                              Parentesco con el Estudiante *
                            </label>
                            <select
                              value={formData.apoderado_titular_parentesco}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  apoderado_titular_parentesco: e.target.value,
                                })
                              }
                              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="Madre">Madre</option>
                              <option value="Padre">Padre</option>
                              <option value="Abuela">Abuela</option>
                              <option value="Abuelo">Abuelo</option>
                              <option value="Tutor Legal">Tutor Legal</option>
                              <option value="Tío/a">Tío/a</option>
                              <option value="Hermano/a Mayor">Hermano/a Mayor</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                              Teléfono Móvil (WhatsApp) *
                            </label>
                            <input
                              type="tel"
                              required
                              placeholder="Ej. +56 9 8765 4321"
                              value={formData.apoderado_titular_telefono}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  apoderado_titular_telefono: e.target.value,
                                })
                              }
                              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                              Correo Electrónico *
                            </label>
                            <input
                              type="email"
                              placeholder="Ej. apoderado@gmail.com"
                              value={formData.apoderado_titular_email}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  apoderado_titular_email: e.target.value,
                                })
                              }
                              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                              Nivel de Estudios
                            </label>
                            <select
                              value={formData.apoderado_titular_nivel_estudios}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  apoderado_titular_nivel_estudios: e.target.value,
                                })
                              }
                              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="Educación Básica">Educación Básica</option>
                              <option value="Educación Media Incompleta">
                                Educación Media Incompleta
                              </option>
                              <option value="Educación Media Completa">
                                Educación Media Completa
                              </option>
                              <option value="Técnico Profesional Superior">
                                Técnico Profesional Superior
                              </option>
                              <option value="Universitario">Universitario</option>
                              <option value="Postgrado">Postgrado</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                              Ocupación / Profesión
                            </label>
                            <input
                              type="text"
                              placeholder="Ej. Enfermera, Emprendedor, Docente..."
                              value={formData.apoderado_titular_ocupacion}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  apoderado_titular_ocupacion: e.target.value,
                                })
                              }
                              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Apoderado Suplente */}
                      <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Apoderado Suplente (Contacto de Emergencia - Opcional)
                          </h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                              Nombre Completo
                            </label>
                            <input
                              type="text"
                              placeholder="Ej. Roberto Silva"
                              value={formData.apoderado_suplente_nombres}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  apoderado_suplente_nombres: e.target.value,
                                })
                              }
                              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                              RUN
                            </label>
                            <input
                              type="text"
                              placeholder="Ej. 13.987.654-3"
                              value={formData.apoderado_suplente_rut}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  apoderado_suplente_rut: e.target.value,
                                })
                              }
                              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                              Teléfono
                            </label>
                            <input
                              type="tel"
                              placeholder="Ej. +56 9 1122 3344"
                              value={formData.apoderado_suplente_telefono}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  apoderado_suplente_telefono: e.target.value,
                                })
                              }
                              className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between pt-4">
                        <button
                          type="button"
                          onClick={() => setPaso(1)}
                          className="px-5 py-2.5 bg-surface-2 hover:bg-surface-3 text-foreground font-semibold rounded-lg text-xs flex items-center gap-2"
                        >
                          <ArrowLeft className="w-4 h-4" /> Volver
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              !formData.apoderado_titular_nombres.trim() ||
                              !formData.apoderado_titular_rut.trim() ||
                              !formData.apoderado_titular_telefono.trim()
                            ) {
                              toast.error(
                                "Por favor completa el nombre, RUT y teléfono del apoderado titular."
                              );
                              return;
                            }
                            setPaso(3);
                          }}
                          className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs shadow-md transition-all hover:bg-primary/90 flex items-center gap-2"
                        >
                          Siguiente: Salud y Curso <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PASO 3: SALUD Y CURSO */}
                  {paso === 3 && (
                    <div className="space-y-6 animate-in fade-in-50">
                      <div className="border-b border-border pb-4">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <HeartPulse className="w-5 h-5 text-rose-500" />
                          Paso 3: Antecedentes Académicos y de Salud
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">
                          Información indispensable para resguardar el bienestar del estudiante y la adecuada asignación de nivel.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Curso al que postula */}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            Curso al que Postula *
                          </label>
                          <select
                            value={formData.curso_postula_id}
                            onChange={(e) =>
                              setFormData({ ...formData, curso_postula_id: e.target.value })
                            }
                            className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                          >
                            <option value="">Selecciona el curso</option>
                            {cursos.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nombre} {c.nivel ? `(${c.nivel})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            Colegio de Procedencia
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. Escuela República de Chile (o indicar continuidad)"
                            value={formData.colegio_procedencia}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                colegio_procedencia: e.target.value,
                              })
                            }
                            className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            Previsión de Salud
                          </label>
                          <select
                            value={formData.prevision_salud}
                            onChange={(e) =>
                              setFormData({ ...formData, prevision_salud: e.target.value })
                            }
                            className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="FONASA">FONASA</option>
                            <option value="ISAPRE">ISAPRE</option>
                            <option value="DIPRECA / CAPREDENA">DIPRECA / CAPREDENA</option>
                            <option value="Particular / Ninguna">Particular / Ninguna</option>
                          </select>
                        </div>

                        {/* Checkboxes de repitencia y PIE */}
                        <div className="sm:col-span-2 space-y-3 pt-2">
                          <label className="flex items-center gap-3 p-3 bg-surface-2/40 border border-border rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.repite_grado}
                              onChange={(e) =>
                                setFormData({ ...formData, repite_grado: e.target.checked })
                              }
                              className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                            />
                            <div>
                              <span className="text-xs font-semibold text-foreground block">
                                ¿El estudiante repite curso este año escolar?
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                Marcar si cursará el mismo nivel del año anterior.
                              </span>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.es_pie}
                              onChange={(e) =>
                                setFormData({ ...formData, es_pie: e.target.checked })
                              }
                              className="rounded border-purple-500 text-purple-600 focus:ring-purple-500 w-4 h-4"
                            />
                            <div>
                              <span className="text-xs font-semibold text-foreground block">
                                Programa de Integración Escolar (PIE) / Necesidad Educativa Especial (NEE)
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                Marcar si el alumno cuenta con evaluación o apoyo PIE (TEA, TDAH, TEL, etc.).
                              </span>
                            </div>
                          </label>
                        </div>

                        {formData.es_pie && (
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-purple-600 mb-1.5">
                              Diagnóstico / Condición PIE
                            </label>
                            <input
                              type="text"
                              placeholder="Ej. Trastorno del Espectro Autista (TEA Leve), Trastorno Específico del Lenguaje..."
                              value={formData.diagnostico_pie}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  diagnostico_pie: e.target.value,
                                })
                              }
                              className="w-full bg-surface-2 border border-purple-500/30 rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                          </div>
                        )}

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            Alergias o Enfermedades Crónicas (Opcional)
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. Alergia a la penicilina, asma estacional, diabetes..."
                            value={formData.alergias_enfermedades}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                alergias_enfermedades: e.target.value,
                              })
                            }
                            className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            Medicamentos Habituales / Indicaciones de Emergencia (Opcional)
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. Inhalador salbutamol SOS..."
                            value={formData.medicamentos}
                            onChange={(e) =>
                              setFormData({ ...formData, medicamentos: e.target.value })
                            }
                            className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>

                      <div className="flex justify-between pt-4">
                        <button
                          type="button"
                          onClick={() => setPaso(2)}
                          className="px-5 py-2.5 bg-surface-2 hover:bg-surface-3 text-foreground font-semibold rounded-lg text-xs flex items-center gap-2"
                        >
                          <ArrowLeft className="w-4 h-4" /> Volver
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!formData.curso_postula_id) {
                              toast.error("Por favor selecciona el curso al que postula.");
                              return;
                            }
                            setPaso(4);
                          }}
                          className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs shadow-md transition-all hover:bg-primary/90 flex items-center gap-2"
                        >
                          Siguiente: Documentación <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PASO 4: DOCUMENTOS Y CONFIRMACIÓN */}
                  {paso === 4 && (
                    <div className="space-y-6 animate-in fade-in-50">
                      <div className="border-b border-border pb-4">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <FileCheck2 className="w-5 h-5 text-primary" />
                          Paso 4: Adjuntar Documentos y Enviar
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">
                          Puedes adjuntar los certificados en formato PDF o imagen (JPG, PNG). Si no los tienes a mano, podrás presentarlos directamente en Secretaría.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Doc 1: Nacimiento */}
                        <div className="p-4 bg-surface-2/40 border border-border rounded-xl space-y-3">
                          <div className="flex items-center gap-2 text-primary font-bold text-xs">
                            <FileText className="w-4 h-4" />
                            Cert. de Nacimiento
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Para Asignación Familiar o Matrícula (Registro Civil).
                          </p>
                          <label className="cursor-pointer block">
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                setFilesToUpload((prev) => ({ ...prev, nacimiento: f }));
                              }}
                            />
                            <div className="w-full py-2 px-3 bg-surface border border-border rounded-lg text-[11px] font-semibold text-center hover:bg-surface-2 transition-colors flex items-center justify-center gap-1.5 truncate">
                              <Upload className="w-3.5 h-3.5" />
                              {filesToUpload.nacimiento
                                ? filesToUpload.nacimiento.name
                                : "Seleccionar archivo"}
                            </div>
                          </label>
                        </div>

                        {/* Doc 2: Notas */}
                        <div className="p-4 bg-surface-2/40 border border-border rounded-xl space-y-3">
                          <div className="flex items-center gap-2 text-primary font-bold text-xs">
                            <FileText className="w-4 h-4" />
                            Cert. de Estudios / Notas
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Certificado anual de notas o informe del colegio anterior.
                          </p>
                          <label className="cursor-pointer block">
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                setFilesToUpload((prev) => ({ ...prev, notas: f }));
                              }}
                            />
                            <div className="w-full py-2 px-3 bg-surface border border-border rounded-lg text-[11px] font-semibold text-center hover:bg-surface-2 transition-colors flex items-center justify-center gap-1.5 truncate">
                              <Upload className="w-3.5 h-3.5" />
                              {filesToUpload.notas
                                ? filesToUpload.notas.name
                                : "Seleccionar archivo"}
                            </div>
                          </label>
                        </div>

                        {/* Doc 3: Salud / PIE */}
                        <div className="p-4 bg-surface-2/40 border border-border rounded-xl space-y-3">
                          <div className="flex items-center gap-2 text-primary font-bold text-xs">
                            <FileText className="w-4 h-4" />
                            Informe Médico / PIE
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Diagnóstico especialista o informe psicopedagógico (si aplica).
                          </p>
                          <label className="cursor-pointer block">
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                setFilesToUpload((prev) => ({ ...prev, salud: f }));
                              }}
                            />
                            <div className="w-full py-2 px-3 bg-surface border border-border rounded-lg text-[11px] font-semibold text-center hover:bg-surface-2 transition-colors flex items-center justify-center gap-1.5 truncate">
                              <Upload className="w-3.5 h-3.5" />
                              {filesToUpload.salud
                                ? filesToUpload.salud.name
                                : "Seleccionar archivo"}
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Observaciones adicionales */}
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                          Observaciones o Mensaje al Establecimiento (Opcional)
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Indica cualquier antecedente adicional que sea relevante para el proceso de matrícula..."
                          value={formData.observaciones_apoderado}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              observaciones_apoderado: e.target.value,
                            })
                          }
                          className="w-full bg-surface-2 border border-border rounded-lg p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      {/* Términos y Veracidad */}
                      <div className="p-4 bg-surface-2/40 border border-border rounded-xl text-xs space-y-2">
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            required
                            id="chk-terms"
                            defaultChecked
                            className="rounded border-border text-primary focus:ring-primary w-4 h-4 mt-0.5"
                          />
                          <label
                            htmlFor="chk-terms"
                            className="text-[11px] text-muted-foreground leading-relaxed cursor-pointer"
                          >
                            Declaro que la información aportada es fidedigna y veraz, y solicito
                            formalmente la matrícula en {colegio.nombre}. Conozco que la matrícula
                            quedará oficializada tras la confirmación de antecedentes por el
                            establecimiento.
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-between pt-4">
                        <button
                          type="button"
                          onClick={() => setPaso(3)}
                          className="px-5 py-2.5 bg-surface-2 hover:bg-surface-3 text-foreground font-semibold rounded-lg text-xs flex items-center gap-2"
                        >
                          <ArrowLeft className="w-4 h-4" /> Volver
                        </button>
                        <button
                          type="button"
                          disabled={mutationSubmit.isPending}
                          onClick={() => mutationSubmit.mutate()}
                          className="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {mutationSubmit.isPending ? (
                            "Procesando matrícula…"
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" /> Enviar Solicitud de Matrícula
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECCIÓN 2: CONSULTA Y SEGUIMIENTO EN VIVO                                 */}
        {/* ========================================================================= */}
        {activeTab === "seguimiento" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="text-center space-y-1.5">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Consultar Estado de Matrícula
                </h2>
                <p className="text-xs text-muted-foreground">
                  Ingresa tu código de seguimiento (ej.{" "}
                  <strong className="text-primary font-mono">MAT-2026-X8F2</strong>) o el RUN
                  del estudiante para conocer el avance de la matrícula.
                </p>
              </div>

              <form onSubmit={handleSearchTracking} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Código de seguimiento (MAT-2026-...) o RUN del alumno"
                    value={trackingCodeInput}
                    onChange={(e) => setTrackingCodeInput(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingTracking}
                  className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-xs shadow-md transition-all hover:bg-primary/90 flex items-center gap-1.5"
                >
                  {loadingTracking ? "Buscando…" : "Consultar"}
                </button>
              </form>
            </div>

            {/* Resultado de la Búsqueda */}
            {searchTriggeredCode && (
              <div>
                {loadingTracking ? (
                  <div className="text-center py-12 text-xs text-muted-foreground">
                    Consultando registros oficiales…
                  </div>
                ) : !trackingResult ? (
                  <div className="bg-surface border border-border rounded-2xl p-8 text-center space-y-2">
                    <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                    <h3 className="text-base font-bold text-foreground">
                      No encontramos registros con este código
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Verifica que el código{" "}
                      <span className="font-mono font-bold text-foreground">
                        {searchTriggeredCode}
                      </span>{" "}
                      esté escrito correctamente o consulta directamente en el establecimiento.
                    </p>
                  </div>
                ) : (
                  (() => {
                    const info =
                      ESTADO_INFO[trackingResult.estado as MatriculaEstado] || ESTADO_INFO.solicitada;
                    const InfoIcon = info.icon;

                    return (
                      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm animate-in fade-in-50">
                        {/* Estado Header */}
                        <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
                          <div className="space-y-1">
                            <span className="text-[11px] font-mono text-muted-foreground uppercase">
                              Código: {trackingResult.codigo_seguimiento}
                            </span>
                            <h3 className="text-lg font-bold text-foreground">
                              {trackingResult.estudiante_apellidos},{" "}
                              {trackingResult.estudiante_nombres}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              RUN:{" "}
                              <span className="font-mono text-foreground">
                                {trackingResult.estudiante_rut || "Sin RUN registrado"}
                              </span>
                            </p>
                          </div>

                          <div
                            className={`px-3.5 py-1.5 rounded-full border flex items-center gap-2 text-xs font-bold ${info.bg} ${info.text} ${info.border}`}
                          >
                            <InfoIcon className="w-4 h-4" />
                            {info.label}
                          </div>
                        </div>

                        {/* Descripción del Estado */}
                        <div className="p-4 bg-surface-2/40 border border-border rounded-xl text-xs space-y-1">
                          <span className="font-semibold text-foreground block">
                            Detalle del Estado:
                          </span>
                          <p className="text-muted-foreground leading-relaxed">
                            {info.desc}
                          </p>
                        </div>

                        {/* Observaciones si las hay */}
                        {trackingResult.estado === "observada" &&
                          trackingResult.observaciones_internas && (
                            <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl text-xs space-y-1">
                              <span className="font-bold text-orange-600 block flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4" /> Observaciones del Colegio:
                              </span>
                              <p className="text-foreground">
                                {trackingResult.observaciones_internas}
                              </p>
                            </div>
                          )}

                        {/* Si está aprobada: N° Matrícula y Curso Asignado */}
                        {trackingResult.estado === "aprobada" && (
                          <div className="grid grid-cols-2 gap-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs">
                            <div>
                              <span className="text-emerald-700 block font-semibold text-[11px]">
                                N° Matrícula Oficial
                              </span>
                              <span className="text-xl font-bold font-mono text-emerald-600">
                                #{trackingResult.numero_matricula || "Asignado"}
                              </span>
                            </div>
                            <div>
                              <span className="text-emerald-700 block font-semibold text-[11px]">
                                Curso Asignado
                              </span>
                              <span className="text-sm font-bold text-foreground">
                                {trackingResult.cursos_asignado?.nombre ||
                                  trackingResult.cursos_postula?.nombre}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Resumen de Información */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-2">
                          <div>
                            <span className="text-muted-foreground block text-[10px]">
                              Curso al que Postula
                            </span>
                            <span className="font-medium text-foreground">
                              {trackingResult.cursos_postula?.nombre || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">
                              Apoderado Titular
                            </span>
                            <span className="font-medium text-foreground">
                              {trackingResult.apoderado_titular_nombres}{" "}
                              {trackingResult.apoderado_titular_apellidos}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">
                              Fecha de Postulación
                            </span>
                            <span className="font-medium text-foreground">
                              {new Date(trackingResult.created_at).toLocaleDateString(
                                "es-CL"
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground bg-surface/50 mt-12">
        <p>
          {colegio.nombre} — Sistema de Matrícula Digital impulsado por{" "}
          <strong className="text-foreground">HorarioES</strong>.
        </p>
      </footer>
    </div>
  );
}
