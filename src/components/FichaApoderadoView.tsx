import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  GraduationCap,
  ClipboardList,
  ShieldCheck,
  TrendingUp,
  Clock,
  User,
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { type MyAlumno } from "@/lib/use-my-alumnos";
import { getFichaAlumnoSecure } from "@/lib/apoderados.functions";
import { PrivacyShield } from "@/components/PrivacyShield";

interface Props {
  alumnos: MyAlumno[];
  colegioId: string;
}

export function FichaApoderadoView({ alumnos, colegioId }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [selectedAlumnoId, setSelectedAlumnoId] = useState<string>(
    alumnos[0]?.id ?? ""
  );

  const alumnoActual = useMemo(
    () => alumnos.find((a) => a.id === selectedAlumnoId) ?? alumnos[0],
    [alumnos, selectedAlumnoId]
  );

  const alumnoId = alumnoActual?.id;

  // Cargar datos escolares mediante Server Function con verificación Zero-Trust en el backend
  const { data, isLoading } = useQuery({
    queryKey: ["ficha-apoderado-detalle-secure", alumnoId, colegioId, accessToken],
    enabled: !!alumnoId && !!accessToken,
    staleTime: 60_000,
    queryFn: async () => {
      return await getFichaAlumnoSecure({
        data: {
          accessToken: accessToken!,
          colegioId: colegioId || undefined,
          alumnoId: alumnoId!,
        },
      });
    },
  });

  const asigMap = useMemo(() => {
    return new Map((data?.asigs ?? []).map((a) => [a.id, a]));
  }, [data?.asigs]);

  // Cálculos de estadísticas
  const stats = useMemo(() => {
    if (!data) return null;
    const totalClases = data.asis.length;
    const presentes = data.asis.filter((a) => a.estado === "presente").length;
    const ausentes = data.asis.filter((a) => a.estado === "ausente").length;
    const pctAsistencia = totalClases ? Math.round((presentes / totalClases) * 100) : 100;

    // Promedio general
    let sumW = 0;
    let sumWV = 0;
    for (const c of data.califs) {
      const w = Number(c.ponderacion ?? 1);
      sumW += w;
      sumWV += Number(c.nota) * w;
    }
    const promedioGeneral = sumW > 0 ? (sumWV / sumW).toFixed(1) : "—";

    // Notas agrupadas por asignatura
    const porAsignatura = new Map<
      string,
      { notas: typeof data.califs; sum: number; w: number }
    >();

    for (const c of data.califs) {
      if (!c.asignatura_id) continue;
      const cur = porAsignatura.get(c.asignatura_id) ?? {
        notas: [],
        sum: 0,
        w: 0,
      };
      const w = Number(c.ponderacion ?? 1);
      cur.sum += Number(c.nota) * w;
      cur.w += w;
      cur.notas.push(c);
      porAsignatura.set(c.asignatura_id, cur);
    }

    return {
      totalClases,
      presentes,
      ausentes,
      pctAsistencia,
      promedioGeneral,
      porAsignatura,
    };
  }, [data]);

  if (!alumnoActual) {
    return (
      <div className="p-8 text-center bg-surface border border-border rounded-xl">
        <User className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold text-base">No hay alumnos asociados a tu cuenta</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Si eres apoderado del colegio, solicita en secretaría o dirección que vinculen tu correo institucional a la ficha de matrícula de tu pupilo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector de estudiante si tiene más de 1 */}
      {alumnos.length > 1 && (
        <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl">
          <span className="text-xs font-semibold text-muted-foreground">Estudiante:</span>
          <div className="flex items-center gap-2 flex-wrap">
            {alumnos.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAlumnoId(a.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  a.id === alumnoActual.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-surface-2 hover:bg-surface-2/80 text-foreground"
                }`}
              >
                {a.nombres} {a.apellidos} ({a.curso_nombre})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cabecera del Estudiante */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-elegant flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0">
            {alumnoActual.nombres[0]}
            {alumnoActual.apellidos[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {alumnoActual.nombres} {alumnoActual.apellidos}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
              <span className="font-semibold text-foreground bg-surface-2 px-2 py-0.5 rounded-md border border-border/60">
                {alumnoActual.curso_nombre}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                <span>RUN:</span>
                <PrivacyShield
                  value={alumnoActual.rut}
                  type="rut"
                  copyable={true}
                  label={`RUN de ${alumnoActual.nombres}`}
                />
              </span>
              {alumnoActual.numero_lista && (
                <>
                  <span>·</span>
                  <span>N° de lista: {alumnoActual.numero_lista}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Resumen rápido de indicadores */}
        <div className="flex items-center gap-4 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-border justify-around md:justify-end">
          <div className="text-center md:text-right">
            <div className="text-2xl font-extrabold text-foreground">
              {stats?.promedioGeneral ?? "—"}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium">
              Promedio General
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center md:text-right">
            <div
              className={`text-2xl font-extrabold ${
                (stats?.pctAsistencia ?? 100) >= 85 ? "text-emerald-500" : "text-amber-500"
              }`}
            >
              {stats?.pctAsistencia ?? 100}%
            </div>
            <div className="text-[11px] text-muted-foreground font-medium">
              Asistencia
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          Cargando datos escolares de {alumnoActual.nombres}…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Notas por Asignatura (2 columnas en desktop) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-sm text-foreground">
                    Calificaciones y Rendimiento por Asignatura
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  Escala 1.0 a 7.0
                </span>
              </div>

              {(!stats || stats.porAsignatura.size === 0) ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Aún no se han registrado calificaciones para este período.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {Array.from(stats.porAsignatura.entries()).map(([asigId, item]) => {
                    const asig = asigMap.get(asigId);
                    const promedioAsig = (item.sum / item.w).toFixed(1);
                    const isAprobado = Number(promedioAsig) >= 4.0;

                    return (
                      <div key={asigId} className="py-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ background: asig?.color ?? "#3b82f6" }}
                            />
                            <span className="font-semibold text-sm text-foreground">
                              {asig?.nombre ?? "Asignatura"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Promedio:</span>
                            <span
                              className={`font-mono font-bold text-sm px-2 py-0.5 rounded ${
                                isAprobado
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-destructive/10 text-destructive"
                              }`}
                            >
                              {promedioAsig}
                            </span>
                          </div>
                        </div>

                        {/* Fila de notas parciales */}
                        <div className="flex items-center gap-2 flex-wrap pl-5">
                          {item.notas.map((n, i) => (
                            <div
                              key={i}
                              title={`${n.descripcion || "Nota"} (${n.fecha})`}
                              className={`px-2 py-1 rounded text-xs font-mono font-semibold border ${
                                Number(n.nota) >= 4.0
                                  ? "bg-surface-2 border-border/80 text-foreground"
                                  : "bg-destructive/10 border-destructive/30 text-destructive"
                              }`}
                            >
                              {Number(n.nota).toFixed(1)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Anotaciones e Inspectoría */}
          <div className="space-y-6">
            {/* Anotaciones */}
            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-sm text-foreground">
                    Hoja de Vida y Anotaciones
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  {data?.anots.length ?? 0} registradas
                </span>
              </div>

              {(!data?.anots || data.anots.length === 0) ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No registra anotaciones de convivencia en el período.
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {data.anots.map((an, i) => {
                    const isPositiva = an.tipo === "positiva";
                    return (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border text-xs space-y-1 ${
                          isPositiva
                            ? "bg-emerald-500/5 border-emerald-500/30"
                            : "bg-destructive/5 border-destructive/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-semibold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded ${
                              isPositiva
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-destructive/20 text-destructive"
                            }`}
                          >
                            {an.tipo}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {an.fecha}
                          </span>
                        </div>
                        <p className="text-foreground leading-relaxed">
                          {an.descripcion}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Atrasos y Asistencia */}
            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <h3 className="font-bold text-sm text-foreground">
                    Puntualidad y Atrasos
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  {data?.atrasos.length ?? 0} atrasos
                </span>
              </div>

              {(!data?.atrasos || data.atrasos.length === 0) ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  Sin registros de atrasos. ¡Excelente puntualidad!
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {data.atrasos.map((at, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-md bg-surface-2 text-xs"
                    >
                      <div>
                        <span className="font-medium text-foreground">{at.fecha}</span>
                        {at.hora && (
                          <span className="text-muted-foreground ml-1.5">
                            ({at.hora})
                          </span>
                        )}
                        {at.motivo && (
                          <div className="text-[11px] text-muted-foreground">
                            {at.motivo}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          at.justificado
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {at.justificado ? "Justificado" : "Sin justificar"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
