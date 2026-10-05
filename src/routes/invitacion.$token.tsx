import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Building2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getInvitacion, acceptInvitacion } from "@/lib/tenant.functions";

export const Route = createFileRoute("/invitacion/$token")({
  head: () => ({ meta: [{ title: "Invitación — HorarioES" }] }),
  component: InvitacionPage,
});

function InvitacionPage() {
  const { token } = useParams({ from: "/invitacion/$token" });
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const { data: inv, isLoading, refetch } = useQuery({
    queryKey: ["invitacion", token],
    queryFn: () => getInvitacion({ data: { token } }),
    retry: false,
  });

  if (isLoading) {
    return <CenteredLoader />;
  }

  if (!inv) {
    return <ErrorBox title="Invitación inválida" message="El enlace no es correcto o fue eliminado." />;
  }
  if (inv._status === "expired") {
    return <ErrorBox title="Invitación expirada" message="Solicita una nueva al administrador." />;
  }
  if (inv._status === "accepted") {
    return <ErrorBox title="Ya fue usada" message="Esta invitación ya fue aceptada. Inicia sesión normalmente." />;
  }

  const colegio = inv.colegio!;

  const handleAccept = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Si ya hay sesión, usar accessToken
      if (user && session?.access_token) {
        const r = await acceptInvitacion({ data: { token, accessToken: session.access_token } });
        toast.success(`Te uniste a ${colegio.nombre}`);
        navigate({ to: "/c/$slug/login", params: { slug: r.slug } });
        return;
      }
      // Crear cuenta nueva
      const r = await acceptInvitacion({ data: { token, password, fullName: name } });
      // login automático
      const { error: lerr } = await supabase.auth.signInWithPassword({ email: inv.email, password });
      if (lerr) throw lerr;
      toast.success(`Cuenta creada en ${colegio.nombre}`);
      navigate({ to: "/c/$slug/login", params: { slug: r.slug } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al aceptar invitación");
      void refetch();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          {colegio.logo_url ? (
            <img src={colegio.logo_url} alt={colegio.nombre} className="w-16 h-16 rounded-2xl object-cover mb-3" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center mb-3">
              <Building2 className="w-7 h-7 text-white" />
            </div>
          )}
          <h1 className="text-xl font-bold">{colegio.nombre}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Te invitaron como <b className="text-foreground">{inv.role}</b>
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-elegant">
          <p className="text-sm text-muted-foreground mb-4">
            Invitación para <b className="text-foreground">{inv.email}</b>
          </p>
          {user ? (
            <form onSubmit={handleAccept} className="space-y-3">
              <p className="text-sm">Estás logueado como <b>{user.email}</b>. Acepta para unirte al colegio.</p>
              <button disabled={busy} className="w-full bg-gradient-primary text-white font-semibold py-2.5 rounded-md flex items-center justify-center gap-2 disabled:opacity-60">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Aceptar invitación
              </button>
            </form>
          ) : (
            <form onSubmit={handleAccept} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Nombre</label>
                <input required value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Tu nombre" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Contraseña</label>
                <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Mínimo 8 caracteres" />
              </div>
              <button disabled={busy} className="w-full bg-gradient-primary text-white font-semibold py-2.5 rounded-md flex items-center justify-center gap-2 disabled:opacity-60">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Crear cuenta y unirme
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">
          <Link to="/login" className="hover:text-foreground">← Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
}

function CenteredLoader() {
  return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
}
function ErrorBox({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md text-center">
        <XCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{message}</p>
        <Link to="/login" className="text-primary hover:underline text-sm mt-4 inline-block">← Volver</Link>
      </div>
    </div>
  );
}
