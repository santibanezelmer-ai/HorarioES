import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Lock, CheckCircle2, ArrowRight, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/restablecer-clave")({
  head: () => ({
    meta: [{ title: "Restablecer Contraseña — HorarioES" }],
  }),
  component: RestablecerClavePage,
});

function RestablecerClavePage() {
  const navigate = useNavigate();
  const { session, refreshProfile } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      await refreshProfile();
      toast.success("Contraseña actualizada con éxito");
      setTimeout(() => {
        navigate({ to: "/intranet" });
      }, 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar la contraseña");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="w-full max-w-md">
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-elegant space-y-5">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center text-white mx-auto shadow-sm mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold text-foreground tracking-tight">
              Crea tu nueva contraseña
            </h2>
            <p className="text-xs text-muted-foreground">
              Define una clave personal y segura para ingresar a tu cuenta.
            </p>
          </div>

          {success ? (
            <div className="text-center py-6 space-y-3 animate-in fade-in-50">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="font-bold text-sm text-foreground">¡Contraseña guardada!</h3>
              <p className="text-xs text-muted-foreground">
                Te estamos redirigiendo a la Intranet…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    className="w-full bg-input border border-border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Confirmar nueva contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    required
                    minLength={6}
                    className="w-full bg-input border border-border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-gradient-primary text-white font-semibold py-2.5 rounded-xl hover:opacity-90 flex items-center justify-center gap-2 shadow-elegant disabled:opacity-60 transition-all cursor-pointer text-sm"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Guardar e ingresar <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="text-center pt-2 border-t border-border">
            <Link
              to="/apoderados/login"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Volver al portal de apoderados
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
