import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  CalendarRange,
  Users,
  GraduationCap,
  ClipboardCheck,
  BookOpen,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Check,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import heroImage from "@/assets/landing-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HorarioES — Gestión escolar simple, en un solo lugar" },
      {
        name: "description",
        content:
          "Plataforma chilena para crear horarios, registrar asistencia, planificar clases y mantener el libro de clases al día. Diseñada para colegios, UTP y docentes.",
      },
      { property: "og:title", content: "HorarioES — Gestión escolar simple, en un solo lugar" },
      {
        property: "og:description",
        content:
          "Horarios, asistencia, planificaciones y libro de clases en una sola plataforma para tu colegio.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && profile?.colegio_id) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [user, profile, loading, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground">
              <CalendarRange className="w-4 h-4" />
            </span>
            HorarioES
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Características</a>
            <a href="#roles" className="hover:text-foreground transition-colors">Para tu equipo</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Planes</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Crea uno gratis <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(80% 60% at 70% 0%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 70%), radial-gradient(50% 40% at 10% 20%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 70%)",
          }}
        />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-28 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Nuevo · Asistencia por bloque y cobertura curricular
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              Tu colegio,{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                organizado de verdad
              </span>
              .
            </h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Horarios, asistencia, planificaciones, calificaciones y libro de clases en una sola
              plataforma. Pensado para colegios chilenos, con roles para dirección, UTP y docentes.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Crea uno gratis <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:bg-surface transition-colors"
              >
                Ver características
              </a>
            </div>
            <div className="mt-8 flex items-center gap-5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" /> Sin instalación</span>
              <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" /> Multi-colegio</span>
              <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" /> Datos protegidos</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 blur-2xl" />
            <img
              src={heroImage}
              alt="Vista previa de la grilla de horarios de HorarioES"
              width={1280}
              height={960}
              className="rounded-2xl border border-border/60 shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/60 bg-surface/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { k: "1 plataforma", v: "para todo el ciclo escolar" },
            { k: "5+ roles", v: "admin, UTP, docente y más" },
            { k: "Por bloque", v: "trazabilidad de asistencia" },
            { k: "100%", v: "diseñado para colegios" },
          ].map((s) => (
            <div key={s.k}>
              <div className="text-2xl md:text-3xl font-bold tracking-tight">{s.k}</div>
              <div className="text-xs md:text-sm text-muted-foreground mt-1">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Todo lo que tu colegio necesita
          </h2>
          <p className="mt-3 text-muted-foreground">
            Reemplaza planillas dispersas con un sistema integrado, pensado para el día a día de la sala de clases.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: CalendarRange,
              title: "Horarios inteligentes",
              text: "Crea y publica horarios por curso, docente o sala. Detecta conflictos automáticamente.",
              color: "#4f8ef7",
            },
            {
              icon: ClipboardCheck,
              title: "Asistencia por bloque",
              text: "Registro diario oficial + eventos por bloque: retiros, atrasos y salidas tempranas.",
              color: "#34d399",
            },
            {
              icon: BookOpen,
              title: "Planificaciones y libro de clases",
              text: "Carga objetivos, marca clases ejecutadas y mide cobertura curricular real.",
              color: "#fbbf24",
            },
            {
              icon: GraduationCap,
              title: "Calificaciones",
              text: "Notas por asignatura y curso, accesibles para docentes y dirección.",
              color: "#7c6af7",
            },
            {
              icon: Users,
              title: "Roles y permisos",
              text: "Admin, UTP, docentes y profesores jefes. Cada uno ve y edita lo que corresponde.",
              color: "#f87171",
            },
            {
              icon: ShieldCheck,
              title: "Multi-colegio seguro",
              text: "Cada colegio con sus datos aislados, branding propio y enlace público de acceso.",
              color: "#818cf8",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-border bg-surface p-6 hover:border-primary/50 transition-colors"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style={{ background: `${f.color}20`, color: f.color }}
              >
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="bg-surface/40 border-y border-border/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Dirección y admin",
              points: ["Vista global del colegio", "Gestión de docentes y cursos", "Importación masiva"],
            },
            {
              title: "UTP",
              points: ["Resumen de planificaciones por docente", "Cobertura curricular por asignatura", "Detección de retrasos"],
            },
            {
              title: "Docentes",
              points: ["Mis clases del día", "Asistencia y libro de clases", "Calificaciones por curso"],
            },
          ].map((r) => (
            <div key={r.title} className="rounded-xl border border-border bg-background p-6">
              <h3 className="text-lg font-semibold">{r.title}</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {r.points.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="max-w-4xl mx-auto px-4 sm:px-6 py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          Empieza hoy en tu colegio
        </h2>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Crea tu cuenta, invita a tu equipo y carga tu primer horario en minutos. Sin instalación, sin tarjetas.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Crea uno gratis <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground">
              <CalendarRange className="w-3 h-3" />
            </span>
            <span>© {new Date().getFullYear()} HorarioES</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#features" className="hover:text-foreground transition-colors">Características</a>
            <Link to="/login" className="hover:text-foreground transition-colors">Iniciar sesión</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
