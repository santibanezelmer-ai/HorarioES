import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Building2, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Ingresar — HorarioES" },
      { name: "description", content: "Accede a tu colegio en HorarioES." },
    ],
  }),
  component: LoginPickerPage,
});

function LoginPickerPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (!loading && user && profile?.colegio_id) navigate({ to: "/dashboard" });
  }, [user, profile, loading, navigate]);

  const go = (e: FormEvent) => {
    e.preventDefault();
    const s = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!s) return;
    navigate({ to: "/c/$slug/login", params: { slug: s } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-primary-glow/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-elegant mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">HorarioES</h1>
          <p className="text-sm text-muted-foreground">Ingresa al portal de tu colegio</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-elegant">
          <form onSubmit={go} className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Identificador del colegio</label>
            <div className="flex items-stretch gap-2">
              <div className="flex items-center bg-surface-2 border border-border border-r-0 rounded-l-md px-3 text-sm text-muted-foreground">/c/</div>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="flex-1 px-3 py-2.5 bg-input border border-border rounded-r-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="porvenir"
                autoFocus
              />
            </div>
            <button type="submit" disabled={!slug}
              className="w-full bg-gradient-primary text-white font-semibold py-2.5 rounded-md hover:opacity-90 flex items-center justify-center gap-2 shadow-elegant disabled:opacity-60">
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-5">
            Esta plataforma es de acceso institucional. Solicita acceso al administrador de tu colegio.
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          ¿No tienes colegio aún?{" "}
          <Link to="/register" className="text-primary hover:underline">Crea uno gratis</Link>
          {" · "}
          <Link to="/" className="hover:text-foreground">Volver</Link>
        </p>
      </div>
    </div>
  );
}
