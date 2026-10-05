/**
 * Utilidades oficiales para Validación y Formateo de RUT chileno (Módulo 11).
 */

/**
 * Limpia un RUT eliminando puntos, guiones y espacios en blanco.
 * Convierte el dígito verificador a mayúscula.
 */
export function cleanRut(rut: string | null | undefined): string {
  if (!rut) return "";
  return rut.replace(/[^0-9kK]/g, "").toUpperCase();
}

/**
 * Calcula el Dígito Verificador oficial según algoritmo Módulo 11.
 */
export function calculateDv(cuerpo: number | string): string {
  const rutStr = String(cuerpo).replace(/[^0-9]/g, "");
  let suma = 0;
  let multiplo = 2;

  for (let i = rutStr.length - 1; i >= 0; i--) {
    suma += multiplo * parseInt(rutStr.charAt(i), 10);
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = suma % 11;
  const dvCalculado = 11 - resto;

  if (dvCalculado === 11) return "0";
  if (dvCalculado === 10) return "K";
  return String(dvCalculado);
}

/**
 * Valida si un RUN o RUT chileno es matemáticamente correcto.
 * Admite tanto formato limpio (12345678K) como formateado (12.345.678-K).
 * Rechaza RUTs con ceros repetidos o longitud inválida.
 */
export function validateRut(rut: string | null | undefined): boolean {
  const cleaned = cleanRut(rut);
  if (!cleaned || cleaned.length < 7 || cleaned.length > 9) return false;

  const cuerpo = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  // Evitar RUTs triviales como 0000000-0 o 1111111-1 que no existen
  if (/^(\d)\1+$/.test(cuerpo)) {
    return false;
  }

  const numCuerpo = parseInt(cuerpo, 10);
  if (isNaN(numCuerpo) || numCuerpo < 100000) {
    return false;
  }

  return calculateDv(cuerpo) === dv;
}

/**
 * Formatea un RUT al estándar chileno: XX.XXX.XXX-X
 * Si no es un RUT válido o está incompleto, devuelve la versión limpia con guión si es posible.
 */
export function formatRut(rut: string | null | undefined): string {
  const cleaned = cleanRut(rut);
  if (!cleaned) return "";

  if (cleaned.length === 1) return cleaned;

  const cuerpo = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  // Formatear cuerpo con puntos
  let cuerpoFormateado = "";
  let j = 0;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    cuerpoFormateado = cuerpo.charAt(i) + cuerpoFormateado;
    j++;
    if (j % 3 === 0 && i > 0) {
      cuerpoFormateado = "." + cuerpoFormateado;
    }
  }

  return `${cuerpoFormateado}-${dv}`;
}
