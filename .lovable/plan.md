## Objetivo

1. Eliminar duplicidad de funciones en el menú y fusionar pantallas que hacen casi lo mismo.
2. Que toda vista imprimible entre en una sola hoja.

---

## Parte 1 — Unificación de módulos

### Duplicados detectados hoy (mismo destino en dos módulos del menú)

| Ítem | Aparece en | Queda en |
|---|---|---|
| Asistencia | Mi trabajo · Inspectoría | Mi trabajo (docente) e Inspectoría (vista diaria del establecimiento), pero con rutas distintas: docente `/asistencia`, inspectoría `/inspectoria` |
| Calificaciones | Mi trabajo · Gestión Académica | Mi trabajo |
| Libro de clases | Mi trabajo · Gestión Académica | Mi trabajo |
| Planificaciones | Mi trabajo · Currículum | Currículum y Planificación |
| Cobertura curricular | Currículum · Analítica | Currículum |
| Resumen académico (`/academico`) | Gestión Académica · Analítica | Gestión Académica |
| Estadísticas | Inspectoría · Analítica | Analítica |

En cada caso el ítem se elimina del módulo secundario; la ruta sigue existiendo (nada se rompe si alguien la tiene guardada).

### Pantallas que se fusionan

1. **`/mis-clases` + `/mi-horario` → "Mi horario"** (una sola pantalla con dos pestañas: *Hoy* y *Semana*). `/mi-horario` queda como redirección a la pestaña semanal.
2. **`/mis-resumenes` + `/mis-resumen-academico` → "Mis resúmenes"** con pestañas *Asistencia* y *Académico*, compartiendo el mismo selector de curso y de rango de fechas (hoy cada una tiene el suyo). Las rutas antiguas redirigen a la nueva con la pestaña correspondiente.
3. **`/direccion` + `/estadisticas`**: se mantienen ambas rutas, pero el panel Dirección deja de repetir los indicadores de carga docente y enlaza a Estadísticas; en el menú queda un solo grupo "Analítica y Reportes".

### Resultado del menú (por rol, sin repeticiones)

```text
Dashboard
Mi trabajo        Mi horario · Mis cursos · Asistencia · Libro de clases · Calificaciones · Mis resúmenes
Gestión Académica Resumen académico · Cursos · Asignaturas
Currículum        Planificaciones · Objetivos de aprendizaje · Cobertura curricular
Estudiantes
Docentes          Listado · Contratos · Reemplazos
Horarios          Ver horarios · Conflictos · Bloques · Espacios
PIE
Inspectoría       Panel general · Atrasos y retiros · Convivencia
Analítica         Panel Dirección · Estadísticas
Administración    Ajustes · Configuración · Importar · Auditoría
Plataforma        (solo superadmin)
```

---

## Parte 2 — Impresión en una sola hoja

Vistas imprimibles actuales: **Horarios** (impresión propia), y **Mis resúmenes**, **Resumen académico docente**, **Cobertura curricular**, **Resumen académico UTP** (PDF vía botón Exportar).

### Motor de impresión único

- Se crea una hoja de estilos de impresión común con soporte de "encaje": la tabla se mide al imprimir y se aplica un factor de escala (`transform: scale`) calculado para que ancho y alto quepan en A4, con mínimo legible (~6.5pt). Si con ese mínimo no cabe, se pasa a A4 horizontal automáticamente antes de recortar.
- Se ajustan reglas: encabezado compacto (logo pequeño + nombre + título en una línea), tabla con `table-layout: fixed`, padding reducido, sin repetición de cabecera, resúmenes en columnas al pie.

### Horarios

- Se elimina `print-page-break` entre cursos cuando el alcance es "solo curso actual" (hoy siempre imprime cada curso en página nueva); el modo "todos los cursos" mantiene un curso por hoja, que es lo esperado.
- Grilla + bloque de resúmenes (asignaturas / cursos / docentes) se escalan juntos a una sola hoja A4 horizontal.

### Exportaciones PDF (`exportPDF`)

- La ventana de impresión pasa a usar el mismo motor: encabezado del colegio, `@page` con márgenes de 8 mm, y auto-escala para que todas las filas entren en una hoja; si la tabla supera el límite legible, se ofrece continuar en varias hojas con cabecera repetida (aviso en pantalla).

### Verificación

Se revisa con captura de la vista de impresión (Horarios curso, Horarios docente, Mis resúmenes y Cobertura) que cada una quepa en una página.

---

## Detalles técnicos

- `src/lib/roles.ts`: quitar ítems duplicados de `MODULES`, renombrar el ítem de Mi trabajo a "Mi horario" y "Mis resúmenes".
- `src/routes/mis-clases.tsx`: pasa a contener pestañas Hoy/Semana (absorbe `mi-horario`); `mi-horario.tsx` queda como redirect.
- `src/routes/mis-resumenes.tsx`: pestañas Asistencia/Académico reutilizando los cálculos de `mis-resumen-academico.tsx` extraídos a `src/lib/resumen-academico.ts`; `mis-resumen-academico.tsx` queda como redirect.
- `src/styles.css`: reescribir el bloque `@media print` como sistema genérico (`.print-sheet`, `.print-fit`), no atado a `#print-area` de Horarios.
- Nuevo `src/lib/print.ts`: `printFit(elementId, { orientation })` que calcula la escala antes de `window.print()` y la limpia después.
- `src/lib/export.ts`: `exportPDF` usa la misma plantilla y auto-escala.
- Sin cambios de base de datos ni de permisos.
