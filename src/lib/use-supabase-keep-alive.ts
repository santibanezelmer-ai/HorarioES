import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const PING_INTERVAL_MS = 10 * 60 * 1000; // cada 10 minutos
const STORAGE_KEY = "horarioes_last_supabase_keepalive";
const MIN_ELAPSED_MS = 5 * 60 * 1000; // evitar pings redundantes en recargas rápidas (< 5 min)

async function sendKeepAlivePing() {
  try {
    const lastPing = localStorage.getItem(STORAGE_KEY);
    const now = Date.now();

    if (lastPing && now - Number(lastPing) < MIN_ELAPSED_MS) {
      return;
    }

    // Consulta mínima ultra liviana: 1 solo registro de la tabla colegios
    const { error } = await supabase
      .from("colegios")
      .select("id")
      .limit(1);

    if (!error) {
      localStorage.setItem(STORAGE_KEY, String(now));
    }
  } catch {
    // Falla silenciosa para no interrumpir la navegación del usuario
  }
}

/**
 * Hook que emite consultas periódicas y ultralivianas a Supabase
 * mientras la aplicación esté abierta, evitando la pausa del proyecto por inactividad.
 */
export function useSupabaseKeepAlive() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Ejecutar al montar (respetando umbral mínimo de 5 minutos)
    void sendKeepAlivePing();

    // Ejecutar periódicamente cada 10 minutos mientras la pestaña permanezca activa
    const timer = setInterval(() => {
      void sendKeepAlivePing();
    }, PING_INTERVAL_MS);

    // Ejecutar cuando el usuario vuelve a enfocar la pestaña si ha pasado el umbral
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void sendKeepAlivePing();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
