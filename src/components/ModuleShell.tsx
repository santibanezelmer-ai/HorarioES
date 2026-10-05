import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
  comingSoon?: boolean;
  comingSoonHint?: string;
}

/**
 * Layout estándar para páginas de módulos. Si `comingSoon` está activo, se
 * muestra un placeholder elegante con la nota correspondiente.
 */
export function ModuleShell({
  title,
  subtitle,
  actions,
  children,
  comingSoon,
  comingSoonHint,
}: Props) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {comingSoon ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center bg-surface">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold mb-1">Próximamente</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {comingSoonHint ??
              "Este módulo forma parte de la nueva arquitectura de HorarioES y estará disponible en una próxima entrega."}
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
