import { handleDbError } from "@/lib/db-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Plus, Trash2, UserCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createDocenteReemplazante, createReemplazo, deleteReemplazo, getReemplazosData } from "@/lib/reemplazos.functions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/reemplazos")({
  head: () => ({ meta: [{ title: "Reemplazos — HorarioES" }] }),
  component: ReemplazosPage,
});

interface Reemp {
  id: string;
  docente_id: string;
  titular_id: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  observaciones: string | null;
}

function ReemplazosPage() {
  const { profile, session } = useAuth();
  const accessToken = session?.access_token;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const replacementsQuery = useQuery({
    queryKey: ["reemplazos-data", profile?.user_id],
    enabled: !!accessToken,
    retry: false,
    queryFn: async () => getReemplazosData({ data: { accessToken: accessToken! } }),
  });

  const colegioId = profile?.colegio_id ?? replacementsQuery.data?.colegioId;
  const items = (replacementsQuery.data?.reemplazos ?? []) as Reemp[];
  const docentes = (replacementsQuery.data?.docentes ?? []) as { id: string; nombre: string; color: string }[];
  const isLoading = replacementsQuery.isLoading || (!accessToken && !replacementsQuery.isError);

  const dMap = Object.fromEntries(docentes.map((d) => [d.id, d]));

  const create = useMutation({
    mutationFn: async (payload: {
      reemplazo: Partial<Reemp>;
      newDocente?: { nombre: string; color: string };
    }) => {
      if (!accessToken) throw new Error("Sesión no disponible");
      let docenteId = payload.reemplazo.docente_id;
      if (payload.newDocente) {
        const created = await createDocenteReemplazante({
          data: { accessToken, docente: payload.newDocente },
        });
        docenteId = created.id;
      }
      await createReemplazo({
        data: { accessToken, reemplazo: { ...payload.reemplazo, docente_id: docenteId } as Reemp },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reemplazos-data", profile?.user_id] });
      setOpen(false);
      toast.success("Reemplazo registrado");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) throw new Error("Sesión no disponible");
      await deleteReemplazo({ data: { accessToken, id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reemplazos-data", profile?.user_id] });
      toast.success("Eliminado");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  const today = new Date().toISOString().slice(0, 10);
  const isActive = (r: Reemp) => r.fecha_inicio <= today && today <= r.fecha_fin;

  return (
    <div>
      <PageHeader
        title="Reemplazos"
        subtitle="Reemplazantes y suplencias"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : replacementsQuery.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="space-y-3">
              <p>No se pudieron cargar los reemplazos. La conexión respondió de forma intermitente.</p>
              <Button size="sm" variant="outline" onClick={() => replacementsQuery.refetch()} disabled={replacementsQuery.isFetching}>
                Reintentar
              </Button>
            </div>
          </div>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="Sin reemplazos"
          description="Registra suplencias o reemplazos cuando un docente se ausenta."
          action={<Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Crear primero
          </Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((r) => {
            const reemp = dMap[r.docente_id];
            const tit = r.titular_id ? dMap[r.titular_id] : null;
            const active = isActive(r);
            return (
              <div key={r.id} className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: reemp?.color }} />
                      <span className="font-medium">{reemp?.nombre ?? "—"}</span>
                      {active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-500 font-semibold">
                          ACTIVO
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Reemplaza a <strong className="text-foreground">{tit?.nombre ?? "(sin titular)"}</strong>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {r.fecha_inicio} → {r.fecha_fin}
                    </div>
                    {r.observaciones && <p className="text-xs text-muted-foreground mt-2">{r.observaciones}</p>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ReempDialog
        open={open}
        onClose={() => setOpen(false)}
        docentes={docentes}
        onSubmit={(f) => create.mutate(f)}
        loading={create.isPending}
      />
    </div>
  );
}

type SubmitPayload = {
  reemplazo: Partial<Reemp>;
  newDocente?: { nombre: string; color: string };
};

function ReempDialog({ open, onClose, docentes, onSubmit, loading }: {
  open: boolean; onClose: () => void;
  docentes: { id: string; nombre: string }[];
  onSubmit: (f: SubmitPayload) => void;
  loading: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState<"existing" | "new">(
    docentes.length === 0 ? "new" : "existing",
  );
  const [docId, setDocId] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#4f8ef7");
  const [titId, setTitId] = useState<string>("__none__");
  const [ini, setIni] = useState(today);
  const [fin, setFin] = useState(today);
  const [obs, setObs] = useState("");

  const canSubmit =
    mode === "existing" ? !!docId : newName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo reemplazo</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            const base: Partial<Reemp> = {
              titular_id: titId === "__none__" ? null : titId,
              fecha_inicio: ini,
              fecha_fin: fin,
              observaciones: obs || null,
            };
            if (mode === "existing") {
              onSubmit({ reemplazo: { ...base, docente_id: docId } });
            } else {
              onSubmit({
                reemplazo: base,
                newDocente: { nombre: newName.trim(), color: newColor },
              });
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Reemplazante</Label>
            <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`px-3 py-1 rounded ${mode === "existing" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                disabled={docentes.length === 0}
              >
                Docente existente
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`px-3 py-1 rounded ${mode === "new" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Crear nuevo
              </button>
            </div>

            {mode === "existing" ? (
              <Select value={docId} onValueChange={setDocId}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>{docentes.map((d) => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  placeholder="Nombre del docente reemplazante"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={120}
                />
                <Input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-12 p-1 h-9"
                  aria-label="Color"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Titular reemplazado</Label>
            <Select value={titId} onValueChange={setTitId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin titular</SelectItem>
                {docentes.map((d) => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            {mode === "new" && (
              <p className="text-xs text-muted-foreground">
                El nuevo docente tomará la carga académica del titular seleccionado.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Desde</Label>
              <Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !canSubmit}>{loading ? "Guardando…" : "Crear"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
