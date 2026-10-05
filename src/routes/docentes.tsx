import { handleDbError } from "@/lib/db-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users, Link2, Unlink, MailQuestion } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/db-retry";
import { useAuth } from "@/lib/auth-context";
import { inviteOrLinkDocente } from "@/lib/docentes.functions";
import { PageHeader } from "@/components/PageHeader";
import { ColorPicker } from "@/components/ColorPicker";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/docentes")({
  head: () => ({ meta: [{ title: "Docentes — HorarioES" }] }),
  component: DocentesPage,
});

const CICLOS = ["prebásica", "1er ciclo", "2do ciclo"] as const;
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie"];

interface Docente {
  id: string;
  nombre: string;
  color: string;
  ciclos: string[];
  dias: number[];
  es_pie: boolean;
  horas_utp: number | null;
  user_id: string | null;
  invited_email: string | null;
}

function DocentesPage() {
  const { profile, session } = useAuth();
  const colegioId = profile?.colegio_id;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Docente | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Docente | null>(null);
  const [linking, setLinking] = useState<Docente | null>(null);
  const [linkEmail, setLinkEmail] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["docentes", colegioId],
    enabled: !!colegioId,
    queryFn: async () => {
      const { data, error } = await withRetry(() =>
        supabase
          .from("docentes")
          .select("id, nombre, color, ciclos, dias, es_pie, horas_utp, user_id, invited_email")
          .eq("colegio_id", colegioId!)
          .order("nombre")
      );
      if (error) throw error;
      return data as Docente[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (form: Partial<Docente>) => {
      const payload = {
        nombre: form.nombre, color: form.color, ciclos: form.ciclos,
        dias: form.dias, es_pie: form.es_pie, horas_utp: form.horas_utp,
      };
      if (editing) {
        const { error } = await supabase.from("docentes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("docentes").insert({ ...payload, colegio_id: colegioId! } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docentes", colegioId] });
      setOpen(false); setEditing(null);
      toast.success(editing ? "Docente actualizado" : "Docente creado");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("docentes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docentes", colegioId] });
      setToDelete(null);
      toast.success("Docente eliminado");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  const linkAccount = useMutation({
    mutationFn: async ({ docenteId, email }: { docenteId: string; email: string }) => {
      const cleaned = email.trim().toLowerCase();
      if (!cleaned) throw new Error("Ingresa un correo");
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Sesión expirada, vuelve a iniciar sesión");
      return await inviteOrLinkDocente({
        data: { accessToken, docenteId, colegioId: colegioId!, email: cleaned },
      });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["docentes", colegioId] });
      setLinking(null); setLinkEmail("");
      if (result.linked) {
        toast.success("Cuenta vinculada");
      } else {
        toast.success("Invitación enviada. El docente quedará vinculado al registrarse.");
      }
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  const unlinkAccount = useMutation({
    mutationFn: async (d: Docente) => {
      // Revoke linked user (if any)
      if (d.user_id) {
        const { error } = await supabase.from("docentes").update({ user_id: null }).eq("id", d.id);
        if (error) throw error;
        await supabase.from("user_roles")
          .delete().eq("user_id", d.user_id).eq("colegio_id", colegioId!).eq("role", "docente");
      }
      // Revoke pending invitation (if any)
      if (d.invited_email) {
        await supabase.from("docentes").update({ invited_email: null }).eq("id", d.id);
        await supabase.from("invitaciones")
          .delete()
          .eq("colegio_id", colegioId!)
          .ilike("email", d.invited_email)
          .eq("role", "docente")
          .is("accepted_at", null);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docentes", colegioId] });
      toast.success("Acceso retirado");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  return (
    <div>
      <PageHeader
        title="Docentes"
        subtitle="Profesores y profesoras del colegio"
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin docentes"
          description="Agrega docentes para asignarlos luego en horarios y planificaciones."
          action={<Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Crear docente</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((d) => (
            <div key={d.id} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold text-white"
                   style={{ background: d.color }}>
                {d.nombre.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-2">
                  {d.nombre}
                  {d.es_pie && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">PIE</span>}
                  {d.user_id && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Acceso</span>}
                  {!d.user_id && d.invited_email && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 flex items-center gap-1">
                      <MailQuestion className="w-3 h-3" /> Invitado
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {d.ciclos.join(" · ") || "Sin ciclos"}
                  {d.horas_utp ? ` · ${d.horas_utp}h UTP` : ""}
                  {!d.user_id && d.invited_email && ` · Pendiente: ${d.invited_email}`}
                </div>
              </div>
              {d.user_id || d.invited_email ? (
                <Button size="icon" variant="ghost" title={d.user_id ? "Quitar acceso" : "Cancelar invitación"} onClick={() => unlinkAccount.mutate(d)}>
                  <Unlink className="w-4 h-4" />
                </Button>
              ) : (
                <Button size="icon" variant="ghost" title="Invitar / vincular cuenta" onClick={() => { setLinking(d); setLinkEmail(""); }}>
                  <Link2 className="w-4 h-4" />
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => { setEditing(d); setOpen(true); }}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setToDelete(d)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <DocenteDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        initial={editing}
        onSubmit={(f) => upsert.mutate(f)}
        loading={upsert.isPending}
      />

      <Dialog open={!!linking} onOpenChange={(v) => { if (!v) { setLinking(null); setLinkEmail(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar / vincular cuenta a {linking?.nombre}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (linking) linkAccount.mutate({ docenteId: linking.id, email: linkEmail });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="link-email">Correo del docente</Label>
              <Input id="link-email" type="email" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} placeholder="docente@colegio.cl" autoFocus />
              <p className="text-xs text-muted-foreground">
                Si el correo ya tiene cuenta en HorarioES, se vincula al instante.
                Si no, se enviará una invitación y el docente quedará vinculado
                automáticamente al registrarse con ese correo.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { setLinking(null); setLinkEmail(""); }}>Cancelar</Button>
              <Button type="submit" disabled={linkAccount.isPending || !linkEmail.trim()}>
                {linkAccount.isPending ? "Procesando…" : "Invitar / vincular"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{toDelete?.nombre}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán también las celdas de horario asociadas a este docente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && remove.mutate(toDelete.id)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DocenteDialog({
  open, onOpenChange, initial, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Docente | null;
  onSubmit: (f: Partial<Docente>) => void;
  loading: boolean;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [color, setColor] = useState(initial?.color ?? "#4f8ef7");
  const [ciclos, setCiclos] = useState<string[]>(initial?.ciclos ?? []);
  const [dias, setDias] = useState<number[]>(initial?.dias ?? [0, 1, 2, 3, 4]);
  const [esPie, setEsPie] = useState(initial?.es_pie ?? false);
  const [horasUtp, setHorasUtp] = useState<string>(initial?.horas_utp?.toString() ?? "");

  const toggleCiclo = (c: string) =>
    setCiclos((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  const toggleDia = (i: number) =>
    setDias((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar docente" : "Nuevo docente"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nombre.trim()) return;
            onSubmit({
              nombre: nombre.trim(), color, ciclos, dias, es_pie: esPie,
              horas_utp: horasUtp ? Number(horasUtp) : null,
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="María González" autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="space-y-2">
            <Label>Ciclos</Label>
            <div className="flex flex-col gap-2">
              {CICLOS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={ciclos.includes(c)} onCheckedChange={() => toggleCiclo(c)} />
                  <span className="capitalize">{c}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Días que trabaja</Label>
            <div className="flex gap-2 flex-wrap">
              {DIAS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDia(i)}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    dias.includes(i)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent border-border hover:bg-surface"
                  }`}
                >{d}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label className="cursor-pointer">Docente PIE</Label>
              <p className="text-xs text-muted-foreground">Programa de Integración Escolar</p>
            </div>
            <Switch checked={esPie} onCheckedChange={setEsPie} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="utp">Horas UTP <span className="text-muted-foreground">(opcional)</span></Label>
            <Input id="utp" type="number" min={0} value={horasUtp} onChange={(e) => setHorasUtp(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading || !nombre.trim()}>
              {loading ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
