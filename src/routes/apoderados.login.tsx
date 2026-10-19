import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  Users,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  HelpCircle,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import {
  loginOrActivateApoderado,
  resendApoderadoActivation,
  ensureApoderadoLinked,
} from "@/lib/apoderados.functions";

export const Route = createFileRoute("/apoderados/login")({
  head: () => ({
    meta: [
      { title: "Portal Apoderados — HorarioES" },
      { name: "description", content: "Ingreso directo para apoderados y familias a la Intranet escolar." },
    ],
  }),
  component: ApoderadosLoginPage,
});

function ApoderadosLoginPage() {
  const { user, session, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  // Estados de vista
  const [view, setView] = useState<"login" | "reset" | "activation_pending">("login");
  const [activationEmail, setActivationEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Si el usuario ya está autenticado (o viene volviendo de Google OAuth)
  useEffect(() => {
    if (loading || !user || !session?.access_token) return;

    (async () => {
      try {
        await ensureApoderadoLinked({ data: { accessToken: session.access_token } });
        await refreshProfile();
        toast.success("¡Bienvenido a la Intranet!");
        navigate({ to: "/intranet" });
      } catch (err) {
        console.error("Error vinculando apoderado:", err);
        navigate({ to: "/intranet" });
      }
    })();
  }, [user, session, loading, navigate, refreshProfile]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanEmail || !cleanPass) {
      toast.error("Por favor completa tu correo y contraseña");
      return;
    }

    setBusy(true);
    try {
      // 1. Validar en el servidor si es primer ingreso con clave genérica (A + RUT)
      // o si la cuenta está pendiente de activación por email
      const checkResult = await loginOrActivateApoderado({
        data: { email: cleanEmail, password: cleanPass },
      });

      if (checkResult.status === "unregistered_email") {
        toast.error(checkResult.message);
        setBusy(false);
        return;
      }

      if (checkResult.status === "invalid_initial_password") {
        toast.error(checkResult.message, { duration: 6000 });
        setBusy(false);
        return;
      }

      if (checkResult.status === "activation_sent") {
        setActivationEmail(cleanEmail);
        setView("activation_pending");
        toast.success("Cuenta creada exitosamente");
        setBusy(false);
        return;
      }

      if (checkResult.status === "activation_required") {
        setActivationEmail(cleanEmail);
        setView("activation_pending");
        toast.info(checkResult.message);
        setBusy(false);
        return;
      }

      // 2. Si ya está activa y lista, iniciar sesión normalmente
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPass,
      });

      if (authErr) {
        if (authErr.message.includes("Email not confirmed")) {
          setActivationEmail(cleanEmail);
          setView("activation_pending");
          toast.info("Debes validar tu correo antes de poder ingresar.");
          return;
        }
        throw authErr;
      }

      if (authData.session?.access_token) {
        await ensureApoderadoLinked({
          data: { accessToken: authData.session.access_token },
        });
        await refreshProfile();
        toast.success("Ingreso correcto");
        navigate({ to: "/intranet" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const redirectUri = `${window.location.origin}/apoderados/login`;
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: redirectUri,
      });
      if (result.error) {
        toast.error("No se pudo iniciar sesión con Google");
        setBusy(false);
      }
    } catch {
      toast.error("Error inesperado al conectar con Google");
      setBusy(false);
    }
  };

  const handleResendActivation = async () => {
    const target = activationEmail || email;
    if (!target) return;
    setResending(true);
    try {
      await resendApoderadoActivation({ data: { email: target } });
      toast.success("Enlace de activación reenviado a tu correo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reenviar");
    } finally {
      setResending(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error("Ingresa tu correo electrónico");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/restablecer-clave`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success("Correo de restablecimiento enviado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar correo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Fondos decorativos sutiles */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        {/* Cabecera */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-elegant mb-3 text-white">
            <Users className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Portal de Apoderados
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Acceso directo a notas, asistencia, anotaciones y circulares de tus estudiantes.
          </p>
        </div>

        {/* Vista: Cuenta Pendiente de Activación */}
        {view === "activation_pending" && (
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-elegant space-y-5 animate-in fade-in-50">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500">
              <Mail className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="font-bold text-base text-foreground">
                Valida tu correo electrónico
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Hemos enviado un correo a{" "}
                <span className="font-semibold text-foreground font-mono">{activationEmail}</span>.
                Para activar tu cuenta y proteger los datos de tu pupilo, abre tu correo y haz clic en el enlace de activación.
              </p>
            </div>

            <div className="p-3 bg-surface-2 rounded-xl text-xs text-muted-foreground space-y-1">
              <span className="font-semibold text-foreground block flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-primary" /> ¿No recibiste el correo?
              </span>
              <p className="text-[11px]">
                Revisa tu carpeta de Spam o Correo no deseado. Si no llega en unos minutos, puedes solicitar otro enlace.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleResendActivation}
                disabled={resending}
                className="w-full bg-surface-2 hover:bg-surface-2/80 text-foreground font-semibold py-2.5 rounded-lg text-xs border border-border flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {resending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Reenviar correo de activación
              </button>

              <button
                type="button"
                onClick={() => setView("login")}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors cursor-pointer"
              >
                Volver al formulario de ingreso
              </button>
            </div>
          </div>
        )}

        {/* Vista: Restablecer Contraseña */}
        {view === "reset" && (
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-elegant space-y-5 animate-in fade-in-50">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <KeyRound className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Restablecer Contraseña</h3>
            </div>

            {resetSent ? (
              <div className="text-center py-4 space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-xs text-muted-foreground">
                  Si el correo <span className="font-semibold text-foreground">{resetEmail}</span> está registrado, recibirás un enlace para crear tu nueva contraseña.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setResetSent(false);
                    setView("login");
                  }}
                  className="w-full bg-primary text-primary-foreground text-xs font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ingresa el correo electrónico que tienes registrado en el colegio. Te enviaremos un enlace para restablecer tu clave.
                </p>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="apoderado@ejemplo.cl"
                      required
                      className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setView("login")}
                    className="flex-1 py-2 rounded-lg text-xs font-medium border border-border hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar enlace"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Vista: Formulario Principal de Ingreso */}
        {view === "login" && (
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-elegant space-y-5">
            {/* Botón Acceso Rápido con Google */}
            <div>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-surface-2 hover:bg-surface-2/80 border border-border rounded-xl text-xs font-semibold text-foreground transition-all shadow-xs cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continuar con cuenta Google
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px bg-border flex-1" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                O con correo y contraseña
              </span>
              <div className="h-px bg-border flex-1" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="apoderado@ejemplo.cl"
                    required
                    className="w-full bg-input border border-border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setView("reset");
                    }}
                    className="text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    ¿Olvidaste tu clave?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-input border border-border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Pauta didáctica de clave genérica primer ingreso */}
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl text-xs space-y-1">
                <span className="font-bold text-foreground block flex items-center gap-1.5 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Clave para tu Primer Ingreso:
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Tu clave inicial es la letra <span className="font-bold text-foreground">"A"</span> mayúscula seguida del RUT de tu pupilo (ejemplo: <span className="font-mono font-semibold text-foreground">A12345678K</span>).
                </p>
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
                    Ingresar a Intranet <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Pie de página con cambio a portal de funcionarios */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-xs text-muted-foreground">
            ¿Eres docente, directivo o funcionario del colegio?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Ingresa por el Portal Institucional
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              ← Volver al inicio
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
