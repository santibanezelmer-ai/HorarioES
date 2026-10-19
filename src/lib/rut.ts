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

export type RutMaskMode = "banco" | "privacy" | "strict";

/**
 * Enmascara un RUT para proteger la privacidad del titular (Ley 19.628 / PII).
 * - "banco" (por defecto): Oculta el cuerpo inicial, muestra últimos 3 dígitos y DV (ej: "**.***.678-5").
 * - "privacy": Oculta dígitos intermedios, preserva inicio y DV (ej: "12.***.***-5").
 * - "strict": Oculta completamente el cuerpo y DV (ej: "**.***.***-*").
 */
export function maskRut(
  rut: string | null | undefined,
  mode: RutMaskMode = "banco"
): string {
  if (!rut) return "";
  const cleaned = cleanRut(rut);
  if (!cleaned) return "";

  if (cleaned.length < 3) return "**-*";

  const cuerpo = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  if (mode === "strict") {
    return "**.***.***-*";
  }

  if (mode === "privacy") {
    const prefix = cuerpo.length >= 6 ? cuerpo.slice(0, 2) : cuerpo.slice(0, 1);
    return `${prefix}.***.***-${dv}`;
  }

  // mode === "banco"
  const visibleCuerpo = cuerpo.slice(-3);
  return `**.***.${visibleCuerpo}-${dv}`;
}

/**
 * Enmascara un nombre completo protegiendo la identidad de menores de edad y apoderados.
 * - "first_initial": "Juan Carlos Pérez Soto" -> "Juan P. S."
 * - "asterisks": "Juan Carlos Pérez Soto" -> "J*** C*** P*** S***"
 * - "initials": "Juan Carlos Pérez Soto" -> "J. C. P. S."
 */
export function maskName(
  fullName: string | null | undefined,
  mode: "first_initial" | "asterisks" | "initials" = "first_initial"
): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) {
    if (mode === "asterisks") {
      const w = parts[0];
      return w.length > 2 ? `${w[0]}***${w.slice(-1)}` : `${w[0]}*`;
    }
    return parts[0];
  }

  if (mode === "initials") {
    return parts.map((p) => `${p[0].toUpperCase()}.`).join(" ");
  }

  if (mode === "asterisks") {
    return parts
      .map((p) => (p.length > 2 ? `${p[0].toUpperCase()}***` : `${p[0].toUpperCase()}*`))
      .join(" ");
  }

  const [first, ...rest] = parts;
  const restInitials = rest.map((p) => `${p[0].toUpperCase()}.`).join(" ");
  return `${first} ${restInitials}`;
}

/**
 * Enmascara una dirección de correo electrónico.
 * ej: "rodrigo.gonzalez@colegio.cl" -> "r***z@colegio.cl"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "";
  const [user, domain] = email.trim().split("@");
  if (!user || !domain) return email;
  if (user.length <= 2) {
    return `${user[0]}*@${domain}`;
  }
  const maskedUser = `${user[0]}***${user[user.length - 1]}`;
  return `${maskedUser}@${domain}`;
}

/**
 * Enmascara un número de teléfono celular chileno o internacional.
 * ej: "+56912345678" -> "+56 **** 5678"
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\s+/g, "");
  if (cleaned.length < 8) return "****";
  const last4 = cleaned.slice(-4);
  const prefix = cleaned.startsWith("+56") ? "+56 " : "";
  return `${prefix}**** ${last4}`;
}

