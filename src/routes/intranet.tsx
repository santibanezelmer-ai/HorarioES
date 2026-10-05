import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Newspaper,
  Pin,
  AlertCircle,
  FileText,
  Calendar,
  CheckCircle2,
  Download,
  Plus,
  Search,
  Eye,
  X,
  Upload,
  BookOpen,
  Users,
  GraduationCap,
  MessageSquare,
  Trash2,
  Paperclip,
  Check,
  Building2,
  HelpCircle,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useUserRoles } from "@/lib/use-role";
import { useMyDocente } from "@/lib/use-my-docente";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import type {
  IntranetPublicacion,
  IntranetDocumento,
  IntranetCategoria,
  AmbitoDocente,
} from "@/lib/intranet.types";

export const Route = createFileRoute("/intranet")({
  head: () => ({ meta: [{ title: "Intranet — HorarioES" }] }),
  component: IntranetPage,
});

const CATEGORIA_BADGE: Record<
  IntranetCategoria,
  { label: string; bg: string; text: string; border: string }
> = {
  urgente: {
    label: "Urgente",
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/30",
  },
  circular: {
    label: "Circular Oficial",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    border: "border-blue-500/30",
  },
  comunicado: {
    label: "Comunicado",
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    border: "border-amber-500/30",
  },
  noticia: {
    label: "Noticia",
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    border: "border-emerald-500/30",
  },
  evento: {
    label: "Evento",
    bg: "bg-purple-500/10",
    text: "text-purple-500",
    border: "border-purple-500/30",
  },
};

const AMBITO_DOCENTE_BADGE: Record<
  AmbitoDocente,
  { label: string; desc: string; color: string }
