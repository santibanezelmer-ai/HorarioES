-- ============================================================
-- HORARIOES — SCRIPT DE ACTUALIZACIÓN: INTRANET DOCENTES Y APODERADOS
-- Ejecutar en Supabase SQL Editor (sxadthmnijgitmxpdjbu)
-- ============================================================

-- 1. COLUMNAS ADICIONALES PARA INTRANET SEGMENTADA
ALTER TABLE public.intranet_publicaciones
  ADD COLUMN IF NOT EXISTS autor_nombre TEXT,
  ADD COLUMN IF NOT EXISTS autor_cargo TEXT,
  ADD COLUMN IF NOT EXISTS ambito_docente TEXT DEFAULT 'general';

-- Comentarios explicativos
COMMENT ON COLUMN public.intranet_publicaciones.autor_nombre IS 'Nombre visible del autor (ej. Prof. Juan Pérez o Dirección)';
COMMENT ON COLUMN public.intranet_publicaciones.autor_cargo IS 'Cargo o jefatura del autor (ej. Profesor Jefe 2° Básico, UTP)';
COMMENT ON COLUMN public.intranet_publicaciones.ambito_docente IS 'Ámbito pedagógico interno: consejo, utp, departamento, convivencia o general';

-- 2. ACTUALIZACIÓN DE POLÍTICAS RLS EN PUBLICACIONES
-- Permitir que docentes, inspectores, utp, directivos y administradores publiquen
DROP POLICY IF EXISTS "Staff can manage publications" ON public.intranet_publicaciones;
DROP POLICY IF EXISTS "Staff and teachers can insert publications" ON public.intranet_publicaciones;
DROP POLICY IF EXISTS "Staff and teachers can update publications" ON public.intranet_publicaciones;
DROP POLICY IF EXISTS "Staff and teachers can delete publications" ON public.intranet_publicaciones;

-- Inserción: Directivos, UTP, Inspectores, Docentes y Admin
CREATE POLICY "Staff and teachers can insert publications" ON public.intranet_publicaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    colegio_id = public.user_colegio_id(auth.uid())
    AND (
      public.has_role(auth.uid(), colegio_id, 'admin')
      OR public.has_role(auth.uid(), colegio_id, 'direccion')
      OR public.has_role(auth.uid(), colegio_id, 'utp')
      OR public.has_role(auth.uid(), colegio_id, 'inspectoria')
      OR public.has_role(auth.uid(), colegio_id, 'docente')
      OR public.is_superadmin(auth.uid())
    )
  );

-- Actualización: El propio autor O Directivos/Admin/UTP del colegio
CREATE POLICY "Staff and teachers can update publications" ON public.intranet_publicaciones
  FOR UPDATE TO authenticated
  USING (
    colegio_id = public.user_colegio_id(auth.uid())
    AND (
      autor_id = auth.uid()
      OR public.has_role(auth.uid(), colegio_id, 'admin')
      OR public.has_role(auth.uid(), colegio_id, 'direccion')
      OR public.has_role(auth.uid(), colegio_id, 'utp')
      OR public.is_superadmin(auth.uid())
    )
  )
  WITH CHECK (
    colegio_id = public.user_colegio_id(auth.uid())
  );

-- Eliminación: El propio autor O Directivos/Admin
CREATE POLICY "Staff and teachers can delete publications" ON public.intranet_publicaciones
  FOR DELETE TO authenticated
  USING (
    colegio_id = public.user_colegio_id(auth.uid())
    AND (
      autor_id = auth.uid()
      OR public.has_role(auth.uid(), colegio_id, 'admin')
      OR public.has_role(auth.uid(), colegio_id, 'direccion')
      OR public.is_superadmin(auth.uid())
    )
  );

-- 3. PERMISOS DE SUBIDA DE ARCHIVOS A STORAGE INTRANET
DO $$ BEGIN
  DROP POLICY IF EXISTS "Teachers and staff can upload to intranet" ON storage.objects;
  CREATE POLICY "Teachers and staff can upload to intranet" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'intranet');
EXCEPTION WHEN OTHERS THEN null;
END $$;

-- 4. FUNCIÓN PARA OBTENER RESUMEN DE LECTURAS POR PUBLICACIÓN
CREATE OR REPLACE FUNCTION public.fn_resumen_lecturas_publicacion(p_publicacion_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total INTEGER;
  v_colegio_id UUID;
BEGIN
  -- Verificar existencia
  SELECT colegio_id INTO v_colegio_id
  FROM public.intranet_publicaciones
  WHERE id = p_publicacion_id;

  IF v_colegio_id IS NULL THEN
    RETURN jsonb_build_object('total', 0, 'usuarios', '[]'::jsonb);
  END IF;

  SELECT count(*) INTO v_total
  FROM public.intranet_lecturas
  WHERE publicacion_id = p_publicacion_id;

  RETURN jsonb_build_object(
    'publicacion_id', p_publicacion_id,
    'total_lecturas', v_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. ÍNDICES DE RENDIMIENTO PARA FILTROS DE DESTINATARIOS Y CURSOS
CREATE INDEX IF NOT EXISTS idx_intranet_destinatarios ON public.intranet_publicaciones USING GIN (destinatarios);
CREATE INDEX IF NOT EXISTS idx_intranet_cursos ON public.intranet_publicaciones USING GIN (cursos_destinatarios);
CREATE INDEX IF NOT EXISTS idx_intranet_ambito ON public.intranet_publicaciones (colegio_id, ambito_docente);
