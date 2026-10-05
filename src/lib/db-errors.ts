// Centralised mapping of database errors to user-friendly messages.
// Avoids leaking Postgres/Supabase internals (schema, constraint names, etc.)
// to end users while keeping raw details in the developer console.

type MaybePgError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export function handleDbError(e: unknown, fallback = "Ocurrió un error. Inténtalo de nuevo."): string {
  // Always log the raw error for developers
  if (typeof console !== "undefined") {
    // eslint-disable-next-line no-console
    console.error("[db-error]", e);
  }

  const err = (e ?? {}) as MaybePgError;
  const code = err.code;

  switch (code) {
    case "PGRST000":
    case "PGRST001":
    case "PGRST002":
    case "PGRST003":
    case "57P03":
      return "La base de datos se está recuperando temporalmente. Espera unos segundos y vuelve a intentar.";
    case "23505":
      return "Ya existe un registro con ese nombre o valor único.";
    case "23503":
      return "No se puede completar: hay registros relacionados.";
    case "23502":
      return "Falta un campo obligatorio.";
    case "23514":
      return "Alguno de los valores no es válido.";
    case "42501":
    case "PGRST301":
      return "No tienes permisos para realizar esta acción.";
    case "PGRST116":
      return "No se encontró el registro solicitado.";
    case "401":
    case "403":
      return "No autorizado para realizar esta acción.";
    default:
      break;
  }

  // Heuristic fallbacks based on message text (without exposing the raw text)
  const msg = String(err.message ?? "").toLowerCase();
  if (msg.includes("duplicate key")) return "Ya existe un registro con ese nombre o valor único.";
  if (msg.includes("foreign key")) return "No se puede completar: hay registros relacionados.";
  if (msg.includes("permission") || msg.includes("rls")) return "No tienes permisos para realizar esta acción.";
  if (msg.includes("recovery mode") || msg.includes("not accepting connections") || msg.includes("schema cache") || msg.includes("database client error") || msg.includes("service unavailable")) {
    return "La base de datos se está recuperando temporalmente. Espera unos segundos y vuelve a intentar.";
  }
  if (msg.includes("network") || msg.includes("fetch")) return "Problema de conexión. Verifica tu red e inténtalo de nuevo.";

  return fallback;
}
