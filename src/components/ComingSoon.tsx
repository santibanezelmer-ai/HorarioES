import { Sparkles } from "lucide-react";

export function ComingSoon({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-elegant mb-4">
        <Sparkles className="w-7 h-7 text-white" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{name} — En migración</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Esta vista se está migrando a React desde el HorarioES original. Los cimientos (base de datos,
        autenticación, layout) ya están listos. Las vistas se irán habilitando en las próximas iteraciones.
      </p>
    </div>
  );
}
