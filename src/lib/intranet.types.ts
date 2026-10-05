export type IntranetCategoria =
  | 'comunicado'
  | 'circular'
  | 'noticia'
  | 'urgente'
  | 'evento';

export type AmbitoDocente =
  | 'general'
  | 'consejo'
  | 'utp'
  | 'departamento'
  | 'convivencia';

export interface IntranetPublicacion {
  id: string;
  colegio_id: string;
  autor_id: string | null;
  autor_nombre?: string | null;
  autor_cargo?: string | null;
  ambito_docente?: AmbitoDocente | null;
  titulo: string;
  extracto: string | null;
  contenido: string;
  categoria: IntranetCategoria;
  destinatarios: string[];
  cursos_destinatarios: string[];
  fijado: boolean;
  archivo_adjunto_url: string | null;
  nombre_adjunto: string | null;
  activo: boolean;
  fecha_publicacion: string;
  created_at: string;
  updated_at: string;

  // Metadata agregada
  autor?: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  leido?: boolean;
  total_lecturas?: number;
}

export interface IntranetDocumento {
  id: string;
  colegio_id: string;
  subido_por: string | null;
  titulo: string;
  descripcion: string | null;
  categoria: string;
  archivo_url: string;
  tamano_bytes: number | null;
  visible_para: string[];
  created_at: string;
  updated_at: string;
}

export interface IntranetLectura {
  id: string;
  publicacion_id: string;
  user_id: string;
  leido_en: string;
}
