/**
 * HORARIOES — MOTOR DE GENERACIÓN AUTOMÁTICA DE HORARIOS ESCOLARES
 * Basado en la carga académica (asignaturas + horas semanales + docentes asignados),
 * disponibilidad horaria, bloques pedagógicos y restricciones escolares chilenas.
 */

export interface CargaAsignatura {
  asignaturaId: string;
  asignaturaNombre: string;
  asignaturaColor: string;
  docenteId: string | null;
  docenteNombre?: string;
  horasSemanales: number;
  espacioId?: string | null;
}

export interface BloqueHorario {
  id: string;
  nombre: string;
  orden: number;
  tipo: "clase" | "recreo" | "almuerzo";
  hora?: string;
}

export interface DocenteInfo {
  id: string;
  nombre: string;
  dias: number[];
  horas_utp?: number | null;
}

export interface DocenteBlockInfo {
  docente_id: string;
  dia: number;
  slot: number;
  motivo?: string | null;
}

export interface ExistingSlot {
  curso_id: string;
  dia: number;
  slot: number;
  docente_id: string | null;
  asignatura_id: string | null;
}

export interface GeneradorInput {
  cursoId: string;
  cursoNombre?: string;
  colegioId: string;
  bloques: BloqueHorario[];
  carga: CargaAsignatura[];
  docentes: DocenteInfo[];
  docenteBlocks: DocenteBlockInfo[];
  existingSlotsOtherCourses: ExistingSlot[];
  lockedSlotsCurso?: ExistingSlot[]; // Celdas bloqueadas que no se deben mover
  preferBloquesDobles?: boolean;
  viernesMaxSlot?: number | null;
  maxIntentos?: number;
}

export interface SlotGenerado {
  curso_id: string;
  dia: number;
  slot: number;
  asignatura_id: string;
  docente_id: string | null;
  espacio_id: string | null;
}

export interface GeneradorResultado {
  cursoId: string;
  slots: SlotGenerado[];
  horasAsignadas: number;
  horasRequeridas: number;
  completado: boolean;
  advertencias: string[];
  detallesPorAsignatura: Array<{
    asignaturaId: string;
    asignaturaNombre: string;
    asignaturaColor: string;
    docenteNombre: string;
    horasRequeridas: number;
    horasAsignadas: number;
    cumplido: boolean;
  }>;
}

/**
 * Descompone una cantidad de horas semanales en sesiones pedagógicas.
 * Si preferBloquesDobles es true:
 * - 6 horas -> [2, 2, 2]
 * - 5 horas -> [2, 2, 1]
 * - 4 horas -> [2, 2]
 * - 3 horas -> [2, 1]
 * - 2 horas -> [2]
 * - 1 hora  -> [1]
 */
function descomponerHorasEnSesiones(horas: number, preferBloquesDobles = true): number[] {
  if (horas <= 0) return [];
  if (!preferBloquesDobles) {
    return Array(horas).fill(1);
  }

  const sesiones: number[] = [];
  let rem = horas;
  while (rem >= 2) {
    sesiones.push(2);
    rem -= 2;
  }
  if (rem === 1) {
    sesiones.push(1);
  }
  return sesiones;
}

/**
 * Generador heurístico para un curso individual con soporte de restricciones duras y blandas.
 */
