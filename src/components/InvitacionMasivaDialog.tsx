import { useState, useMemo } from "react";
import {
  Mail,
  Send,
  Download,
  Copy,
  Check,
  AlertCircle,
  Users,
  Search,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { exportXLSX } from "@/lib/export";
import { inviteDocentesBulk } from "@/lib/docentes.functions";

export interface DocenteItem {
  id: string;
  nombre: string;
  color: string;
  user_id: string | null;
  invited_email: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docentes: DocenteItem[];
  colegioId: string;
  colegioNombre?: string;
  accessToken?: string;
  onSuccess: () => void;
}

export function InvitacionMasivaDialog({
  open,
  onOpenChange,
  docentes,
  colegioId,
  colegioNombre,
  accessToken,
  onSuccess,
}: Props) {
  // Lista de docentes sin cuenta activa
  const docentesSinCuenta = useMemo(
    () => docentes.filter((d) => !d.user_id),
    [docentes]
  );

  // Mapa de correos editables por docenteId
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resultados tras enviar invitaciones
  const [results, setResults] = useState<
    Array<{
      docenteId: string;
      nombre: string;
      email: string;
      status: "linked" | "invited" | "error";
      token?: string;
      message?: string;
    }> | null
  >(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Inicializar o sincronizar emails con los invited_email existentes cuando se abre el modal
  const handleOpenChange = (v: boolean) => {
    if (v) {
      const initial: Record<string, string> = {};
      for (const d of docentesSinCuenta) {
        if (d.invited_email) {
          initial[d.id] = d.invited_email;
        }
      }
      setEmails(initial);
      setResults(null);
      setSearchTerm("");
    }
    onOpenChange(v);
  };

  const filteredDocentes = useMemo(() => {
    if (!searchTerm.trim()) return docentesSinCuenta;
    const term = searchTerm.toLowerCase();
    return docentesSinCuenta.filter(
      (d) =>
        d.nombre.toLowerCase().includes(term) ||
        (emails[d.id] ?? "").toLowerCase().includes(term)
    );
  }, [docentesSinCuenta, searchTerm, emails]);

  // Cantidad de correos válidos listos para invitar
  const validEmailCount = useMemo(() => {
    return Object.values(emails).filter((e) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
    ).length;
  }, [emails]);

  const handleEmailChange = (docenteId: string, value: string) => {
    setEmails((prev) => ({
      ...prev,
      [docenteId]: value,
    }));
  };

  // Manejar pegado de lista de correos (ej. copiado desde Excel)
  const handlePasteList = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    if (!text) return;

    // Reconocer líneas del estilo "Nombre, correo" o solo "correo"
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const newEmails = { ...emails };
    let matched = 0;

    for (const line of lines) {
      const parts = line.split(/[,\t;]/).map((p) => p.trim());
      const emailCandidate = parts.find((p) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)
      );

      if (emailCandidate) {
        // Intentar emparejar por nombre si viene en la línea
        const nameCandidate = parts.find((p) => p !== emailCandidate);
        if (nameCandidate) {
          const found = docentesSinCuenta.find((d) =>
            d.nombre.toLowerCase().includes(nameCandidate.toLowerCase())
          );
          if (found) {
            newEmails[found.id] = emailCandidate.toLowerCase();
            matched++;
            continue;
          }
        }

        // Si no viene nombre, asignar al primer docente sin correo aún
        const emptyDoc = docentesSinCuenta.find((d) => !newEmails[d.id]);
        if (emptyDoc) {
          newEmails[emptyDoc.id] = emailCandidate.toLowerCase();
          matched++;
        }
      }
    }

    setEmails(newEmails);
    if (matched > 0) {
      toast.success(`Se asociaron ${matched} correos desde el portapapeles`);
    } else {
      toast.error("No se detectaron correos válidos en el texto pegado");
    }
  };

  const handleSendInvitations = async () => {
    if (!accessToken) {
      toast.error("Sesión no válida o expirada");
      return;
    }

    const itemsToInvite = Object.entries(emails)
      .map(([docenteId, email]) => ({
        docenteId,
        email: email.trim().toLowerCase(),
      }))
      .filter((it) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(it.email));

    if (itemsToInvite.length === 0) {
      toast.error("Ingresa al menos un correo electrónico válido");
      return;
    }

    setIsSubmitting(true);
    try {
      const resp = await inviteDocentesBulk({
        data: {
          accessToken,
          colegioId,
          items: itemsToInvite,
        },
      });

      // Mapear con nombres
      const enriched = resp.map((r) => {
        const doc = docentes.find((d) => d.id === r.docenteId);
        return {
          ...r,
          nombre: doc?.nombre ?? "Docente",
        };
      });

      setResults(enriched);
      toast.success(
        `Se procesaron ${resp.length} invitaciones correctamente`
      );
      onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al procesar invitaciones"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInvitationUrl = (token?: string) => {
    if (!token) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://horarioes.cloud";
    return `${origin}/invitacion/${token}`;
  };

  const handleCopyLink = (id: string, token?: string) => {
    if (!token) return;
    const url = getInvitationUrl(token);
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Enlace copiado al portapapeles");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleExportResults = () => {
    if (!results) return;
    const dataToExport = results.map((r) => ({
      Docente: r.nombre,
      Correo: r.email,
      Estado:
        r.status === "linked"
          ? "Cuenta activa vinculada"
          : r.status === "invited"
          ? "Invitación generada (pendiente clave)"
          : `Error: ${r.message ?? "No enviado"}`,
      "Enlace de Activación": r.token ? getInvitationUrl(r.token) : "-",
    }));

    exportXLSX(dataToExport, `Invitaciones_Docentes_${colegioNombre ?? "Colegio"}`);
    toast.success("Listado de invitaciones descargado en Excel");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6 gap-4">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Mail className="w-5 h-5 text-primary" />
            Invitación Masiva para Docentes
          </DialogTitle>
          <DialogDescription>
            {results
              ? "Las invitaciones fueron generadas con éxito. Puedes copiar o descargar los enlaces de activación para compartirlos con cada docente."
              : "Asigna los correos electrónicos institucionales de los docentes para generar sus enlaces únicos de activación, donde ellos mismos crearán su contraseña."}
          </DialogDescription>
        </DialogHeader>

        {/* --- VISTA TRAS ENVIAR (RESULTADOS Y ENLACES) --- */}
        {results ? (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="p-3 rounded-lg bg-surface-2 border border-border flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-foreground">
                  {results.filter((r) => r.status === "invited").length} invitaciones listas
                </span>
                {" · "}
                <span className="text-emerald-400 font-medium">
                  {results.filter((r) => r.status === "linked").length} vinculados al instante
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportResults}
                className="gap-1.5 text-xs h-8"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Descargar Excel con Enlaces
              </Button>
            </div>

            <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
              {results.map((res) => (
                <div
                  key={res.docenteId}
                  className="p-3 bg-surface flex items-center justify-between gap-3 text-sm hover:bg-surface-2/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate flex items-center gap-2">
                      {res.nombre}
                      {res.status === "linked" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Vinculado
                        </span>
                      )}
                      {res.status === "invited" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                          Listo para activar
                        </span>
                      )}
                      {res.status === "error" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive font-medium">
                          {res.message}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{res.email}</div>
                  </div>

                  {res.token && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant={copiedId === res.docenteId ? "default" : "outline"}
                        onClick={() => handleCopyLink(res.docenteId, res.token)}
                        className="h-8 text-xs gap-1.5"
                      >
                        {copiedId === res.docenteId ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copiar Enlace
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* --- VISTA DE FORMULARIO DE CORREOS --- */
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Buscador y opciones rápidas */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar docente por nombre o correo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <div className="text-xs text-muted-foreground shrink-0 self-center">
                {validEmailCount} de {docentesSinCuenta.length} con correo listo
              </div>
            </div>

            {/* Cuadro colapsable / sugerencia de pegado masivo */}
            <details className="text-xs group border border-border/70 rounded-lg p-2.5 bg-surface-2/40">
              <summary className="font-medium cursor-pointer text-muted-foreground hover:text-foreground flex items-center justify-between">
                <span>¿Tienes una lista o planilla Excel con los correos? Pégalos aquí</span>
                <span className="text-[10px] text-primary group-open:hidden">Abrir pegador</span>
              </summary>
              <div className="mt-2.5 space-y-2">
                <textarea
                  rows={3}
                  onPaste={handlePasteList}
                  placeholder="Pega aquí filas copiadas de Excel (ej: María Pérez, maria@colegio.cl) y se completarán automáticamente abajo..."
                  className="w-full p-2 bg-input border border-border rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  El sistema detecta automáticamente los correos electrónicos pegados y los asocia a los docentes correspondientes.
                </p>
              </div>
            </details>

            {/* Listado de docentes para asignar correo */}
            <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
              {filteredDocentes.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  {docentesSinCuenta.length === 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      <span className="font-medium">¡Todos los docentes ya tienen una cuenta vinculada!</span>
                    </div>
                  ) : (
                    "No se encontraron docentes con ese filtro."
                  )}
                </div>
              ) : (
                filteredDocentes.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-surface-2/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-[200px]">
                      <div
                        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold text-white"
                        style={{ background: d.color }}
                      >
                        {d.nombre
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div className="truncate">
                        <div className="font-medium text-xs truncate">{d.nombre}</div>
                        {d.invited_email && (
                          <div className="text-[10px] text-amber-400 truncate">
                            Invitación previa: {d.invited_email}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 sm:max-w-xs">
                      <Input
                        type="email"
                        placeholder="correo@colegio.cl"
                        value={emails[d.id] ?? ""}
                        onChange={(e) => handleEmailChange(d.id, e.target.value)}
                        className="h-8 text-xs bg-input"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 flex items-center justify-between sm:justify-between border-t border-border pt-3">
          <div className="text-xs text-muted-foreground">
            {!results && (
              <span>Cada docente recibirá un link seguro para crear su contraseña.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
            >
              {results ? "Cerrar" : "Cancelar"}
            </Button>
            {!results && (
              <Button
                type="button"
                disabled={isSubmitting || validEmailCount === 0}
                onClick={handleSendInvitations}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                {isSubmitting
                  ? "Procesando..."
                  : `Generar ${validEmailCount} Invitaciones`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
