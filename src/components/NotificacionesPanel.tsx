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
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Todo al día, sin alertas pendientes.
        </div>
      ) : (
        <div className="space-y-1.5">
          {notifs.map((n) => {
            const Icon = n.severity === "critical" ? AlertCircle : n.severity === "warning" ? AlertTriangle : Info;
            const color = n.severity === "critical" ? "text-rose-500 bg-rose-500/10 border-rose-500/30"
              : n.severity === "warning" ? "text-amber-600 bg-amber-500/10 border-amber-500/30"
              : "text-blue-500 bg-blue-500/10 border-blue-500/30";
            const inner = (
              <div className={`flex items-start gap-2 p-2.5 rounded-lg border ${color} text-xs`}>
                <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">{n.title}</div>
                  {n.detail && <div className="text-muted-foreground text-[11px] mt-0.5">{n.detail}</div>}
                </div>
              </div>
            );
            return n.to ? <Link key={n.id} to={n.to} className="block hover:opacity-80">{inner}</Link> : <div key={n.id}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
