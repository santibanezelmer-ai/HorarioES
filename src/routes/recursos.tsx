import { createFileRoute } from "@tanstack/react-router";
import { ModuleShell } from "@/components/ModuleShell";

export const Route = createFileRoute("/recursos")({
  head: () => ({ meta: [{ title: "Recursos e Inventario — HorarioES" }] }),
  component: () => (
    <ModuleShell
      title="Recursos e Inventario"
      subtitle="Activos, salas equipadas y materiales del establecimiento"
      comingSoon
    />
  ),
});
