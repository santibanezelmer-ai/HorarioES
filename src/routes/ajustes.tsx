import { handleDbError } from "@/lib/db-errors";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getColegioData, updateColegio } from "@/lib/school.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/ajustes")({
  head: () => ({ meta: [{ title: "Ajustes — HorarioES" }] }),
  component: AjustesPage,
});

function AjustesPage() {
  const { profile, refreshProfile, session } = useAuth();
  const colegioId = profile?.colegio_id;
  const accessToken = session?.access_token;
  const qc = useQueryClient();

  const { data: colegio } = useQuery({
    queryKey: ["colegio", colegioId],
    enabled: !!accessToken,
    retry: false,
    queryFn: async () => getColegioData({ data: { accessToken: accessToken! } }),
  });

  const [nombre, setNombre] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (colegio) {
      setNombre(colegio.nombre ?? "");
      setLogoUrl(colegio.logo_url ?? "");
    }
  }, [colegio]);

  useEffect(() => {
    if (profile) setDisplayName(profile.display_name ?? "");
  }, [profile]);

  const saveColegio = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Sesión no disponible");
      await updateColegio({ data: { accessToken, colegio: { nombre, logo_url: logoUrl.trim() || null } } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["colegio", colegioId] });
      toast.success("Colegio actualizado");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() })
        .eq("user_id", profile!.user_id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      toast.success("Perfil actualizado");
    },
    onError: (e: unknown) => toast.error(handleDbError(e)),
  });

  return (
    <div>
      <PageHeader title="Ajustes" subtitle="Información del colegio y de tu perfil" />

      <div className="grid gap-6 max-w-2xl">
        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Colegio</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cnombre">Nombre</Label>
              <Input id="cnombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clogo">URL del logo (opcional)</Label>
              <Input id="clogo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
              {logoUrl && (
                <img src={logoUrl} alt="logo" className="h-16 mt-2 rounded border border-border object-contain bg-white p-1" />
              )}
            </div>
            <Button onClick={() => saveColegio.mutate()} disabled={saveColegio.isPending || !nombre.trim()}>
              <Save className="w-4 h-4 mr-2" />
              {saveColegio.isPending ? "Guardando…" : "Guardar colegio"}
            </Button>
          </div>
        </section>

        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Mi perfil</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dname">Nombre para mostrar</Label>
              <Input id="dname" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email ?? ""} disabled />
            </div>
            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending || !displayName.trim()}>
              <Save className="w-4 h-4 mr-2" />
              {saveProfile.isPending ? "Guardando…" : "Guardar perfil"}
            </Button>
          </div>
        </section>

        {colegioId && accessToken && (
          <InvitacionesSection colegioId={colegioId} accessToken={accessToken} />
        )}
      </div>
    </div>
  );
}

import { Mail, Trash2, Copy } from "lucide-react";
import { listInvitaciones, createInvitacion, revokeInvitacion } from "@/lib/tenant.functions";

function InvitacionesSection({ colegioId, accessToken }: { colegioId: string; accessToken: string }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "utp" | "editor" | "viewer" | "docente">("docente");

  const { data: invs } = useQuery({
    queryKey: ["invitaciones", colegioId],
    queryFn: () => listInvitaciones({ data: { accessToken, colegioId } }),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () => createInvitacion({ data: { accessToken, colegioId, email, role } }),
    onSuccess: () => { setEmail(""); toast.success("Invitación creada"); qc.invalidateQueries({ queryKey: ["invitaciones", colegioId] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeInvitacion({ data: { accessToken, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitaciones", colegioId] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (!invs) return null;

  const linkFor = (token: string) => `${window.location.origin}/invitacion/${token}`;

  return (
    <section className="bg-surface border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Mail className="w-4 h-4" /> Invitaciones</h2>
      <div className="grid sm:grid-cols-[1fr_140px_auto] gap-2 mb-4">
        <Input type="email" placeholder="email@colegio.cl" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="bg-input border border-border rounded-md px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="docente">Docente</option>
          <option value="utp">UTP</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
          <option value="admin">Admin</option>
        </select>
        <Button onClick={() => create.mutate()} disabled={!email || create.isPending}>Invitar</Button>
      </div>
      <div className="space-y-1.5">
        {invs.length === 0 && <p className="text-sm text-muted-foreground">Sin invitaciones pendientes</p>}
        {invs.map((i) => (
          <div key={i.id} className="flex items-center justify-between p-2.5 bg-surface-2 rounded text-sm">
            <div className="flex-1 min-w-0">
              <div className="truncate"><b>{i.email}</b> <span className="text-muted-foreground">— {i.role}</span></div>
              <div className="text-xs text-muted-foreground">
                {i.accepted_at ? `Aceptada ${new Date(i.accepted_at).toLocaleDateString()}` : `Expira ${new Date(i.expires_at).toLocaleDateString()}`}
              </div>
            </div>
            {!i.accepted_at && (
              <div className="flex items-center gap-1">
                <button title="Copiar enlace" onClick={() => { navigator.clipboard.writeText(linkFor(i.token)); toast.success("Enlace copiado"); }}
                  className="p-1.5 hover:bg-surface-3 rounded"><Copy className="w-4 h-4" /></button>
                <button title="Revocar" onClick={() => revoke.mutate(i.id)} className="p-1.5 hover:bg-surface-3 rounded text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
