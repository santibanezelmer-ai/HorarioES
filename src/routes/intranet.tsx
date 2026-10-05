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
  Filter,
  Eye,
  X,
  Upload,
  BookOpen,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useUserRoles } from "@/lib/use-role";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import type {
  IntranetPublicacion,
  IntranetDocumento,
  IntranetCategoria,
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

function IntranetPage() {
  const { profile, user } = useAuth();
  const colegioId = profile?.colegio_id;
  const { data: roles = [] } = useUserRoles();
  const queryClient = useQueryClient();

  const canPublish = roles.some((r) =>
    ["admin", "direccion", "utp", "superadmin"].includes(r.role)
  );

  const [tab, setTab] = useState<"muro" | "documentos">("muro");
  const [catFilter, setCatFilter] = useState<string>("todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPub, setSelectedPub] = useState<IntranetPublicacion | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Formulario nueva publicación
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [nuevoExtracto, setNuevoExtracto] = useState("");
  const [nuevoContenido, setNuevoContenido] = useState("");
  const [nuevaCat, setNuevaCat] = useState<IntranetCategoria>("comunicado");
  const [nuevoFijado, setNuevoFijado] = useState(false);
  const [nuevosDestinatarios, setNuevosDestinatarios] = useState<string[]>(["todos"]);
  const [submitting, setSubmitting] = useState(false);

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

  // Mutación para confirmar lectura
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
      toast.success("Lectura confirmada");
    },
  });

  // Filtrado de publicaciones
  const filteredPubs = useMemo(() => {
    return publicaciones.filter((p) => {
      if (catFilter !== "todas" && p.categoria !== catFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchTitle = p.titulo.toLowerCase().includes(term);
        const matchContent = p.contenido.toLowerCase().includes(term);
        if (!matchTitle && !matchContent) return false;
      }
      return true;
    });
  }, [publicaciones, catFilter, searchTerm]);

  // Manejar creación de publicación
  const handleCreatePub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTitulo.trim() || !nuevoContenido.trim() || !colegioId) {
      toast.error("Por favor completa el título y contenido");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("intranet_publicaciones").insert({
        colegio_id: colegioId,
        autor_id: user?.id,
        titulo: nuevoTitulo.trim(),
        extracto: nuevoExtracto.trim() || null,
        contenido: nuevoContenido.trim(),
        categoria: nuevaCat,
        fijado: nuevoFijado,
        destinatarios: nuevosDestinatarios,
      });
      if (error) throw error;

      toast.success("Publicación creada exitosamente");
      setIsNewModalOpen(false);
      setNuevoTitulo("");
      setNuevoExtracto("");
      setNuevoContenido("");
      setNuevoFijado(false);
      setNuevosDestinatarios(["todos"]);
      queryClient.invalidateQueries({ queryKey: ["intranet-publicaciones"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al publicar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Intranet Institucional"
        subtitle="Comunicados, circulares oficiales y documentos normativos de la comunidad escolar"
        actions={
          canPublish && (
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-primary-foreground font-medium rounded-lg text-sm shadow-elegant hover:bg-primary/90 transition-all"
            >
              <Plus className="w-4 h-4" />
              Nueva Publicación
            </button>
          )
        }
      />

      {/* Tabs Principales */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setTab("muro")}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 -mb-px ${
            tab === "muro"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Newspaper className="w-4 h-4" />
          Muro de Comunicados ({publicaciones.length})
        </button>
        <button
          onClick={() => setTab("documentos")}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 -mb-px ${
            tab === "documentos"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Documentos y Reglamentos ({documentos.length})
        </button>
      </div>

      {tab === "muro" ? (
        <div className="space-y-5">
          {/* Barra de Búsqueda y Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar comunicado o circular…"
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
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
            <div className="text-sm text-muted-foreground py-8 text-center">
              Cargando publicaciones…
            </div>
          ) : filteredPubs.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="No hay comunicados disponibles"
              description="No se encontraron publicaciones con los filtros seleccionados."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPubs.map((pub) => {
                const catStyle = CATEGORIA_BADGE[pub.categoria] || CATEGORIA_BADGE.comunicado;
                const isRead = lecturas.includes(pub.id);

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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                          >
                            {catStyle.label}
                          </span>
                          {pub.fijado && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              <Pin className="w-3 h-3 rotate-45" /> Fijado
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(pub.fecha_publicacion).toLocaleDateString("es-CL", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      {/* Título y extracto */}
                      <h3 className="font-bold text-base text-foreground mb-1.5 leading-snug">
                        {pub.titulo}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
                        {pub.extracto || pub.contenido}
                      </p>
                    </div>

                    {/* Pie de la tarjeta */}
                    <div className="pt-3 border-t border-border flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2">
                        {isRead ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Leído
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Sin leer
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedPub(pub);
                            if (!isRead) markReadMutation.mutate(pub.id);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-surface-2 hover:bg-surface-3 rounded-md transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> Leer completo
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
        /* Pestaña: Documentos Institucionales */
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-sm text-foreground mb-1">
              Repositorio de Documentos Normativos
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Reglamentos, manuales de convivencia escolar, protocolos y proyectos educativos oficiales.
            </p>

            {docsLoading ? (
              <div className="text-xs text-muted-foreground py-4">Cargando documentos…</div>
            ) : documentos.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No hay documentos cargados"
                description="Los documentos oficiales publicados por el colegio aparecerán aquí."
              />
            ) : (
              <div className="divide-y divide-border">
                {documentos.map((doc) => (
                  <div
                    key={doc.id}
                    className="py-3 flex items-center justify-between gap-4 hover:bg-surface-2/40 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
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
                        <span className="inline-block mt-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {doc.categoria}
                        </span>
                      </div>
                    </div>
                    {doc.archivo_url && doc.archivo_url !== "#" ? (
                      <a
                        href={doc.archivo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border hover:bg-surface-2 rounded-md text-xs font-semibold shadow-sm transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Descargar
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">En revisión</span>
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
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border mb-2 ${
                    CATEGORIA_BADGE[selectedPub.categoria]?.bg
                  } ${CATEGORIA_BADGE[selectedPub.categoria]?.text} ${
                    CATEGORIA_BADGE[selectedPub.categoria]?.border
                  }`}
                >
                  {CATEGORIA_BADGE[selectedPub.categoria]?.label}
                </span>
                <h2 className="text-lg font-bold text-foreground leading-snug">
                  {selectedPub.titulo}
                </h2>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                  <span>
                    Fecha:{" "}
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
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed py-2 pr-1">
              {selectedPub.contenido}
            </div>

            {selectedPub.archivo_adjunto_url && (
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  {selectedPub.nombre_adjunto || "Documento adjunto"}
                </span>
                <a
                  href={selectedPub.archivo_adjunto_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold shadow-sm hover:bg-primary/90"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar
                </a>
              </div>
            )}

            <div className="pt-3 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedPub(null)}
                className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs font-semibold transition-colors"
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
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePub} className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Título de la Publicación *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Circular N°2: Inicio de Talleres Extraprogramáticos"
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

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Extracto o Resumen Breve
                </label>
                <input
                  type="text"
                  placeholder="Resumen de 1 o 2 líneas para la vista previa"
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
                  rows={6}
                  placeholder="Escriba aquí el cuerpo del comunicado o circular institucional…"
                  value={nuevoContenido}
                  onChange={(e) => setNuevoContenido(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold shadow-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Publicando…" : "Publicar Comunicado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