> = {
  general: { label: "General Docente", desc: "Información general del equipo", color: "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300" },
  consejo: { label: "Consejo de Profesores", desc: "Minutas, tablas y acuerdos de consejo", color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300" },
  utp: { label: "UTP & Currículum", desc: "Lineamientos de evaluación y fechas clave", color: "text-teal-600 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-300" },
  departamento: { label: "Departamentos", desc: "Coordinación por asignaturas y áreas", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300" },
  convivencia: { label: "Convivencia e Inspectoría", desc: "Turnos, pautas y protocolos internos", color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300" },
};

function IntranetPage() {
  const { profile, user } = useAuth();
  const colegioId = profile?.colegio_id;
  const { data: roles = [] } = useUserRoles();
  const { data: docente } = useMyDocente();
  const queryClient = useQueryClient();

  const isDocente = roles.includes("docente");
  const isSuper = roles.includes("superadmin");
  const isStaff = roles.some((r) =>
    ["admin", "direccion", "utp", "inspectoria", "superadmin"].includes(r)
  );
  const canPublish = isStaff || isDocente;

  // Pestañas principales de navegación
  const [tab, setTab] = useState<"general" | "apoderados" | "docente" | "documentos">("general");

  // Filtros
  const [catFilter, setCatFilter] = useState<string>("todas");
  const [cursoFilter, setCursoFilter] = useState<string>("todos");
  const [ambitoFilter, setAmbitoFilter] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState("");

  // Modales
  const [selectedPub, setSelectedPub] = useState<IntranetPublicacion | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);

  // Formulario nueva publicación
  const [nuevoCanal, setNuevoCanal] = useState<"general" | "apoderados" | "docentes">("general");
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [nuevoExtracto, setNuevoExtracto] = useState("");
  const [nuevoContenido, setNuevoContenido] = useState("");
  const [nuevaCat, setNuevaCat] = useState<IntranetCategoria>("comunicado");
  const [nuevoFijado, setNuevoFijado] = useState(false);
  const [nuevoAmbito, setNuevoAmbito] = useState<AmbitoDocente>("consejo");
  const [nuevoTipoApoderado, setNuevoTipoApoderado] = useState<"todos" | "especificos">("todos");
  const [cursosSeleccionados, setCursosSeleccionados] = useState<string[]>([]);
  const [autorNombreInput, setAutorNombreInput] = useState("");
  const [autorCargoInput, setAutorCargoInput] = useState("");
  const [archivoAdjuntoFile, setArchivoAdjuntoFile] = useState<File | null>(null);
  const [archivoUrlManual, setArchivoUrlManual] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Formulario nuevo documento normativo
  const [docTitulo, setDocTitulo] = useState("");
  const [docDesc, setDocDesc] = useState("");
  const [docCategoria, setDocCategoria] = useState("reglamento");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [submittingDoc, setSubmittingDoc] = useState(false);

  // Inicializar firma del autor
  const defaultAutorNombre = docente?.nombre || profile?.display_name || "Equipo Directivo / Docente";
  const defaultAutorCargo = isDocente
    ? "Docente"
    : roles.includes("direccion")
    ? "Dirección"
    : roles.includes("utp")
    ? "Unidad Técnica Pedagógica (UTP)"
    : roles.includes("inspectoria")
    ? "Inspectoría General"
    : "Administración Institucional";

  // Consulta de cursos del colegio para filtrar y segmentar
  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-intranet", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select("id, nombre, nivel")
        .eq("colegio_id", colegioId!)
        .order("nombre");
      if (error) throw error;
      return (data || []) as { id: string; nombre: string; nivel: string }[];
    },
  });

  const cursoMap = useMemo(
    () => new Map(cursos.map((c) => [c.id, c.nombre])),
    [cursos]
  );

  // Consulta de publicaciones
  const { data: publicaciones = [], isLoading: pubsLoading } = useQuery({
    queryKey: ["intranet-publicaciones", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intranet_publicaciones")
        .select("*")
        .eq("colegio_id", colegioId!)
        .eq("activo", true)
        .order("fijado", { ascending: false })
        .order("fecha_publicacion", { ascending: false });
      if (error) throw error;
      return (data || []) as IntranetPublicacion[];
    },
  });

  // Consulta de documentos oficiales
  const { data: documentos = [], isLoading: docsLoading } = useQuery({
    queryKey: ["intranet-documentos", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intranet_documentos")
        .select("*")
        .eq("colegio_id", colegioId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as IntranetDocumento[];
    },
  });

  // Consulta de lecturas del usuario actual
  const { data: lecturas = [] } = useQuery({
    queryKey: ["intranet-lecturas-usuario", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intranet_lecturas")
        .select("publicacion_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((l) => l.publicacion_id);
    },
  });

  // Conteo total de lecturas por publicación
  const { data: lecturasCounts = {} } = useQuery({
    queryKey: ["intranet-lecturas-counts", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intranet_lecturas")
        .select("publicacion_id");
      if (error) return {};
      const counts: Record<string, number> = {};
      (data || []).forEach((row) => {
        counts[row.publicacion_id] = (counts[row.publicacion_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Mutación para confirmar lectura (acuse de recibo)
  const markReadMutation = useMutation({
    mutationFn: async (pubId: string) => {
      if (!user?.id) return;
      const { error } = await supabase.from("intranet_lecturas").upsert({
        publicacion_id: pubId,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intranet-lecturas-usuario"] });
      queryClient.invalidateQueries({ queryKey: ["intranet-lecturas-counts"] });
      toast.success("✓ Acuse de recibo confirmado con éxito");
    },
  });

  // Mutación para eliminar publicación (autor o directivos)
  const deletePubMutation = useMutation({
    mutationFn: async (pubId: string) => {
      const { error } = await supabase
        .from("intranet_publicaciones")
        .delete()
        .eq("id", pubId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intranet-publicaciones"] });
      toast.success("Publicación eliminada correctamente");
      setSelectedPub(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al eliminar la publicación");
    },
  });

  // Filtrado de publicaciones según canal/pestaña actual y filtros activos
  const filteredPubs = useMemo(() => {
    return publicaciones.filter((p) => {
      const dests = p.destinatarios || [];

      // Filtro por pestaña de canal
      if (tab === "apoderados") {
        const isParaApoderados =
          dests.includes("apoderados") || dests.includes("todos");
        if (!isParaApoderados) return false;

        // Filtro por curso específico dentro de canal Apoderados
        if (cursoFilter !== "todos") {
          const cursosP = p.cursos_destinatarios || [];
          if (cursosP.length > 0 && !cursosP.includes(cursoFilter)) {
            return false;
          }
        }
      } else if (tab === "docente") {
        const isDocente =
          dests.includes("docentes") || (p.ambito_docente && p.ambito_docente !== "general");
        if (!isDocente) return false;

        // Filtro por ámbito docente específico
        if (ambitoFilter !== "todos") {
          if (p.ambito_docente !== ambitoFilter) return false;
        }
      }

      // Filtro por categoría general (urgente, circular, etc.)
      if (catFilter !== "todas" && p.categoria !== catFilter) return false;

      // Filtro por término de búsqueda
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchTitle = p.titulo.toLowerCase().includes(term);
        const matchContent = p.contenido.toLowerCase().includes(term);
        const matchExtract = (p.extracto || "").toLowerCase().includes(term);
        const matchAutor = (p.autor_nombre || "").toLowerCase().includes(term);
        if (!matchTitle && !matchContent && !matchExtract && !matchAutor) return false;
      }

      return true;
    });
  }, [publicaciones, tab, catFilter, cursoFilter, ambitoFilter, searchTerm]);

  // Manejar creación de publicación
  const handleCreatePub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTitulo.trim() || !nuevoContenido.trim() || !colegioId) {
      toast.error("Por favor completa el título y contenido de la publicación");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Resolver destinatarios y cursos
      let finalDestinatarios: string[] = ["todos"];
      let finalCursos: string[] = [];
      let finalAmbito: AmbitoDocente = "general";

      if (nuevoCanal === "apoderados") {
        finalDestinatarios = ["apoderados"];
        if (nuevoTipoApoderado === "especificos" && cursosSeleccionados.length > 0) {
          finalCursos = cursosSeleccionados;
        }
      } else if (nuevoCanal === "docentes") {
        finalDestinatarios = ["docentes"];
        finalAmbito = nuevoAmbito;
      } else {
        finalDestinatarios = ["todos"];
      }

      // 2. Subir archivo adjunto si existe
      let finalAdjuntoUrl = archivoUrlManual.trim() || null;
      let finalAdjuntoNombre = archivoAdjuntoFile ? archivoAdjuntoFile.name : null;

      if (archivoAdjuntoFile) {
        const ext = archivoAdjuntoFile.name.split(".").pop();
        const cleanName = archivoAdjuntoFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `${colegioId}/${Date.now()}_${cleanName}`;

        const { error: uploadError } = await supabase.storage
          .from("intranet")
          .upload(filePath, archivoAdjuntoFile, { upsert: true });

        if (uploadError) {
          console.warn("Storage upload warning, usando enlace:", uploadError);
        } else {
          const { data: pubUrl } = supabase.storage
            .from("intranet")
            .getPublicUrl(filePath);
          finalAdjuntoUrl = pubUrl.publicUrl;
        }
      }

      // 3. Insertar publicación
      const { error } = await supabase.from("intranet_publicaciones").insert({
        colegio_id: colegioId,
        autor_id: user?.id,
        autor_nombre: autorNombreInput.trim() || defaultAutorNombre,
        autor_cargo: autorCargoInput.trim() || defaultAutorCargo,
        ambito_docente: nuevoCanal === "docentes" ? finalAmbito : "general",
        titulo: nuevoTitulo.trim(),
        extracto: nuevoExtracto.trim() || null,
        contenido: nuevoContenido.trim(),
        categoria: nuevaCat,
        fijado: nuevoFijado,
        destinatarios: finalDestinatarios,
        cursos_destinatarios: finalCursos,
        archivo_adjunto_url: finalAdjuntoUrl,
        nombre_adjunto: finalAdjuntoNombre,
      });

      if (error) throw error;

      toast.success("Publicación emitida exitosamente en Intranet");
      setIsNewModalOpen(false);
      resetNewPubForm();
      queryClient.invalidateQueries({ queryKey: ["intranet-publicaciones"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al crear la publicación");
    } finally {
      setSubmitting(false);
    }
  };

  const resetNewPubForm = () => {
    setNuevoTitulo("");
    setNuevoExtracto("");
    setNuevoContenido("");
    setNuevaCat("comunicado");
    setNuevoFijado(false);
    setNuevoCanal("general");
    setNuevoAmbito("consejo");
    setNuevoTipoApoderado("todos");
    setCursosSeleccionados([]);
    setAutorNombreInput("");
    setAutorCargoInput("");
    setArchivoAdjuntoFile(null);
    setArchivoUrlManual("");
  };

  // Manejar creación de documento normativo
  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitulo.trim() || !colegioId) {
      toast.error("Por favor ingresa el título del documento");
      return;
    }

    setSubmittingDoc(true);
    try {
      let finalUrl = "#";
      let bytes = 0;

      if (docFile) {
        bytes = docFile.size;
        const cleanName = docFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `documentos/${colegioId}/${Date.now()}_${cleanName}`;

        const { error: uploadErr } = await supabase.storage
          .from("intranet")
          .upload(filePath, docFile, { upsert: true });

        if (!uploadErr) {
          const { data: pubUrl } = supabase.storage
            .from("intranet")
            .getPublicUrl(filePath);
          finalUrl = pubUrl.publicUrl;
        }
      }

      const { error } = await supabase.from("intranet_documentos").insert({
        colegio_id: colegioId,
        subido_por: user?.id,
        titulo: docTitulo.trim(),
        descripcion: docDesc.trim() || null,
        categoria: docCategoria,
        archivo_url: finalUrl,
        tamano_bytes: bytes,
        visible_para: ["todos"],
      });

      if (error) throw error;

      toast.success("Documento normativo agregado al repositorio");
      setIsNewDocModalOpen(false);
      setDocTitulo("");
      setDocDesc("");
      setDocFile(null);
      queryClient.invalidateQueries({ queryKey: ["intranet-documentos"] });
    } catch (err: any) {
      toast.error(err.message || "Error al subir el documento");
    } finally {
      setSubmittingDoc(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Intranet Institucional"
        subtitle="Comunicación escolar, circulares oficiales, trabajo docente y repositorio normativo"
        actions={
          <div className="flex items-center gap-2">
            {canPublish && (
              <button
                onClick={() => {
                  setNuevoCanal(tab === "apoderados" ? "apoderados" : tab === "docente" ? "docentes" : "general");
                  setIsNewModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm shadow-elegant hover:bg-primary/90 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nueva Publicación
              </button>
            )}
            {isStaff && tab === "documentos" && (
              <button
                onClick={() => setIsNewDocModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface border border-border text-foreground font-semibold rounded-lg text-sm hover:bg-surface-2 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Subir Documento
              </button>
            )}
          </div>
        }
      />

      {/* Selector de Canales Principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-b border-border pb-3">
        <button
          onClick={() => {
            setTab("general");
            setCatFilter("todas");
          }}
          className={`flex items-center justify-center sm:justify-start gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            tab === "general"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-2 border border-border/60"
          }`}
        >
          <Newspaper className="w-4 h-4" />
          <span>Muro General</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              tab === "general"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-surface-2 text-muted-foreground"
            }`}
          >
            {publicaciones.length}
          </span>
        </button>

        <button
          onClick={() => {
            setTab("apoderados");
            setCatFilter("todas");
          }}
          className={`flex items-center justify-center sm:justify-start gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            tab === "apoderados"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-2 border border-border/60"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Para Apoderados</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              tab === "apoderados"
                ? "bg-white/20 text-white"
                : "bg-surface-2 text-muted-foreground"
            }`}
          >
            {
              publicaciones.filter(
                (p) =>
                  (p.destinatarios || []).includes("apoderados") ||
                  (p.destinatarios || []).includes("todos")
              ).length
            }
          </span>
        </button>

        <button
          onClick={() => {
            setTab("docente");
            setCatFilter("todas");
          }}
          className={`flex items-center justify-center sm:justify-start gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            tab === "docente"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-2 border border-border/60"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Trabajo Docente</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              tab === "docente"
                ? "bg-white/20 text-white"
                : "bg-surface-2 text-muted-foreground"
            }`}
          >
            {
              publicaciones.filter(
                (p) =>
                  (p.destinatarios || []).includes("docentes") ||
                  (p.ambito_docente && p.ambito_docente !== "general")
              ).length
            }
          </span>
        </button>

        <button
          onClick={() => setTab("documentos")}
          className={`flex items-center justify-center sm:justify-start gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            tab === "documentos"
              ? "bg-teal-700 text-white shadow-sm"
              : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-2 border border-border/60"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Normativa y Reglamentos</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              tab === "documentos"
                ? "bg-white/20 text-white"
                : "bg-surface-2 text-muted-foreground"
            }`}
          >
            {documentos.length}
          </span>
        </button>
      </div>

      {tab !== "documentos" ? (
        <div className="space-y-5">
          {/* Sub-banner explicativo según pestaña */}
          {tab === "apoderados" && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Canal de Familias y Apoderados:</strong> Comunicados oficiales, circulares de jefatura de curso, citaciones a reunión de apoderados y salidas a terreno.
                </span>
              </div>
              {/* Filtro por curso */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold text-amber-800 dark:text-amber-300">Curso:</span>
                <select
                  value={cursoFilter}
                  onChange={(e) => setCursoFilter(e.target.value)}
                  className="px-2.5 py-1 bg-surface border border-amber-300 dark:border-amber-800 rounded-lg text-xs font-semibold text-foreground focus:outline-none"
                >
                  <option value="todos">Todos los cursos</option>
                  {cursos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {tab === "docente" && (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-indigo-900 dark:text-indigo-200">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  <strong>Sala de Profesores Digital & Trabajo Técnico:</strong> Actas de Consejo de Profesores, lineamientos UTP, coordinación de departamentos y acuerdos pedagógicos.
                </span>
              </div>
              {/* Filtro por ámbito docente */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold text-indigo-800 dark:text-indigo-300">Área:</span>
                <select
                  value={ambitoFilter}
                  onChange={(e) => setAmbitoFilter(e.target.value)}
                  className="px-2.5 py-1 bg-surface border border-indigo-300 dark:border-indigo-800 rounded-lg text-xs font-semibold text-foreground focus:outline-none capitalize"
                >
                  <option value="todos">Todas las áreas</option>
                  <option value="consejo">Consejo de Profesores</option>
                  <option value="utp">UTP & Currículum</option>
                  <option value="departamento">Departamentos de Asignatura</option>
                  <option value="convivencia">Convivencia e Inspectoría</option>
                  <option value="general">General Docente</option>
                </select>
              </div>
            </div>
          )}

          {/* Barra de Búsqueda y Filtros de Categoría */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por título, contenido, autor o curso…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  "todas",
                  "urgente",
                  "circular",
                  "comunicado",
                  "noticia",
                  "evento",
                ] as const
              ).map((c) => (
                <button
                  key={c}
                  onClick={() => setCatFilter(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                    catFilter === c
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-surface border border-border text-muted-foreground hover:bg-surface-2"
                  }`}
                >
                  {c === "todas" ? "Todas" : c}
                </button>
              ))}
            </div>
          </div>

          {/* Listado de Publicaciones */}
          {pubsLoading ? (
            <div className="text-sm text-muted-foreground py-12 text-center">
              Cargando publicaciones de la Intranet…
            </div>
          ) : filteredPubs.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="No hay publicaciones en este canal"
              description="No se encontraron publicaciones con los filtros seleccionados. Puedes crear una nueva con el botón superior."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPubs.map((pub) => {
                const catStyle =
                  CATEGORIA_BADGE[pub.categoria] || CATEGORIA_BADGE.comunicado;
                const isRead = lecturas.includes(pub.id);
                const totalLecturas = lecturasCounts[pub.id] || 0;
                const isMine = pub.autor_id === user?.id;

                // Nombres de cursos si aplica
                const cursosDestinoNombres = (pub.cursos_destinatarios || [])
                  .map((id) => cursoMap.get(id))
                  .filter(Boolean);

                const isForApoderados = (pub.destinatarios || []).includes("apoderados");
                const isForDocentes = (pub.destinatarios || []).includes("docentes");

                return (
                  <div
                    key={pub.id}
                    className={`bg-surface border rounded-xl p-5 shadow-sm transition-all flex flex-col justify-between hover:border-primary/40 ${
                      pub.fijado ? "border-primary/40 bg-primary/5" : "border-border"
                    }`}
                  >
                    <div>
                      {/* Cabecera de la tarjeta */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                          >
                            {catStyle.label}
                          </span>

                          {/* Badge de Destinatario / Ámbito */}
                          {isForApoderados && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              <Users className="w-3 h-3" />
                              {cursosDestinoNombres.length > 0
                                ? `Apoderados: ${cursosDestinoNombres.slice(0, 2).join(", ")}${
                                    cursosDestinoNombres.length > 2 ? "..." : ""
                                  }`
                                : "Todos los Apoderados"}
                            </span>
                          )}

                          {isForDocentes && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                              <Briefcase className="w-3 h-3" />
                              {pub.ambito_docente && pub.ambito_docente !== "general"
                                ? AMBITO_DOCENTE_BADGE[pub.ambito_docente]?.label || "Docente"
                                : "Docentes"}
                            </span>
                          )}

                          {pub.fijado && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              <Pin className="w-3 h-3 rotate-45" /> Fijado
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                          <Calendar className="w-3 h-3" />
                          {new Date(pub.fecha_publicacion).toLocaleDateString("es-CL", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      {/* Título y extracto */}
                      <h3 className="font-bold text-base text-foreground mb-1 leading-snug">
                        {pub.titulo}
                      </h3>

                      {/* Autor y Cargo */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                        <span className="font-semibold text-foreground/80">
                          {pub.autor_nombre || "Institución"}
                        </span>
                        {pub.autor_cargo && (
                          <>
                            <span>•</span>
                            <span className="italic">{pub.autor_cargo}</span>
                          </>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
                        {pub.extracto || pub.contenido}
                      </p>

                      {/* Adjunto indicativo */}
                      {pub.archivo_adjunto_url && (
                        <div className="mb-3 inline-flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/5 px-2.5 py-1 rounded-md border border-primary/20">
                          <Paperclip className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[200px]">
                            {pub.nombre_adjunto || "Documento adjunto disponible"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Pie de la tarjeta */}
                    <div className="pt-3 border-t border-border flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2">
                        {isRead ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Leído
                          </span>
                        ) : (
                          <button
                            onClick={() => markReadMutation.mutate(pub.id)}
                            className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold hover:underline cursor-pointer"
                          >
                            <AlertCircle className="w-3.5 h-3.5" /> Marcar Leído
                          </button>
                        )}

                        {/* Contador de lecturas para personal o autor */}
                        {(canPublish || isMine) && totalLecturas > 0 && (
                          <span className="text-[11px] text-muted-foreground bg-surface-2 px-2 py-0.5 rounded-full font-medium">
                            {totalLecturas} {totalLecturas === 1 ? "lectura" : "lecturas"}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {(isMine || isStaff) && (
                          <button
                            onClick={() => {
                              if (confirm("¿Estás seguro de eliminar esta publicación de la Intranet?")) {
                                deletePubMutation.mutate(pub.id);
                              }
                            }}
                            title="Eliminar publicación"
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedPub(pub);
                            if (!isRead) markReadMutation.mutate(pub.id);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-surface-2 hover:bg-surface-3 rounded-md transition-colors cursor-pointer text-foreground"
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver completo
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Pestaña: Documentos Institucionales Normativos */
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="font-bold text-sm text-foreground mb-0.5">
                  Repositorio de Documentos Normativos y Reglamentos
                </h3>
                <p className="text-xs text-muted-foreground">
                  Documentación oficial permanente: RICE, PEI, Protocolos de Convivencia Escolar y Decretos de Evaluación.
                </p>
              </div>
              {isStaff && (
                <button
                  onClick={() => setIsNewDocModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold shadow-sm hover:bg-primary/90 cursor-pointer self-start sm:self-auto"
                >
                  <Upload className="w-3.5 h-3.5" /> Subir Documento Normativo
                </button>
              )}
            </div>

            {docsLoading ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                Cargando repositorio documental…
              </div>
            ) : documentos.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No hay documentos oficiales cargados"
                description="Los reglamentos y protocolos oficiales publicados por el colegio aparecerán aquí para toda la comunidad."
              />
            ) : (
              <div className="divide-y divide-border">
                {documentos.map((doc) => (
                  <div
                    key={doc.id}
                    className="py-3.5 flex items-center justify-between gap-4 hover:bg-surface-2/40 px-3 rounded-lg transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-600 mt-0.5 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground">
                          {doc.titulo}
                        </div>
                        {doc.descripcion && (
                          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {doc.descripcion}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {doc.categoria}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Subido el{" "}
                            {new Date(doc.created_at).toLocaleDateString("es-CL", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    {doc.archivo_url && doc.archivo_url !== "#" ? (
                      <a
                        href={doc.archivo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border hover:bg-surface-2 rounded-lg text-xs font-semibold shadow-sm transition-colors text-foreground shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" /> Descargar
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground italic shrink-0">
                        En revisión
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Ver Publicación Completa */}
      {selectedPub && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      CATEGORIA_BADGE[selectedPub.categoria]?.bg
                    } ${CATEGORIA_BADGE[selectedPub.categoria]?.text} ${
                      CATEGORIA_BADGE[selectedPub.categoria]?.border
                    }`}
                  >
                    {CATEGORIA_BADGE[selectedPub.categoria]?.label}
                  </span>

                  {(selectedPub.destinatarios || []).includes("apoderados") && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      Canal: Familias y Apoderados
                    </span>
                  )}

                  {(selectedPub.destinatarios || []).includes("docentes") && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                      Canal: Trabajo Docente Interno
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-bold text-foreground leading-snug">
                  {selectedPub.titulo}
                </h2>

                <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">
                    Publicado por: {selectedPub.autor_nombre || "Institución"}
                  </span>
                  {selectedPub.autor_cargo && (
                    <span>({selectedPub.autor_cargo})</span>
                  )}
                  <span>•</span>
                  <span>
                    {new Date(selectedPub.fecha_publicacion).toLocaleDateString("es-CL", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPub(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cursos destinatarios si aplica */}
            {(selectedPub.cursos_destinatarios || []).length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg text-xs text-amber-800 dark:text-amber-200">
                <strong>Dirigido a los cursos:</strong>{" "}
                {selectedPub.cursos_destinatarios
                  .map((id) => cursoMap.get(id))
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}

            <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed py-2 pr-1">
              {selectedPub.contenido}
            </div>

            {/* Archivo adjunto */}
            {selectedPub.archivo_adjunto_url && (
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4" />
                  {selectedPub.nombre_adjunto || "Documento oficial adjunto"}
                </span>
                <a
                  href={selectedPub.archivo_adjunto_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold shadow-sm hover:bg-primary/90"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar Adjunto
                </a>
              </div>
            )}

            <div className="pt-3 border-t border-border flex items-center justify-between">
              <div>
                {lecturas.includes(selectedPub.id) ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Acuse de recibo registrado
                  </span>
                ) : (
                  <button
                    onClick={() => markReadMutation.mutate(selectedPub.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-emerald-700 cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> Confirmar Lectura como Apoderado/Docente
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedPub(null)}
                className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs font-semibold text-foreground cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear Nueva Publicación */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" /> Nueva Publicación en Intranet
              </h2>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePub} className="space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Selector de Canal / Propósito */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  ¿A quién va dirigida esta publicación? *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNuevoCanal("general")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      nuevoCanal === "general"
                        ? "bg-primary/10 border-primary text-primary font-bold shadow-sm"
                        : "bg-surface-2 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5">📢 General</div>
                    <div className="text-[10px] opacity-80 leading-tight">Toda la comunidad escolar</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNuevoCanal("apoderados")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      nuevoCanal === "apoderados"
                        ? "bg-amber-500/15 border-amber-500 text-amber-600 font-bold shadow-sm"
                        : "bg-surface-2 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5">👨‍👩‍👧‍👦 Apoderados</div>
                    <div className="text-[10px] opacity-80 leading-tight">Familias y cursos</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNuevoCanal("docentes")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      nuevoCanal === "docentes"
                        ? "bg-indigo-500/15 border-indigo-500 text-indigo-600 font-bold shadow-sm"
                        : "bg-surface-2 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5">🧑‍🏫 Trabajo Docente</div>
                    <div className="text-[10px] opacity-80 leading-tight">Equipo interno & UTP</div>
                  </button>
                </div>
              </div>

              {/* Sub-configuración si es Apoderados */}
              {nuevoCanal === "apoderados" && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2.5">
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    Alcance del Comunicado a Familias:
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="tipoApoderado"
                        checked={nuevoTipoApoderado === "todos"}
                        onChange={() => setNuevoTipoApoderado("todos")}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      Todos los apoderados del colegio
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="tipoApoderado"
                        checked={nuevoTipoApoderado === "especificos"}
                        onChange={() => setNuevoTipoApoderado("especificos")}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      Cursos específicos
                    </label>
                  </div>

                  {nuevoTipoApoderado === "especificos" && (
                    <div className="pt-1">
                      <div className="text-[11px] text-muted-foreground mb-1.5 font-medium">
                        Selecciona uno o más cursos:
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-2 bg-surface border border-border rounded-lg">
                        {cursos.map((c) => {
                          const checked = cursosSeleccionados.includes(c.id);
                          return (
                            <label
                              key={c.id}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer ${
                                checked ? "bg-amber-500/20 font-bold text-amber-700 dark:text-amber-300" : "hover:bg-surface-2"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setCursosSeleccionados([...cursosSeleccionados, c.id]);
                                  } else {
                                    setCursosSeleccionados(cursosSeleccionados.filter((id) => id !== c.id));
                                  }
                                }}
                                className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                              />
                              <span className="truncate">{c.nombre}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-configuración si es Trabajo Docente */}
              {nuevoCanal === "docentes" && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                    Área pedagógica o técnica:
                  </div>
                  <select
                    value={nuevoAmbito}
                    onChange={(e) => setNuevoAmbito(e.target.value as AmbitoDocente)}
                    className="w-full px-3 py-2 bg-surface border border-indigo-200 dark:border-indigo-900 rounded-lg text-xs font-semibold focus:outline-none"
                  >
                    <option value="consejo">Consejo de Profesores (Minuta, temario o acuerdos)</option>
                    <option value="utp">UTP & Currículum (Fechas clave, lineamientos, evaluaciones)</option>
                    <option value="departamento">Departamentos de Asignatura (Coordinación de área)</option>
                    <option value="convivencia">Convivencia e Inspectoría (Turnos, protocolos internos)</option>
                    <option value="general">General Docente</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Título de la Publicación *
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    nuevoCanal === "apoderados"
                      ? "Ej: Citación 1° Reunión de Apoderados 2026 - Salón de Actos"
                      : nuevoCanal === "docentes"
                      ? "Ej: Minuta Consejo Técnico N°3: Análisis Diagnóstico Integral (DIA)"
                      : "Ej: Circular N°2: Inicio de Talleres Extraprogramáticos"
                  }
                  value={nuevoTitulo}
                  onChange={(e) => setNuevoTitulo(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Categoría
                  </label>
                  <select
                    value={nuevaCat}
                    onChange={(e) => setNuevaCat(e.target.value as IntranetCategoria)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring capitalize"
                  >
                    <option value="comunicado">Comunicado</option>
                    <option value="circular">Circular Oficial</option>
                    <option value="urgente">Aviso Urgente</option>
                    <option value="noticia">Noticia</option>
                    <option value="evento">Evento</option>
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={nuevoFijado}
                      onChange={(e) => setNuevoFijado(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    Fijar en la parte superior
                  </label>
                </div>
              </div>

              {/* Firma del Autor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Nombre del Autor / Remitente
                  </label>
                  <input
                    type="text"
                    placeholder={defaultAutorNombre}
                    value={autorNombreInput}
                    onChange={(e) => setAutorNombreInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Cargo o Rol Institucional
                  </label>
                  <input
                    type="text"
                    placeholder={defaultAutorCargo}
                    value={autorCargoInput}
                    onChange={(e) => setAutorCargoInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Extracto o Resumen Breve (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Resumen de 1 o 2 líneas para la vista previa en la tarjeta"
                  value={nuevoExtracto}
                  onChange={(e) => setNuevoExtracto(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Contenido Completo *
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Escriba aquí los detalles del comunicado, circular o minuta docente…"
                  value={nuevoContenido}
                  onChange={(e) => setNuevoContenido(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>

              {/* Archivo adjunto */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Archivo Adjunto (Circular en PDF, pauta o minuta)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={(e) => setArchivoAdjuntoFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-muted-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-surface-3 file:text-foreground hover:file:bg-primary/20 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold shadow-sm hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Publicando en Intranet…" : "Publicar Ahora"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Subir Documento Normativo */}
      {isNewDocModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-600" /> Nuevo Documento Normativo
              </h2>
              <button
                onClick={() => setIsNewDocModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDoc} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Título del Documento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Reglamento Interno y de Convivencia Escolar (RICE 2026)"
                  value={docTitulo}
                  onChange={(e) => setDocTitulo(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Categoría
                </label>
                <select
                  value={docCategoria}
                  onChange={(e) => setDocCategoria(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="reglamento">Reglamento Interno (RICE)</option>
                  <option value="pei">Proyecto Educativo Institucional (PEI)</option>
                  <option value="evaluacion">Reglamento de Evaluación y Promoción</option>
                  <option value="protocolo">Protocolo de Convivencia y Accidentes</option>
                  <option value="pauta">Pautas y Formatos Oficiales</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Descripción o Alcance (opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Breve explicación de las normas o fecha de vigencia…"
                  value={docDesc}
                  onChange={(e) => setDocDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Archivo del Documento (PDF / Word)
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-muted-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-surface-3 file:text-foreground hover:file:bg-primary/20 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsNewDocModalOpen(false)}
                  className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingDoc}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-teal-700 disabled:opacity-50 cursor-pointer"
                >
                  {submittingDoc ? "Subiendo…" : "Guardar en Repositorio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
