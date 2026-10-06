export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alumnos: {
        Row: {
          apellidos: string
          apoderado: string | null
          colegio_id: string
          created_at: string
          curso_id: string
          fecha_ingreso: string | null
          fecha_nacimiento: string | null
          id: string
          nivel: string | null
          nombres: string
          numero_lista: number | null
          retirado_en: string | null
          rut: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          apellidos: string
          apoderado?: string | null
          colegio_id: string
          created_at?: string
          curso_id: string
          fecha_ingreso?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nivel?: string | null
          nombres: string
          numero_lista?: number | null
          retirado_en?: string | null
          rut?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          apellidos?: string
          apoderado?: string | null
          colegio_id?: string
          created_at?: string
          curso_id?: string
          fecha_ingreso?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nivel?: string | null
          nombres?: string
          numero_lista?: number | null
          retirado_en?: string | null
          rut?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      anotaciones: {
        Row: {
          alumno_id: string
          asignatura_id: string | null
          categoria: string | null
          colegio_id: string
          created_at: string
          curso_id: string | null
          descripcion: string
          fecha: string
          id: string
          registrado_por: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          alumno_id: string
          asignatura_id?: string | null
          categoria?: string | null
          colegio_id: string
          created_at?: string
          curso_id?: string | null
          descripcion: string
          fecha?: string
          id?: string
          registrado_por?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          alumno_id?: string
          asignatura_id?: string | null
          categoria?: string | null
          colegio_id?: string
          created_at?: string
          curso_id?: string | null
          descripcion?: string
          fecha?: string
          id?: string
          registrado_por?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anotaciones_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "alumnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anotaciones_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anotaciones_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anotaciones_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      asignaturas: {
        Row: {
          ciclos: string[]
          colegio_id: string
          color: string
          created_at: string
          id: string
          nombre: string
          orden: number
          updated_at: string
        }
        Insert: {
          ciclos?: string[]
          colegio_id: string
          color?: string
          created_at?: string
          id?: string
          nombre: string
          orden?: number
          updated_at?: string
        }
        Update: {
          ciclos?: string[]
          colegio_id?: string
          color?: string
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asignaturas_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
      asistencias: {
        Row: {
          alumno_id: string
          colegio_id: string
          created_at: string
          curso_id: string
          estado: Database["public"]["Enums"]["asistencia_estado"]
          fecha: string
          id: string
          observacion: string | null
          registrado_por: string | null
          updated_at: string
        }
        Insert: {
          alumno_id: string
          colegio_id: string
          created_at?: string
          curso_id: string
          estado?: Database["public"]["Enums"]["asistencia_estado"]
          fecha: string
          id?: string
          observacion?: string | null
          registrado_por?: string | null
          updated_at?: string
        }
        Update: {
          alumno_id?: string
          colegio_id?: string
          created_at?: string
          curso_id?: string
          estado?: Database["public"]["Enums"]["asistencia_estado"]
          fecha?: string
          id?: string
          observacion?: string | null
          registrado_por?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      atrasos: {
        Row: {
          alumno_id: string
          colegio_id: string
          created_at: string
          curso_id: string | null
          fecha: string
          hora: string | null
          id: string
          justificado: boolean
          motivo: string | null
          registrado_por: string | null
          updated_at: string
        }
        Insert: {
          alumno_id: string
          colegio_id: string
          created_at?: string
          curso_id?: string | null
          fecha?: string
          hora?: string | null
          id?: string
          justificado?: boolean
          motivo?: string | null
          registrado_por?: string | null
          updated_at?: string
        }
        Update: {
          alumno_id?: string
          colegio_id?: string
          created_at?: string
          curso_id?: string | null
          fecha?: string
          hora?: string | null
          id?: string
          justificado?: boolean
          motivo?: string | null
          registrado_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atrasos_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "alumnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atrasos_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atrasos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      bloques: {
        Row: {
          colegio_id: string
          created_at: string
          duracion: number
          hora: string
          id: string
          nombre: string
          orden: number
          tipo: Database["public"]["Enums"]["bloque_tipo"]
          updated_at: string
        }
        Insert: {
          colegio_id: string
          created_at?: string
          duracion?: number
          hora: string
          id?: string
          nombre: string
          orden: number
          tipo?: Database["public"]["Enums"]["bloque_tipo"]
          updated_at?: string
        }
        Update: {
          colegio_id?: string
          created_at?: string
          duracion?: number
          hora?: string
          id?: string
          nombre?: string
          orden?: number
          tipo?: Database["public"]["Enums"]["bloque_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloques_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
      calificaciones: {
        Row: {
          alumno_id: string
          asignatura_id: string
          colegio_id: string
          created_at: string
          curso_id: string
          descripcion: string | null
          fecha: string
          id: string
          nota: number
          ponderacion: number
          registrado_por: string | null
          updated_at: string
        }
        Insert: {
          alumno_id: string
          asignatura_id: string
          colegio_id: string
          created_at?: string
          curso_id: string
          descripcion?: string | null
          fecha?: string
          id?: string
          nota: number
          ponderacion?: number
          registrado_por?: string | null
          updated_at?: string
        }
        Update: {
          alumno_id?: string
          asignatura_id?: string
          colegio_id?: string
          created_at?: string
          curso_id?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          nota?: number
          ponderacion?: number
          registrado_por?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      change_log: {
        Row: {
          colegio_id: string
          created_at: string
          descripcion: string
          id: string
          user_id: string
        }
        Insert: {
          colegio_id: string
          created_at?: string
          descripcion: string
          id?: string
          user_id: string
        }
        Update: {
          colegio_id?: string
          created_at?: string
          descripcion?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_log_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
      colegios: {
        Row: {
          activo: boolean
          color_primario: string | null
          config: Json
          created_at: string
          id: string
          logo_url: string | null
          nombre: string
          owner_id: string
          slug: string
          updated_at: string
          viernes_max_slot: number | null
        }
        Insert: {
          activo?: boolean
          color_primario?: string | null
          config?: Json
          created_at?: string
          id?: string
          logo_url?: string | null
          nombre?: string
          owner_id: string
          slug: string
          updated_at?: string
          viernes_max_slot?: number | null
        }
        Update: {
          activo?: boolean
          color_primario?: string | null
          config?: Json
          created_at?: string
          id?: string
          logo_url?: string | null
          nombre?: string
          owner_id?: string
          slug?: string
          updated_at?: string
          viernes_max_slot?: number | null
        }
        Relationships: []
      }
      cursos: {
        Row: {
          asignaturas: Json
          colegio_id: string
          created_at: string
          id: string
          nivel: Database["public"]["Enums"]["nivel_curso"]
          nombre: string
          prof_jefe_id: string | null
          titulares: Json
          updated_at: string
        }
        Insert: {
          asignaturas?: Json
          colegio_id: string
          created_at?: string
          id?: string
          nivel?: Database["public"]["Enums"]["nivel_curso"]
          nombre: string
          prof_jefe_id?: string | null
          titulares?: Json
          updated_at?: string
        }
        Update: {
          asignaturas?: Json
          colegio_id?: string
          created_at?: string
          id?: string
          nivel?: Database["public"]["Enums"]["nivel_curso"]
          nombre?: string
          prof_jefe_id?: string | null
          titulares?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cursos_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_prof_jefe_id_fkey"
            columns: ["prof_jefe_id"]
            isOneToOne: false
            referencedRelation: "docentes"
            referencedColumns: ["id"]
          },
        ]
      }
      docente_blocks: {
        Row: {
          colegio_id: string
          created_at: string
          dia: number
          docente_id: string
          id: string
          motivo: string | null
          slot: number
        }
        Insert: {
          colegio_id: string
          created_at?: string
          dia: number
          docente_id: string
          id?: string
          motivo?: string | null
          slot: number
        }
        Update: {
          colegio_id?: string
          created_at?: string
          dia?: number
          docente_id?: string
          id?: string
          motivo?: string | null
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "docente_blocks_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "docente_blocks_docente_id_fkey"
            columns: ["docente_id"]
            isOneToOne: false
            referencedRelation: "docentes"
            referencedColumns: ["id"]
          },
        ]
      }
      docentes: {
        Row: {
          asignaturas_ciclos: Json
          ciclos: string[]
          colegio_id: string
          color: string
          created_at: string
          dias: number[]
          es_pie: boolean
          ficha: Json
          horario_dias: Json
          horas_utp: number | null
          id: string
          invited_email: string | null
          nombre: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          asignaturas_ciclos?: Json
          ciclos?: string[]
          colegio_id: string
          color?: string
          created_at?: string
          dias?: number[]
          es_pie?: boolean
          ficha?: Json
          horario_dias?: Json
          horas_utp?: number | null
          id?: string
          invited_email?: string | null
          nombre: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          asignaturas_ciclos?: Json
          ciclos?: string[]
          colegio_id?: string
          color?: string
          created_at?: string
          dias?: number[]
          es_pie?: boolean
          ficha?: Json
          horario_dias?: Json
          horas_utp?: number | null
          id?: string
          invited_email?: string | null
          nombre?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "docentes_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
      espacios: {
        Row: {
          colegio_id: string
          color: string
          created_at: string
          id: string
          nombre: string
          tipo: string
          updated_at: string
        }
        Insert: {
          colegio_id: string
          color?: string
          created_at?: string
          id?: string
          nombre: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          colegio_id?: string
          color?: string
          created_at?: string
          id?: string
          nombre?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "espacios_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_bloque: {
        Row: {
          alumno_id: string
          asignatura_id: string | null
          colegio_id: string
          created_at: string
          curso_id: string
          docente_id: string | null
          fecha: string
          id: string
          observacion: string | null
          registrado_por: string | null
          slot: number
          tipo: Database["public"]["Enums"]["evento_bloque_tipo"]
          updated_at: string
        }
        Insert: {
          alumno_id: string
          asignatura_id?: string | null
          colegio_id: string
          created_at?: string
          curso_id: string
          docente_id?: string | null
          fecha: string
          id?: string
          observacion?: string | null
          registrado_por?: string | null
          slot: number
          tipo: Database["public"]["Enums"]["evento_bloque_tipo"]
          updated_at?: string
        }
        Update: {
          alumno_id?: string
          asignatura_id?: string | null
          colegio_id?: string
          created_at?: string
          curso_id?: string
          docente_id?: string | null
          fecha?: string
          id?: string
          observacion?: string | null
          registrado_por?: string | null
          slot?: number
          tipo?: Database["public"]["Enums"]["evento_bloque_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      invitaciones: {
        Row: {
          accepted_at: string | null
          colegio_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          colegio_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          colegio_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: []
      }
      libro_clases: {
        Row: {
          asignatura_id: string | null
          colegio_id: string
          contenido: string
          created_at: string
          curso_id: string
          docente_id: string | null
          fecha: string
          id: string
          objetivo_logrado: boolean
          observaciones: string | null
          registrado_por: string | null
          slot: number | null
          updated_at: string
        }
        Insert: {
          asignatura_id?: string | null
          colegio_id: string
          contenido: string
          created_at?: string
          curso_id: string
          docente_id?: string | null
          fecha: string
          id?: string
          objetivo_logrado?: boolean
          observaciones?: string | null
          registrado_por?: string | null
          slot?: number | null
          updated_at?: string
        }
        Update: {
          asignatura_id?: string | null
          colegio_id?: string
          contenido?: string
          created_at?: string
          curso_id?: string
          docente_id?: string | null
          fecha?: string
          id?: string
          objetivo_logrado?: boolean
          observaciones?: string | null
          registrado_por?: string | null
          slot?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      intranet_publicaciones: {
        Row: {
          activo: boolean
          ambito_docente: string | null
          archivo_adjunto_url: string | null
          autor_cargo: string | null
          autor_id: string | null
          autor_nombre: string | null
          categoria: Database["public"]["Enums"]["intranet_categoria"]
          colegio_id: string
          contenido: string
          created_at: string
          cursos_destinatarios: string[] | null
          destinatarios: string[]
          extracto: string | null
          fecha_publicacion: string
          fijado: boolean
          id: string
          nombre_adjunto: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          ambito_docente?: string | null
          archivo_adjunto_url?: string | null
          autor_cargo?: string | null
          autor_id?: string | null
          autor_nombre?: string | null
          categoria?: Database["public"]["Enums"]["intranet_categoria"]
          colegio_id: string
          contenido: string
          created_at?: string
          cursos_destinatarios?: string[] | null
          destinatarios?: string[]
          extracto?: string | null
          fecha_publicacion?: string
          fijado?: boolean
          id?: string
          nombre_adjunto?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          ambito_docente?: string | null
          archivo_adjunto_url?: string | null
          autor_cargo?: string | null
          autor_id?: string | null
          autor_nombre?: string | null
          categoria?: Database["public"]["Enums"]["intranet_categoria"]
          colegio_id?: string
          contenido?: string
          created_at?: string
          cursos_destinatarios?: string[] | null
          destinatarios?: string[]
          extracto?: string | null
          fecha_publicacion?: string
          fijado?: boolean
          id?: string
          nombre_adjunto?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intranet_publicaciones_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
      intranet_documentos: {
        Row: {
          archivo_url: string
          categoria: string
          colegio_id: string
          created_at: string
          descripcion: string | null
          id: string
          subido_por: string | null
          tamano_bytes: number | null
          titulo: string
          updated_at: string
          visible_para: string[]
        }
        Insert: {
          archivo_url: string
          categoria?: string
          colegio_id: string
          created_at?: string
          descripcion?: string | null
          id?: string
          subido_por?: string | null
          tamano_bytes?: number | null
          titulo: string
          updated_at?: string
          visible_para?: string[]
        }
        Update: {
          archivo_url?: string
          categoria?: string
          colegio_id?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          subido_por?: string | null
          tamano_bytes?: number | null
          titulo?: string
          updated_at?: string
          visible_para?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "intranet_documentos_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
      intranet_lecturas: {
        Row: {
          id: string
          leido_en: string
          publicacion_id: string
          user_id: string
        }
        Insert: {
          id?: string
          leido_en?: string
          publicacion_id: string
          user_id: string
        }
        Update: {
          id?: string
          leido_en?: string
          publicacion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intranet_lecturas_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "intranet_publicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      periodos_matricula: {
        Row: {
          activo: boolean
          anio: number
          colegio_id: string
          created_at: string
          cupos_por_curso: Json
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          instrucciones: string | null
          nombre: string
          requiere_documentos: boolean
          updated_at: string
        }
        Insert: {
          activo?: boolean
          anio: number
          colegio_id: string
          created_at?: string
          cupos_por_curso?: Json
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          instrucciones?: string | null
          nombre: string
          requiere_documentos?: boolean
          updated_at?: string
        }
        Update: {
          activo?: boolean
          anio?: number
          colegio_id?: string
          created_at?: string
          cupos_por_curso?: Json
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          instrucciones?: string | null
          nombre?: string
          requiere_documentos?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "periodos_matricula_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
      matriculas: {
        Row: {
          alergias_enfermedades: string | null
          alumno_id: string | null
          apoderado_suplente_email: string | null
          apoderado_suplente_nombres: string | null
          apoderado_suplente_parentesco: string | null
          apoderado_suplente_rut: string | null
          apoderado_suplente_telefono: string | null
          apoderado_titular_apellidos: string
          apoderado_titular_direccion: string | null
          apoderado_titular_email: string | null
          apoderado_titular_nivel_estudios: string | null
          apoderado_titular_nombres: string
          apoderado_titular_ocupacion: string | null
          apoderado_titular_parentesco: string
          apoderado_titular_rut: string
          apoderado_titular_telefono: string
          codigo_seguimiento: string
          colegio_id: string
          colegio_procedencia: string | null
          created_at: string
          curso_asignado_id: string | null
          curso_postula_id: string | null
          diagnostico_pie: string | null
          es_pie: boolean
          estado: Database["public"]["Enums"]["matricula_estado"]
          estudiante_apellidos: string
          estudiante_comuna: string | null
          estudiante_direccion: string | null
          estudiante_fecha_nacimiento: string | null
          estudiante_genero: string | null
          estudiante_nacionalidad: string | null
          estudiante_nombres: string
          estudiante_region: string | null
          estudiante_rut: string | null
          estudiante_vive_con: string | null
          fecha_aprobacion: string | null
          id: string
          medicamentos: string | null
          numero_matricula: number | null
          observaciones_apoderado: string | null
          observaciones_internas: string | null
          periodo_id: string
          prevision_salud: string | null
          prioritario_preferente: boolean
          repite_grado: boolean
          revisado_por: string | null
          updated_at: string
        }
        Insert: {
          alergias_enfermedades?: string | null
          alumno_id?: string | null
          apoderado_suplente_email?: string | null
          apoderado_suplente_nombres?: string | null
          apoderado_suplente_parentesco?: string | null
          apoderado_suplente_rut?: string | null
          apoderado_suplente_telefono?: string | null
          apoderado_titular_apellidos: string
          apoderado_titular_direccion?: string | null
          apoderado_titular_email?: string | null
          apoderado_titular_nivel_estudios?: string | null
          apoderado_titular_nombres: string
          apoderado_titular_ocupacion?: string | null
          apoderado_titular_parentesco?: string
          apoderado_titular_rut: string
          apoderado_titular_telefono: string
          codigo_seguimiento?: string
          colegio_id: string
          colegio_procedencia?: string | null
          created_at?: string
          curso_asignado_id?: string | null
          curso_postula_id?: string | null
          diagnostico_pie?: string | null
          es_pie?: boolean
          estado?: Database["public"]["Enums"]["matricula_estado"]
          estudiante_apellidos: string
          estudiante_comuna?: string | null
          estudiante_direccion?: string | null
          estudiante_fecha_nacimiento?: string | null
          estudiante_genero?: string | null
          estudiante_nacionalidad?: string | null
          estudiante_nombres: string
          estudiante_region?: string | null
          estudiante_rut?: string | null
          estudiante_vive_con?: string | null
          fecha_aprobacion?: string | null
          id?: string
          medicamentos?: string | null
          numero_matricula?: number | null
          observaciones_apoderado?: string | null
          observaciones_internas?: string | null
          periodo_id: string
          prevision_salud?: string | null
          prioritario_preferente?: boolean
          repite_grado?: boolean
          revisado_por?: string | null
          updated_at?: string
        }
        Update: {
          alergias_enfermedades?: string | null
          alumno_id?: string | null
          apoderado_suplente_email?: string | null
          apoderado_suplente_nombres?: string | null
          apoderado_suplente_parentesco?: string | null
          apoderado_suplente_rut?: string | null
          apoderado_suplente_telefono?: string | null
          apoderado_titular_apellidos?: string
          apoderado_titular_direccion?: string | null
          apoderado_titular_email?: string | null
          apoderado_titular_nivel_estudios?: string | null
          apoderado_titular_nombres?: string
          apoderado_titular_ocupacion?: string | null
          apoderado_titular_parentesco?: string
          apoderado_titular_rut?: string
          apoderado_titular_telefono?: string
          codigo_seguimiento?: string
          colegio_id?: string
          colegio_procedencia?: string | null
          created_at?: string
          curso_asignado_id?: string | null
          curso_postula_id?: string | null
          diagnostico_pie?: string | null
          es_pie?: boolean
          estado?: Database["public"]["Enums"]["matricula_estado"]
          estudiante_apellidos?: string
          estudiante_comuna?: string | null
          estudiante_direccion?: string | null
          estudiante_fecha_nacimiento?: string | null
          estudiante_genero?: string | null
          estudiante_nacionalidad?: string | null
          estudiante_nombres?: string
          estudiante_region?: string | null
          estudiante_rut?: string | null
          estudiante_vive_con?: string | null
          fecha_aprobacion?: string | null
          id?: string
          medicamentos?: string | null
          numero_matricula?: number | null
          observaciones_apoderado?: string | null
          observaciones_internas?: string | null
          periodo_id?: string
          prevision_salud?: string | null
          prioritario_preferente?: boolean
          repite_grado?: boolean
          revisado_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "periodos_matricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "alumnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_curso_postula_id_fkey"
            columns: ["curso_postula_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_curso_asignado_id_fkey"
            columns: ["curso_asignado_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      matricula_documentos: {
        Row: {
          archivo_url: string
          created_at: string
          estado: string
          id: string
          matricula_id: string
          nombre_archivo: string
          observacion: string | null
          tipo_documento: string
        }
        Insert: {
          archivo_url: string
          created_at?: string
          estado?: string
          id?: string
          matricula_id: string
          nombre_archivo: string
          observacion?: string | null
          tipo_documento: string
        }
        Update: {
          archivo_url?: string
          created_at?: string
          estado?: string
          id?: string
          matricula_id?: string
          nombre_archivo?: string
          observacion?: string | null
          tipo_documento?: string
        }
        Relationships: [
          {
            foreignKeyName: "matricula_documentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      objetivos_aprendizaje: {
        Row: {
          asignatura_id: string
          codigo: string | null
          colegio_id: string
          created_at: string
          descripcion: string
          id: string
          nivel: string | null
          unidad_id: string | null
          updated_at: string
        }
        Insert: {
          asignatura_id: string
          codigo?: string | null
          colegio_id: string
          created_at?: string
          descripcion: string
          id?: string
          nivel?: string | null
          unidad_id?: string | null
          updated_at?: string
        }
        Update: {
          asignatura_id?: string
          codigo?: string | null
          colegio_id?: string
          created_at?: string
          descripcion?: string
          id?: string
          nivel?: string | null
          unidad_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objetivos_aprendizaje_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objetivos_aprendizaje_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objetivos_aprendizaje_unidad_id_fkey"
            columns: ["unidad_id"]
            isOneToOne: false
            referencedRelation: "unidades_curriculares"
            referencedColumns: ["id"]
          },
        ]
      }
      pie_plan: {
        Row: {
          asignatura_id: string | null
          colegio_id: string
          created_at: string
          curso_id: string | null
          dia: number
          docente_id: string
          docente_titular_id: string | null
          id: string
          slot: number
          tipo: Database["public"]["Enums"]["pie_tipo"]
        }
        Insert: {
          asignatura_id?: string | null
          colegio_id: string
          created_at?: string
          curso_id?: string | null
          dia: number
          docente_id: string
          docente_titular_id?: string | null
          id?: string
          slot: number
          tipo: Database["public"]["Enums"]["pie_tipo"]
        }
        Update: {
          asignatura_id?: string | null
          colegio_id?: string
          created_at?: string
          curso_id?: string | null
          dia?: number
          docente_id?: string
          docente_titular_id?: string | null
          id?: string
          slot?: number
          tipo?: Database["public"]["Enums"]["pie_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "pie_plan_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pie_plan_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pie_plan_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pie_plan_docente_id_fkey"
            columns: ["docente_id"]
            isOneToOne: false
            referencedRelation: "docentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pie_plan_docente_titular_id_fkey"
            columns: ["docente_titular_id"]
            isOneToOne: false
            referencedRelation: "docentes"
            referencedColumns: ["id"]
          },
        ]
      }
      planificaciones: {
        Row: {
          anio: number
          asignatura_id: string
          colegio_id: string
          created_at: string
          docente_id: string
          estado: Database["public"]["Enums"]["planif_estado"]
          fecha: string | null
          id: string
          mes: number
          objetivo: string | null
          observaciones: string | null
          updated_at: string
        }
        Insert: {
          anio: number
          asignatura_id: string
          colegio_id: string
          created_at?: string
          docente_id: string
          estado?: Database["public"]["Enums"]["planif_estado"]
          fecha?: string | null
          id?: string
          mes: number
          objetivo?: string | null
          observaciones?: string | null
          updated_at?: string
        }
        Update: {
          anio?: number
          asignatura_id?: string
          colegio_id?: string
          created_at?: string
          docente_id?: string
          estado?: Database["public"]["Enums"]["planif_estado"]
          fecha?: string | null
          id?: string
          mes?: number
          objetivo?: string | null
          observaciones?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planificaciones_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planificaciones_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planificaciones_docente_id_fkey"
            columns: ["docente_id"]
            isOneToOne: false
            referencedRelation: "docentes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          colegio_id: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          colegio_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          colegio_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
      reemplazantes: {
        Row: {
          asignaturas: Json
          colegio_id: string
          created_at: string
          docente_id: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          observaciones: string | null
          titular_id: string | null
          updated_at: string
        }
        Insert: {
          asignaturas?: Json
          colegio_id: string
          created_at?: string
          docente_id: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          observaciones?: string | null
          titular_id?: string | null
          updated_at?: string
        }
        Update: {
          asignaturas?: Json
          colegio_id?: string
          created_at?: string
          docente_id?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          observaciones?: string | null
          titular_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reemplazantes_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reemplazantes_docente_id_fkey"
            columns: ["docente_id"]
            isOneToOne: false
            referencedRelation: "docentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reemplazantes_titular_id_fkey"
            columns: ["titular_id"]
            isOneToOne: false
            referencedRelation: "docentes"
            referencedColumns: ["id"]
          },
        ]
      }
      retiros: {
        Row: {
          alumno_id: string
          colegio_id: string
          created_at: string
          curso_id: string | null
          fecha: string
          hora: string | null
          id: string
          motivo: string | null
          registrado_por: string | null
          retirado_por: string | null
          updated_at: string
        }
        Insert: {
          alumno_id: string
          colegio_id: string
          created_at?: string
          curso_id?: string | null
          fecha?: string
          hora?: string | null
          id?: string
          motivo?: string | null
          registrado_por?: string | null
          retirado_por?: string | null
          updated_at?: string
        }
        Update: {
          alumno_id?: string
          colegio_id?: string
          created_at?: string
          curso_id?: string | null
          fecha?: string
          hora?: string | null
          id?: string
          motivo?: string | null
          registrado_por?: string | null
          retirado_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retiros_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "alumnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retiros_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retiros_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_slots: {
        Row: {
          asignatura_id: string | null
          asistente_id: string | null
          colegio_id: string
          created_at: string
          curso_id: string
          dia: number
          docente_id: string | null
          espacio_id: string | null
          id: string
          slot: number
          updated_at: string
        }
        Insert: {
          asignatura_id?: string | null
          asistente_id?: string | null
          colegio_id: string
          created_at?: string
          curso_id: string
          dia: number
          docente_id?: string | null
          espacio_id?: string | null
          id?: string
          slot: number
          updated_at?: string
        }
        Update: {
          asignatura_id?: string | null
          asistente_id?: string | null
          colegio_id?: string
          created_at?: string
          curso_id?: string
          dia?: number
          docente_id?: string | null
          espacio_id?: string | null
          id?: string
          slot?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_slots_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_asistente_id_fkey"
            columns: ["asistente_id"]
            isOneToOne: false
            referencedRelation: "docentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_docente_id_fkey"
            columns: ["docente_id"]
            isOneToOne: false
            referencedRelation: "docentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_espacio_id_fkey"
            columns: ["espacio_id"]
            isOneToOne: false
            referencedRelation: "espacios"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades_curriculares: {
        Row: {
          asignatura_id: string
          colegio_id: string
          created_at: string
          descripcion: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          nivel: string | null
          numero: number | null
          titulo: string
          updated_at: string
        }
        Insert: {
          asignatura_id: string
          colegio_id: string
          created_at?: string
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          nivel?: string | null
          numero?: number | null
          titulo: string
          updated_at?: string
        }
        Update: {
          asignatura_id?: string
          colegio_id?: string
          created_at?: string
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          nivel?: string | null
          numero?: number | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_curriculares_asignatura_id_fkey"
            columns: ["asignatura_id"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_curriculares_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          colegio_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          colegio_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          colegio_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_colegio_id_fkey"
            columns: ["colegio_id"]
            isOneToOne: false
            referencedRelation: "colegios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit: {
        Args: { _colegio_id: string; _user_id: string }
        Returns: boolean
      }
      colegio_id_by_slug: { Args: { _slug: string }; Returns: string }
      consultar_seguimiento_matricula: {
        Args: { p_codigo?: string; p_rut?: string }
        Returns: {
          id: string
          codigo_seguimiento: string
          estado: string
          numero_matricula: number | null
          estudiante_nombres: string
          estudiante_apellidos: string
          estudiante_rut: string | null
          curso_postula_nombre: string | null
          curso_asignado_nombre: string | null
          apoderado_titular_nombre: string
          observaciones_colegio: string | null
          created_at: string
        }
      }
      aprobar_matricula: {
        Args: {
          p_matricula_id: string
          p_curso_id: string
          p_revisor_id?: string | null
        }
        Returns: Json
      }
      has_any_role: {
        Args: { _colegio_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _colegio_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_docente_only: {
        Args: { _colegio_id: string; _user_id: string }
        Returns: boolean
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      link_pending_invitations: {
        Args: never
        Returns: {
          colegio_id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      my_docente_id: {
        Args: { _colegio_id: string; _user_id: string }
        Returns: string
      }
      user_colegio_id: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "editor"
        | "viewer"
        | "utp"
        | "docente"
        | "superadmin"
        | "direccion"
        | "inspectoria"
      asistencia_estado: "presente" | "ausente" | "atrasado" | "justificado"
      bloque_tipo: "clase" | "recreo" | "almuerzo"
      evento_bloque_tipo:
        | "retiro"
        | "atraso"
        | "salida_temprana"
      matricula_estado:
        | "borrador"
        | "solicitada"
        | "en_revision"
        | "observada"
        | "aprobada"
        | "rechazada"
        | "retirada"
      intranet_categoria:
        | "comunicado"
        | "circular"
        | "noticia"
        | "urgente"
        | "evento"
        | "observacion"
        | "ausencia_parcial"
      nivel_curso: "prebásica" | "1er ciclo" | "2do ciclo"
      pie_tipo: "aula_recurso" | "acompanamiento"
      planif_estado: "pendiente" | "entregada" | "revisada" | "aprobada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "editor",
        "viewer",
        "utp",
        "docente",
        "superadmin",
        "direccion",
        "inspectoria",
      ],
      asistencia_estado: ["presente", "ausente", "atrasado", "justificado"],
      bloque_tipo: ["clase", "recreo", "almuerzo"],
      evento_bloque_tipo: [
        "retiro",
        "atraso",
        "salida_temprana",
        "observacion",
        "ausencia_parcial",
      ],
      nivel_curso: ["prebásica", "1er ciclo", "2do ciclo"],
      pie_tipo: ["aula_recurso", "acompanamiento"],
      planif_estado: ["pendiente", "entregada", "revisada", "aprobada"],
    },
  },
} as const
