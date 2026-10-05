import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ExternalLink, Power } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkSuperadmin, listColegios, createColegio, toggleColegioActivo,
} from "@/lib/tenant.functions";

export const Route = createFileRoute("/superadmin")({
  head: () => ({ meta: [{ title: "Superadmin — HorarioES" }] }),
  component: SuperadminPage,
});

function SuperadminPage() {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const qc = useQueryClient();

  const { data: chk, isLoading: checking } = useQuery({
    queryKey: ["is-superadmin"],
    enabled: !!accessToken,
    queryFn: () => checkSuperadmin({ data: { accessToken: accessToken! } }),
  });

  const { data: colegios } = useQuery({
    queryKey: ["all-colegios"],
    enabled: !!accessToken && !!chk?.isSuperadmin,
    queryFn: () => listColegios({ data: { accessToken: accessToken! } }),
  });

  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  const create = useMutation({
    mutationFn: async () => createColegio({
      data: { accessToken: accessToken!, nombre, slug, adminEmail: adminEmail || undefined },
    }),
    onSuccess: () => {
      toast.success("Colegio creado");
      setNombre(""); setSlug(""); setAdminEmail("");
      qc.invalidateQueries({ queryKey: ["all-colegios"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const toggle = useMutation({
    mutationFn: async (v: { id: string; activo: boolean }) =>
      toggleColegioActivo({ data: { accessToken: accessToken!, id: v.id, activo: v.activo } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-colegios"] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (checking) return <div className="p-8"><Loader2 className="animate-spin" /></div>;
  if (!chk?.isSuperadmin) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold">Acceso denegado</h1>
        <p className="text-sm text-muted-foreground mt-2">Solo superadmin puede acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Superadmin" subtitle="Gestión global de colegios" />

      <div className="grid gap-6 max-w-3xl">
        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Crear colegio</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Colegio Porvenir" />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="porvenir" />
            </div>
            <div className="sm:col-span-2">
              <Label>Email del admin (opcional, se invita)</Label>
              <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@colegio.cl" />
            </div>
          </div>
          <Button className="mt-4" disabled={!nombre || !slug || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Crear colegio
          </Button>
        </section>

        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Colegios ({colegios?.length ?? 0})</h2>
          <div className="space-y-2">
            {colegios?.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-surface-2 rounded-md">
                <Link
                  to="/superadmin/$id"
                  params={{ id: c.id }}
                  className="flex-1 min-w-0 hover:opacity-80"
                >
                  <div className="font-medium">{c.nombre} {!c.activo && <span className="text-xs text-muted-foreground ml-2">(inactivo)</span>}</div>
                  <div className="text-xs text-muted-foreground">/{c.slug}</div>
                </Link>
                <div className="flex items-center gap-2">
                  <Link to="/c/$slug/login" params={{ slug: c.slug }} className="text-primary hover:underline text-sm flex items-center gap-1">
                    Login <ExternalLink className="w-3 h-3" />
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => toggle.mutate({ id: c.id, activo: !c.activo })}>
                    <Power className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {(!colegios || colegios.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-6">Sin colegios todavía</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
