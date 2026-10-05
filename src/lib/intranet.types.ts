export type IntranetCategoria =
  | 'comunicado'
  | 'circular'
  | 'noticia'
  | 'urgente'
  | 'evento';

export interface IntranetPublicacion {
  id: string;
  colegio_id: string;
  autor_id: string | null;
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

  // Joined metadata
  autor?: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  leido?: boolean;
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