export function generarHorarioCurso(input: GeneradorInput): GeneradorResultado {
  const {
    cursoId,
    bloques,
    carga,
    docentes,
    docenteBlocks,
    existingSlotsOtherCourses,
    lockedSlotsCurso = [],
    preferBloquesDobles = true,
    viernesMaxSlot = null,
    maxIntentos = 150,
  } = input;

  const DIAS = [0, 1, 2, 3, 4]; // Lunes a Viernes

  // Mapa de docentes para consulta rápida
  const docMap = new Map<string, DocenteInfo>();
  docentes.forEach((d) => docMap.set(d.id, d));

  // Bloqueos de docentes por clave "docenteId-dia-slot"
  const docBlocksSet = new Set<string>();
  docenteBlocks.forEach((b) => {
    docBlocksSet.add(`${b.docente_id}-${b.dia}-${b.slot}`);
  });

  // Ocupaciones de docentes en otros cursos "docenteId-dia-slot"
  const docOcupadoOtrosSet = new Set<string>();
  existingSlotsOtherCourses.forEach((s) => {
    if (s.docente_id) {
      docOcupadoOtrosSet.add(`${s.docente_id}-${s.dia}-${s.slot}`);
    }
  });

  // Identificar bloques válidos de clase
  const classSlotIndices: number[] = [];
  bloques.forEach((b, idx) => {
    if (b.tipo === "clase") {
      classSlotIndices.push(idx);
    }
  });

  // Verificar slots disponibles por día
  const slotsValidosPorDia = new Map<number, number[]>();
  DIAS.forEach((dia) => {
    let slotsDia = [...classSlotIndices];
    if (dia === 4 && viernesMaxSlot != null) {
      slotsDia = slotsDia.filter((s) => s <= viernesMaxSlot);
    }
    slotsValidosPorDia.set(dia, slotsDia);
  });

  // Total de horas requeridas en la carga
  const horasRequeridas = carga.reduce((sum, c) => sum + (c.horasSemanales || 0), 0);

  // Preparar lista de tareas a programar
  // Cada tarea es una sesión (1 o 2 bloques) de una asignatura
  interface SesionTask {
    id: string;
    asignaturaId: string;
    asignaturaNombre: string;
    asignaturaColor: string;
    docenteId: string | null;
    docenteNombre: string;
    duracion: number; // 1 o 2
    espacioId: string | null;
    prioridad: number; // Mayor prioridad = más difícil de ubicar
  }

  const baseTasks: SesionTask[] = [];
  carga.forEach((item) => {
    if (!item.horasSemanales || item.horasSemanales <= 0) return;
    const sesiones = descomponerHorasEnSesiones(item.horasSemanales, preferBloquesDobles);
    const doc = item.docenteId ? docMap.get(item.docenteId) : null;
    const docDiasCount = doc ? doc.dias.length : 5;
    // Mayor prioridad para asignaturas con más horas o docentes con pocos días disponibles
    const prioridad = (6 - docDiasCount) * 10 + item.horasSemanales;

    sesiones.forEach((duracion, sIdx) => {
      baseTasks.push({
        id: `${item.asignaturaId}-${sIdx}`,
        asignaturaId: item.asignaturaId,
        asignaturaNombre: item.asignaturaNombre,
        asignaturaColor: item.asignaturaColor,
        docenteId: item.docenteId,
        docenteNombre: doc?.nombre || "Sin docente asignado",
        duracion,
        espacioId: item.espacioId || null,
        prioridad,
      });
    });
  });

  // Ordenar tareas por prioridad descendente (las más difíciles primero)
  baseTasks.sort((a, b) => b.prioridad - a.prioridad || b.duracion - a.duracion);

  // Mapa de slots fijos/bloqueados del curso
  const lockedGrid = new Map<string, ExistingSlot>();
  lockedSlotsCurso.forEach((ls) => {
    lockedGrid.set(`${ls.dia}-${ls.slot}`, ls);
  });

  let mejorResultado: SlotGenerado[] = [];
  let mejorPuntaje = -1;

  // Bucle de búsqueda heurística con múltiples reinicios (Monte Carlo / Hill Climbing)
  for (let intento = 0; intento < maxIntentos; intento++) {
    const grid = new Map<string, SlotGenerado>();
    const diasAsignadosPorAsig = new Map<string, Set<number>>();
    carga.forEach((c) => diasAsignadosPorAsig.set(c.asignaturaId, new Set<number>()));

    // Copiar slots fijos
    lockedSlotsCurso.forEach((ls) => {
      if (ls.asignatura_id) {
        grid.set(`${ls.dia}-${ls.slot}`, {
          curso_id: cursoId,
          dia: ls.dia,
          slot: ls.slot,
          asignatura_id: ls.asignatura_id,
          docente_id: ls.docente_id,
          espacio_id: null,
        });
        diasAsignadosPorAsig.get(ls.asignatura_id)?.add(ls.dia);
      }
    });

    // En intentos posteriores a 0, introducimos una ligera aleatoriedad en el orden
    const tasks = [...baseTasks];
    if (intento > 0) {
      // Mezclar ligeramente tareas con prioridades similares
      tasks.sort((a, b) => {
        const diff = b.prioridad - a.prioridad;
        if (Math.abs(diff) <= 2) return Math.random() - 0.5;
        return diff;
      });
    }

    let horasAsignadasIntento = 0;

    // Intentar ubicar cada tarea
    for (const task of tasks) {
      const doc = task.docenteId ? docMap.get(task.docenteId) : null;
      const diasPermitidos = doc ? doc.dias : DIAS;

      // Buscar posibles ubicaciones (dia, slot inicial)
      interface PosibleUbicacion {
        dia: number;
        startSlot: number;
        slots: number[];
        penalizacion: number;
      }
      const candidatos: PosibleUbicacion[] = [];

      // Evaluar cada día
      // Aleatorizar el orden de días evaluados para distribuir mejor
      const diasParaEvaluar = [...DIAS].sort(() => Math.random() - 0.5);

      for (const dia of diasParaEvaluar) {
        if (!diasPermitidos.includes(dia)) continue;
        const slotsDia = slotsValidosPorDia.get(dia) || [];

        // Para sesiones de 2 horas consecutivas
        if (task.duracion === 2) {
          for (let i = 0; i < slotsDia.length - 1; i++) {
            const s1 = slotsDia[i];
            const s2 = slotsDia[i + 1];

            // Comprobar si son consecutivos en el horario escolar
            if (s2 !== s1 + 1) continue;

            const k1 = `${dia}-${s1}`;
            const k2 = `${dia}-${s2}`;

            // Debe estar libre en la grilla del curso
            if (grid.has(k1) || grid.has(k2) || lockedGrid.has(k1) || lockedGrid.has(k2)) {
              continue;
            }

            // Docente libre de bloqueos particulares
            if (task.docenteId) {
              if (docBlocksSet.has(`${task.docenteId}-${k1}`) || docBlocksSet.has(`${task.docenteId}-${k2}`)) {
                continue;
              }
              if (docOcupadoOtrosSet.has(`${task.docenteId}-${k1}`) || docOcupadoOtrosSet.has(`${task.docenteId}-${k2}`)) {
                continue;
              }
            }

            // Calcular penalización (queremos esparcir asignaturas en días distintos)
            let penalizacion = 0;
            if (diasAsignadosPorAsig.get(task.asignaturaId)?.has(dia)) {
              penalizacion += 50; // Ya tiene esta asignatura en este día
            }
            candidatos.push({ dia, startSlot: s1, slots: [s1, s2], penalizacion });
          }
        } else {
          // Sesión de 1 hora
          for (const s of slotsDia) {
            const k = `${dia}-${s}`;
            if (grid.has(k) || lockedGrid.has(k)) continue;

            if (task.docenteId) {
              if (docBlocksSet.has(`${task.docenteId}-${k}`)) continue;
              if (docOcupadoOtrosSet.has(`${task.docenteId}-${k}`)) continue;
            }

            let penalizacion = 0;
            if (diasAsignadosPorAsig.get(task.asignaturaId)?.has(dia)) {
              penalizacion += 50;
            }
            candidatos.push({ dia, startSlot: s, slots: [s], penalizacion });
          }
        }
      }

      // Elegir el mejor candidato
      if (candidatos.length > 0) {
        candidatos.sort((a, b) => a.penalizacion - b.penalizacion);
        // De los mejores con igual penalización mínima, elegir uno aleatorio
        const minPen = candidatos[0].penalizacion;
        const mejores = candidatos.filter((c) => c.penalizacion === minPen);
        const elegido = mejores[Math.floor(Math.random() * mejores.length)];

        // Asignar en la grilla
        elegido.slots.forEach((s) => {
          grid.set(`${elegido.dia}-${s}`, {
            curso_id: cursoId,
            dia: elegido.dia,
            slot: s,
            asignatura_id: task.asignaturaId,
            docente_id: task.docenteId,
            espacio_id: task.espacioId,
          });
        });

        diasAsignadosPorAsig.get(task.asignaturaId)?.add(elegido.dia);
        horasAsignadasIntento += task.duracion;
      }
    }

    // Puntuar el intento
    if (horasAsignadasIntento > mejorPuntaje) {
      mejorPuntaje = horasAsignadasIntento;
      mejorResultado = Array.from(grid.values());

      // Si se asignó el 100% de las horas requeridas, detenemos la búsqueda (solución perfecta)
      if (horasAsignadasIntento >= horasRequeridas) {
        break;
      }
    }
  }

  // Generar balance y detalles por asignatura
  const horasAsignadasMap = new Map<string, number>();
  mejorResultado.forEach((s) => {
    horasAsignadasMap.set(s.asignatura_id, (horasAsignadasMap.get(s.asignatura_id) || 0) + 1);
  });

  const detallesPorAsignatura = carga.map((item) => {
    const doc = item.docenteId ? docMap.get(item.docenteId) : null;
    const asignadas = horasAsignadasMap.get(item.asignaturaId) || 0;
    return {
      asignaturaId: item.asignaturaId,
      asignaturaNombre: item.asignaturaNombre,
      asignaturaColor: item.asignaturaColor,
      docenteNombre: doc?.nombre || "Sin docente asignado",
      horasRequeridas: item.horasSemanales,
      horasAsignadas: asignadas,
      cumplido: asignadas >= item.horasSemanales,
    };
  });

  const advertencias: string[] = [];
  detallesPorAsignatura.forEach((d) => {
    if (!d.cumplido) {
      const faltantes = d.horasRequeridas - d.horasAsignadas;
      advertencias.push(
        `${d.asignaturaNombre} (${d.docenteNombre}): faltaron ${faltantes} bloque(s) por asignar debido a restricciones de disponibilidad horaria o tope de horarios.`
      );
    }
  });

  return {
    cursoId,
    slots: mejorResultado,
    horasAsignadas: mejorPuntaje,
    horasRequeridas,
    completado: mejorPuntaje >= horasRequeridas,
    advertencias,
    detallesPorAsignatura,
  };
}

