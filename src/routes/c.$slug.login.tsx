import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Lock, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { getColegioBySlug, validateAndSetActiveColegio } from "@/lib/tenant.functions";

export const Route = createFileRoute("/c/$slug/login")({
  head: () => ({ meta: [{ title: "Ingresar — HorarioES" }] }),
  component: ContextualLoginPage,
});

function ContextualLoginPage() {
  const { slug } = useParams({ from: "/c/$slug/login" });
  const navigate = useNavigate();
  const { user, session, loading, refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [validating, setValidating] = useState(false);

  const { data: colegio, isLoading: colegioLoading } = useQuery({
    queryKey: ["colegio-by-slug", slug],
    queryFn: () => getColegioBySlug({ data: { slug } }),
    retry: false,
  });

  // Cuando entra usuario, validar pertenencia
  useEffect(() => {
    if (loading || !user || !session?.access_token || validating) return;
    setValidating(true);
    (async () => {
      try {
        await validateAndSetActiveColegio({ data: { accessToken: session.access_token, slug } });
        await refreshProfile();
        toast.success(`Bienvenido a ${colegio?.nombre ?? slug}`);
        navigate({ to: "/dashboard" });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No tienes acceso a este colegio");
        await supabase.auth.signOut();
        setValidating(false);
      }
    })();
  }, [user, session, loading, slug, colegio, navigate, refreshProfile, validating]);

  const handleEmail = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/c/${slug}/login`,
      });
      if (result.error) {
        toast.error("No se pudo iniciar sesión con Google");
        setBusy(false);
      }
    } catch {
      toast.error("Error inesperado");
      setBusy(false);
    }
  };

  if (colegioLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!colegio) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Colegio no encontrado</h1>
          <p className="text-sm text-muted-foreground mt-2">
            El enlace <code className="bg-surface-2 px-1.5 py-0.5 rounded">/c/{slug}/login</code> no corresponde a ningún colegio activo.
          </p>
          <Link to="/login" className="text-primary hover:underline text-sm mt-4 inline-block">← Volver</Link>
        </div>
      </div>
    );
  }

  const accent = colegio.color_primario ?? undefined;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ background: accent ?? "hsl(var(--primary))" }} />
      </div>

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          {colegio.logo_url ? (
            <img src={colegio.logo_url} alt={colegio.nombre} className="w-16 h-16 rounded-2xl object-cover mb-4 shadow-elegant" />
          ) : (
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-elegant mb-4" style={{ background: accent ?? "var(--gradient-primary, hsl(var(--primary)))" }}>
              <Building2 className="w-7 h-7 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold">{colegio.nombre}</h1>
          <p className="text-sm text-muted-foreground">Acceso institucional</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-elegant">
          {validating ? (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Validando acceso…</span>
            </div>
          ) : (
            <>
              <form onSubmit={handleEmail} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Correo</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="tu@colegio.cl" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="••••••••" />
                  </div>
                </div>
                <button type="submit" disabled={busy}
                  className="w-full text-white font-semibold py-2.5 rounded-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-elegant disabled:opacity-60"
                  style={{ background: accent ?? "var(--gradient-primary, hsl(var(--primary)))" }}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  Entrar
                </button>
              </form>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-surface px-2 text-muted-foreground">o continúa con</span>
                </div>
              </div>

              <button type="button" onClick={handleGoogle} disabled={busy}
                className="w-full bg-surface-2 hover:bg-surface-3 border border-border text-foreground font-medium py-2.5 rounded-md flex items-center justify-center gap-2.5 transition-colors disabled:opacity-60">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          ¿Sin cuenta? Solicita una invitación al administrador del colegio.
        </p>
      </div>
    </div>
  );
}
