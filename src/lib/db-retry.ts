// Cliente: reintenta queries de Supabase ante errores transitorios (503,
// recovery mode, schema cache, "Database client error"). Útil mientras
// Lovable Cloud levanta o reinicia el backend.

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type MaybeErr = { code?: string; message?: string; status?: number } | null | undefined;

export function isTransientDbError(error: unknown): boolean {
  const err = error as MaybeErr;
  if (!err) return false;
  const msg = String(err.message ?? "").toLowerCase();
  const code = String(err.code ?? "");
  return (
    err.status === 503 ||
    ["PGRST000", "PGRST001", "PGRST002", "PGRST003", "57P03"].includes(code) ||
    msg.includes("recovery mode") ||
    msg.includes("not accepting connections") ||
    msg.includes("database client error") ||
    msg.includes("schema cache") ||
    msg.includes("service unavailable") ||
    msg.includes("retrying the connection") ||
    msg.includes("failed to fetch")
  );
}

/**
 * Reintenta una query Supabase tipo:
 *   withRetry(() => supabase.from("docentes").select("*"))
 * Devuelve el mismo objeto que retorna la query (data, error, count, status...).
 */
export async function withRetry<R extends { data: unknown; error: unknown }>(
  build: () => PromiseLike<R>,
  attempts = 5,
): Promise<R> {
  let last: R | undefined;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const result = await build();
      if (!result.error) return result;
      last = result;
      if (!isTransientDbError(result.error) || i === attempts) return result;
    } catch (error) {
      last = { data: null, error } as unknown as R;
      if (!isTransientDbError(error) || i === attempts) return last;
    }
    await wait(400 * i);
  }
  return last as R;
}