/**
 * Generador coordinado para múltiples cursos en simultáneo evitando colisiones entre docentes.
 */
export function generarHorariosMultiCurso(
  cursosLista: Array<{
    cursoId: string;
    cursoNombre: string;
    carga: CargaAsignatura[];
  }>,
  configGeneral: {
    colegioId: string;
    bloques: BloqueHorario[];
    docentes: DocenteInfo[];
    docenteBlocks: DocenteBlockInfo[];
    viernesMaxSlot?: number | null;
    preferBloquesDobles?: boolean;
  }
): Map<string, GeneradorResultado> {
  const resultados = new Map<string, GeneradorResultado>();
  const slotsAcumulados: ExistingSlot[] = [];

  for (const curso of cursosLista) {
    const res = generarHorarioCurso({
      cursoId: curso.cursoId,
      cursoNombre: curso.cursoNombre,
      colegioId: configGeneral.colegioId,
      bloques: configGeneral.bloques,
      carga: curso.carga,
      docentes: configGeneral.docentes,
      docenteBlocks: configGeneral.docenteBlocks,
      existingSlotsOtherCourses: slotsAcumulados,
      viernesMaxSlot: configGeneral.viernesMaxSlot,
      preferBloquesDobles: configGeneral.preferBloquesDobles ?? true,
    });

    resultados.set(curso.cursoId, res);

    // Agregar slots generados al pool para que los siguientes cursos no colisionen con los mismos docentes
    res.slots.forEach((s) => {
      slotsAcumulados.push({
        curso_id: s.curso_id,
        dia: s.dia,
        slot: s.slot,
        docente_id: s.docente_id,
        asignatura_id: s.asignatura_id,
      });
    });
  }

  return resultados;
}
