// Impresión con auto-ajuste a una sola hoja.
// Mide el contenido y aplica una escala (transform) para que quepa en A4.

type Orientation = "portrait" | "landscape";

/** Área útil en px CSS (96dpi) de una hoja A4 con márgenes de 8mm. */
const SHEET = {
  portrait: { w: 764, h: 1093 },
  landscape: { w: 1093, h: 764 },
};

/** Escala mínima antes de permitir varias hojas (≈6.5pt sobre 10pt). */
const MIN_SCALE = 0.55;

export function computeFitScale(el: HTMLElement, orientation: Orientation): number {
  const sheet = SHEET[orientation];
  const w = el.scrollWidth || el.offsetWidth;
  const h = el.scrollHeight || el.offsetHeight;
  if (!w || !h) return 1;
  const scale = Math.min(sheet.w / w, sheet.h / h, 1);
  return Math.max(scale, MIN_SCALE);
}

/**
 * Imprime el elemento indicado ajustándolo a una sola hoja cuando es posible.
 * El elemento debe llevar la clase `print-fit` para que el CSS aplique la escala.
 */
export function printFit(elementId: string, orientation: Orientation = "landscape") {
  if (typeof window === "undefined") return;
  const el = document.getElementById(elementId);
  const root = document.documentElement;

  root.setAttribute("data-print-orientation", orientation);

  if (el) {
    // El área de impresión está oculta en pantalla: se mide fuera de flujo.
    const prev = el.getAttribute("style") ?? "";
    el.setAttribute(
      "style",
      `${prev};display:block;position:absolute;left:-10000px;top:0;width:${SHEET[orientation].w}px;visibility:hidden;`
    );
    const scale = computeFitScale(el, orientation);
    el.setAttribute("style", prev);
    root.style.setProperty("--print-scale", String(scale));
  } else {
    root.style.setProperty("--print-scale", "1");
  }

  const cleanup = () => {
    root.style.removeProperty("--print-scale");
    root.removeAttribute("data-print-orientation");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  window.print();
  // Fallback para navegadores sin afterprint fiable.
  setTimeout(cleanup, 2000);
}
