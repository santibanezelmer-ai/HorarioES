import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mi-horario")({
  beforeLoad: () => {
    throw redirect({ to: "/mis-clases", search: { tab: "semana" } as never });
  },
  component: () => null,
});
