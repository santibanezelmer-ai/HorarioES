import { Link } from "@tanstack/react-router";
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { useNotificaciones } from "@/lib/use-notificaciones";

export function NotificacionesPanel() {
  const { data: notifs = [], isLoading } = useNotificaciones();

  if (isLoading) return null;

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Notificaciones</h3>
        {notifs.length > 0 && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
            {notifs.length}
          </span>
        )}
      </div>
      {notifs.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Todo al día, sin alertas operativas pendientes.
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => {
            const Icon = n.severity === "critical" ? AlertCircle : n.severity === "warning" ? AlertTriangle : Info;
            const containerStyles =
              n.severity === "critical"
                ? "bg-rose-500/5 border-rose-500/30 text-rose-500"
                : n.severity === "warning"
                ? "bg-amber-500/5 border-amber-500/30 text-amber-600 dark:text-amber-400"
                : "bg-blue-500/5 border-blue-500/30 text-blue-500";

            const btnPrimaryStyles =
              n.severity === "critical"
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : n.severity === "warning"
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-primary hover:bg-primary/90 text-primary-foreground";

            return (
              <div
                key={n.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border ${containerStyles} transition-colors`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-foreground leading-tight">
                      {n.title}
                    </div>
                    {n.detail && (
                      <div className="text-muted-foreground text-[11px] mt-0.5 leading-snug">
                        {n.detail}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                  {n.secondaryTo && n.secondaryActionLabel && (
                    <Link
                      to={n.secondaryTo}
                      className="inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-medium rounded-md border border-border bg-surface hover:bg-muted text-foreground transition-colors"
                    >
                      {n.secondaryActionLabel}
                    </Link>
                  )}
                  {n.to && (
                    <Link
                      to={n.to}
                      className={`inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-medium rounded-md shadow-xs transition-colors ${btnPrimaryStyles}`}
                    >
                      {n.actionLabel || "Ver detalle"}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
