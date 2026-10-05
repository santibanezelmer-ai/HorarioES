import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mis-resumen-academico")({
  beforeLoad: () => {
    throw redirect({ to: "/mis-resumenes", search: { tab: "academico" } as never });
  },
  component: () => null,
});
