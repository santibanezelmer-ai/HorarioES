import { Outlet, Link, createRootRoute, HeadContent, Scripts, useLocation } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/AppSidebar";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscas no existe o fue movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HorarioES — Sistema de Horarios Escolares" },
      { name: "description", content: "Plataforma para crear y gestionar horarios escolares, docentes, cursos, espacios y planificaciones." },
      { property: "og:title", content: "HorarioES — Sistema de Horarios Escolares" },
      { name: "twitter:title", content: "HorarioES — Sistema de Horarios Escolares" },
      { property: "og:description", content: "Plataforma para crear y gestionar horarios escolares, docentes, cursos, espacios y planificaciones." },
      { name: "twitter:description", content: "Plataforma para crear y gestionar horarios escolares, docentes, cursos, espacios y planificaciones." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1ad7bbbb-6ef5-4123-9ac2-ea79b95a0e14/id-preview-6e09ef6e--be9d25c1-5a4b-40eb-8a13-57bad44bfc13.lovable.app-1777511076278.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1ad7bbbb-6ef5-4123-9ac2-ea79b95a0e14/id-preview-6e09ef6e--be9d25c1-5a4b-40eb-8a13-57bad44bfc13.lovable.app-1777511076278.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Analytics />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
        <Toaster position="top-right" richColors theme="dark" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando…</p>
        </div>
      </div>
    );
  }

  // Public routes (no auth required to render)
  const path = location.pathname;
  const isPublic =
    path === "/" ||
    path === "/login" ||
    path === "/register" ||
    path === "/admin/login" ||
    path.startsWith("/c/") ||
    path.startsWith("/invitacion/");

  if (isPublic) {
    return <Outlet />;
  }


  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
