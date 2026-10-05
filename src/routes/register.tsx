import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Building2, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { registerOrganization } from "@/lib/tenant.functions";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Crea tu colegio — HorarioES" },
      { name: "description", content: "Registra tu colegio u organización en HorarioES y comienza en minutos." },
    ],
  }),
  component: RegisterPage,
});

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

function RegisterPage() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && profile?.colegio_id) navigate({ to: "/dashboard" });
  }, [user, profile, loading, navigate]);

  useEffect(() => {
    if (!slugDirty) setSlug(slugify(nombre));
  }, [nombre, slugDirty]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await registerOrganization({
        data: {
          nombre: nombre.trim(),
          slug: slug.trim().toLowerCase(),
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim().toLowerCase(),
          adminPassword,
          phone: phone.trim() || undefined,
        },
      });
      // Auto sign in
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: adminEmail.trim().toLowerCase(),
        password: adminPassword,
      });
      if (signErr) {
        toast.success("Colegio creado. Inicia sesión para continuar.");
        navigate({ to: "/c/$slug/login", params: { slug: res.slug } });
        return;
      }
      toast.success(`¡Bienvenido a ${nombre}!`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-primary-glow/10 blur-3xl" />
      </div>

      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-elegant mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Crea tu colegio</h1>
          <p className="text-sm text-muted-foreground">Tendrás tu propio espacio y URL de acceso.</p>
        </div>

        <form onSubmit={submit} className="bg-surface border border-border rounded-xl p-6 shadow-elegant space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Nombre del colegio u organización</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required
              className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Colegio Porvenir" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Identificador (URL)</label>
            <div className="flex items-stretch">
              <div className="flex items-center bg-surface-2 border border-border border-r-0 rounded-l-md px-3 text-sm text-muted-foreground">/c/</div>
              <input
                value={slug}
                onChange={(e) => { setSlugDirty(true); setSlug(slugify(e.target.value)); }}
                required
                pattern="[a-z0-9-]{2,64}"
                className="flex-1 px-3 py-2.5 bg-input border border-border rounded-r-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="porvenir"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Tus usuarios entrarán por <code>/c/{slug || "tu-slug"}/login</code></p>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Tu nombre (administrador)</label>
              <input value={adminName} onChange={(e) => setAdminName(e.target.value)} required minLength={2}
                className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Correo</label>
              <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required
                className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Contraseña (mínimo 8)</label>
              <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required minLength={8}
                className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Teléfono (opcional)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2.5 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <button type="submit" disabled={busy}
            className="w-full bg-gradient-primary text-white font-semibold py-2.5 rounded-md hover:opacity-90 flex items-center justify-center gap-2 shadow-elegant disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Crear y entrar <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-primary hover:underline">Ingresar</Link>{" · "}
          <Link to="/" className="hover:text-foreground">Volver</Link>
        </p>
      </div>
    </div>
  );
}
