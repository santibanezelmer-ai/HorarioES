export type MatriculaEstado =
  | 'borrador'
  | 'solicitada'
  | 'en_revision'
  | 'observada'
  | 'aprobada'
  | 'rechazada'
  | 'retirada';

export interface PeriodoMatricula {
  id: string;
  colegio_id: string;
  anio: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  activo: boolean;
  requiere_documentos: boolean;
  cupos_por_curso: Record<string, number>;
  instrucciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface Matricula {
  id: string;
  colegio_id: string;
  periodo_id: string;
  alumno_id: string | null;
  curso_postula_id: string | null;
  curso_asignado_id: string | null;
  numero_matricula: number | null;
  codigo_seguimiento: string;
  estado: MatriculaEstado;

  // Estudiante
  estudiante_nombres: string;
  estudiante_apellidos: string;
  estudiante_rut: string | null;
  estudiante_fecha_nacimiento: string | null;
  estudiante_genero: string | null;
  estudiante_nacionalidad: string | null;
  estudiante_direccion: string | null;
  estudiante_comuna: string | null;
  estudiante_region: string | null;
  estudiante_vive_con: string | null;
  es_pie: boolean;
  diagnostico_pie: string | null;
  prevision_salud: string | null;
  alergias_enfermedades: string | null;
  medicamentos: string | null;

  // Apoderado Titular
  apoderado_titular_nombres: string;
  apoderado_titular_apellidos: string;
  apoderado_titular_rut: string;
  apoderado_titular_parentesco: string;
  apoderado_titular_telefono: string;
  apoderado_titular_email: string | null;
  apoderado_titular_direccion: string | null;
  apoderado_titular_nivel_estudios: string | null;
  apoderado_titular_ocupacion: string | null;

  // Apoderado Suplente
  apoderado_suplente_nombres: string | null;
  apoderado_suplente_rut: string | null;
  apoderado_suplente_telefono: string | null;
  apoderado_suplente_parentesco: string | null;
  apoderado_suplente_email: string | null;

  // Antecedentes
  colegio_procedencia: string | null;
  repite_grado: boolean;
  prioritario_preferente: boolean;
  observaciones_apoderado: string | null;
  observaciones_internas: string | null;

  // Auditoría
  revisado_por: string | null;
  fecha_aprobacion: string | null;
  created_at: string;
  updated_at: string;

  // Joins
  cursos_postula?: { id: string; nombre: string; nivel: string | null } | null;
  cursos_asignado?: { id: string; nombre: string; nivel: string | null } | null;
  periodos_matricula?: { id: string; anio: number; nombre: string } | null;
}

export interface MatriculaDocumento {
  id: string;
  matricula_id: string;
  tipo_documento: string;
  nombre_archivo: string;
  archivo_url: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  observacion: string | null;
  created_at: string;
}
