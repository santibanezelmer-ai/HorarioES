import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, ArrowLeft, Save, Power, Trash2, Mail, Phone, User,
  Calendar, Users, GraduationCap, BookOpen, Send,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkSuperadmin, getColegioDetail, updateColegio, toggleColegioActivo, deleteColegio,
} from "@/lib/tenant.functions";

export const Route = createFileRoute("/superadmin/$id")({
  head: () => ({ meta: [{ title: "Organización — Superadmin" }] }),
  component: ColegioDetailPage,
});

function ColegioDetailPage() {
  const { id } = Route.useParams();
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: chk, isLoading: checking } = useQuery({
    queryKey: ["is-superadmin"],
    enabled: !!accessToken,
    queryFn: () => checkSuperadmin({ data: { accessToken: accessToken! } }),
  });

  const { data: detail, isLoading } = useQuery({
    queryKey: ["colegio-detail", id],
    enabled: !!accessToken && !!chk?.isSuperadmin,
    queryFn: () => getColegioDetail({ data: { accessToken: accessToken!, id } }),
  });

  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");

  const c = detail?.colegio;
  const initNombre = c?.nombre ?? "";
  const initSlug = c?.slug ?? "";
  if (!editing && (nombre !== initNombre || slug !== initSlug) && c) {
    setNombre(initNombre); setSlug(initSlug);
  }

  const save = useMutation({
    mutationFn: () => updateColegio({
      data: { accessToken: accessToken!, id, nombre, slug },
    }),
    onSuccess: () => {
      toast.success("Cambios guardados");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["colegio-detail", id] });
      qc.invalidateQueries({ queryKey: ["all-colegios"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const toggle = useMutation({
    mutationFn: (activo: boolean) =>
      toggleColegioActivo({ data: { accessToken: accessToken!, id, activo } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["colegio-detail", id] });
      qc.invalidateQueries({ queryKey: ["all-colegios"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const remove = useMutation({
    mutationFn: () => deleteColegio({
      data: { accessToken: accessToken!, id, confirmSlug },
    }),
    onSuccess: () => {
      toast.success("Organización eliminada");
      qc.invalidateQueries({ queryKey: ["all-colegios"] });
      navigate({ to: "/superadmin" });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (checking || isLoading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;
  if (!chk?.isSuperadmin) {
    return <div className="p-8"><h1 className="text-xl font-bold">Acceso denegado</h1></div>;
  }
  if (!detail || !c) return <div className="p-8">No encontrado</div>;

  const fmt = (d: string | null) => d ? new Date(d).toLocaleString() : "—";

  return (
    <div>
      <div className="mb-4">
        <Link to="/superadmin" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
      </div>
      <PageHeader
        title={c.nombre}
        subtitle={`/${c.slug}${c.activo ? "" : " · inactivo"}`}
      />

      <div className="grid gap-6 max-w-3xl">
        {/* Datos generales */}
        <section className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Datos generales</h2>
            {!editing ? (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Editar</Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setNombre(initNombre); setSlug(initSlug); }}>
                  Cancelar
                </Button>
                <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
                  {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Guardar
                </Button>
              </div>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Nombre</Label>
              <Input value={nombre} disabled={!editing} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={slug} disabled={!editing} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
            </div>
            <div className="sm:col-span-2 text-xs text-muted-foreground flex items-center gap-2 pt-1">
              <Calendar className="w-3.5 h-3.5" /> Creada: {fmt(c.created_at)} · Actualizada: {fmt(c.updated_at)}
            </div>
          </div>
        </section>

        {/* Admin propietario */}
        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Administrador propietario</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /> {detail.owner.name ?? "—"}</div>
            <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /> {detail.owner.email ?? "—"}</div>
            <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> {detail.owner.phone ?? "—"}</div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs pt-1">
              <Calendar className="w-3.5 h-3.5" /> Último acceso: {fmt(detail.owner.lastSignInAt)}
            </div>
          </div>
        </section>

        {/* Resumen */}
        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Resumen</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat icon={<Users className="w-4 h-4" />} label="Miembros" value={detail.counts.miembros} />
            <Stat icon={<GraduationCap className="w-4 h-4" />} label="Docentes" value={detail.counts.docentes} />
            <Stat icon={<BookOpen className="w-4 h-4" />} label="Cursos" value={detail.counts.cursos} />
            <Stat icon={<Send className="w-4 h-4" />} label="Invit. pendientes" value={detail.counts.invitacionesPendientes} />
          </div>
        </section>

        {/* Acciones administrativas */}
        <section className="bg-surface border border-destructive/30 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Acciones administrativas</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-sm">{c.activo ? "Desactivar organización" : "Activar organización"}</div>
                <div className="text-xs text-muted-foreground">
                  {c.activo ? "Bloquea el acceso de todos sus usuarios." : "Reanuda el acceso a la organización."}
                </div>
              </div>
              <Button variant="outline" size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate(!c.activo)}>
                <Power className="w-4 h-4 mr-2" /> {c.activo ? "Desactivar" : "Activar"}
              </Button>
            </div>

            <div className="border-t border-border pt-3">
              <div className="font-medium text-sm text-destructive">Eliminar organización</div>
              <div className="text-xs text-muted-foreground mb-2">
                Esta acción es permanente. Escribe el slug <code className="px-1 bg-surface-2 rounded">{c.slug}</code> para confirmar.
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={c.slug}
                  value={confirmSlug}
                  onChange={(e) => setConfirmSlug(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={remove.isPending || confirmSlug.trim().toLowerCase() !== c.slug.toLowerCase()}
                  onClick={() => remove.mutate()}
                >
                  {remove.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Eliminar
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-surface-2 rounded-md p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
