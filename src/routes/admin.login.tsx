import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Lock, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { checkSuperadmin } from "@/lib/tenant.functions";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Acceso plataforma — HorarioES" },
      { name: "description", content: "Acceso para administradores de la plataforma HorarioES." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const { user, session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const accessToken = session?.access_token;
  const { data: chk, isLoading: checking, isFetched } = useQuery({
    queryKey: ["is-superadmin", accessToken],
    enabled: !!accessToken && !loading,
    queryFn: () => checkSuperadmin({ data: { accessToken: accessToken! } }),
    retry: false,
  });

  useEffect(() => {
    if (!user || !isFetched) return;
    if (chk?.isSuperadmin) {
      navigate({ to: "/superadmin" });
    } else if (chk && !chk.isSuperadmin) {
      toast.error("Esta cuenta no tiene permisos de plataforma.");
      void supabase.auth.signOut();
    }
  }, [user, chk, isFetched, navigate]);

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

  const validating = !!user && (checking || !isFetched);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-primary-glow/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-elegant mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Plataforma HorarioES</h1>
          <p className="text-sm text-muted-foreground">Acceso para administradores</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-elegant">
          {validating ? (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Validando permisos…</span>
            </div>
          ) : (
            <form onSubmit={handleEmail} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Correo</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="admin@horarioes.cloud" autoFocus />
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
                className="w-full bg-gradient-primary text-white font-semibold py-2.5 rounded-md hover:opacity-90 flex items-center justify-center gap-2 shadow-elegant disabled:opacity-60">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Entrar al panel
              </button>
            </form>
          )}

          <p className="text-xs text-muted-foreground text-center mt-5">
            Acceso restringido. Solo cuentas con rol <code className="bg-surface-2 px-1 rounded">superadmin</code> pueden gestionar las organizaciones registradas.
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/login" className="hover:text-foreground">← Acceso institucional</Link>
        </p>
      </div>
    </div>
  );
}
