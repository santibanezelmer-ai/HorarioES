// Catálogo central de roles, módulos y matriz de permisos.
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  GraduationCap,
  BookMarked,
  Users,
  UserCog,
  CalendarRange,
  Sparkles,
  Boxes,
  BarChart3,
  Settings,
  ShieldCheck,
  BookOpen,
  ClipboardList,
  Newspaper,
  ClipboardCheck,
} from "lucide-react";

export type AppRole =
  | "superadmin"
  | "admin"
  | "direccion"
  | "utp"
  | "inspectoria"
  | "docente"
  | "editor"
  | "viewer";

export const ROLE_LABEL: Record<AppRole, string> = {
  superadmin: "Superadmin",
  admin: "Administración",
  direccion: "Dirección",
  utp: "UTP",
  inspectoria: "Inspectoría",
  docente: "Docente",
  editor: "Editor",
  viewer: "Lectura",
};

export type ModuleId =
  | "dashboard"
  | "intranet"
  | "matricula"
  | "mi-trabajo"
  | "academico"
  | "curriculum"
  | "estudiantes"
  | "docentes"
  | "horarios"
  | "pie"
  | "inspectoria"
  | "recursos"
  | "analitica"
  | "plataforma"
  | "admin";


export interface ModuleDef {
  id: ModuleId;
  label: string;
  icon: LucideIcon;
  to: string;
  description: string;
  /** Roles que pueden ver el módulo. `superadmin` siempre puede. */
  roles: AppRole[];
  /** Aún no implementado: aparece en sidebar con badge "Pronto". */
  comingSoon?: boolean;
  /** Sub-items que se muestran dentro del módulo. */
  items?: { to: string; label: string; comingSoon?: boolean; roles?: AppRole[] }[];
}

export const MODULES: ModuleDef[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    to: "/dashboard",
    description: "Resumen contextual según tu rol",
    roles: ["admin", "direccion", "utp", "inspectoria", "docente", "editor", "viewer"],
  },
  {
    id: "intranet",
    label: "Intranet",
    icon: Newspaper,
    to: "/intranet",
    description: "Muro institucional, circulares y documentos oficiales",
    roles: ["admin", "direccion", "utp", "inspectoria", "docente", "editor", "viewer"],
  },
  {
    id: "mi-trabajo",
    label: "Mi trabajo",
    icon: BookOpen,
    to: "/mis-clases",
    description: "Vista del docente: cursos, horario y aula",
    roles: ["docente", "admin", "utp", "direccion"],
    items: [
      { to: "/mis-clases", label: "Mi horario" },
      { to: "/mis-cursos", label: "Mis cursos" },
      { to: "/asistencia", label: "Asistencia" },
      { to: "/libro-clases", label: "Libro de clases" },
      { to: "/calificaciones", label: "Calificaciones" },
      { to: "/mis-resumenes", label: "Mis resúmenes", roles: ["docente"] },
    ],
  },
  {
    id: "academico",
    label: "Gestión Académica",
    icon: GraduationCap,
    to: "/academico",
    description: "Cursos, asignaturas y resultados",
    roles: ["admin", "direccion", "utp"],
    items: [
      { to: "/academico", label: "Resumen académico" },
      { to: "/cursos", label: "Cursos" },
      { to: "/asignaturas", label: "Asignaturas" },
    ],
  },
  {
    id: "curriculum",
    label: "Currículum y Planificación",
    icon: BookMarked,
    to: "/planificaciones",
    description: "Planificaciones, OA y cobertura",
    roles: ["admin", "direccion", "utp", "docente"],
    items: [
      { to: "/planificaciones", label: "Planificaciones" },
      { to: "/curriculum/unidades", label: "Objetivos de aprendizaje" },
      { to: "/curriculum/cobertura", label: "Cobertura curricular" },
    ],
  },
  {
    id: "estudiantes",
    label: "Estudiantes",
    icon: Users,
    to: "/estudiantes",
    description: "Ficha, historial y matrícula",
    roles: ["admin", "direccion", "utp", "inspectoria", "docente"],
  },
  {
    id: "matricula",
    label: "Matrícula",
    icon: ClipboardCheck,
    to: "/matricula",
    description: "Libro de matrícula, postulaciones y cupos oficiales",
    roles: ["admin", "direccion", "utp", "inspectoria", "docente"],
  },
  {
    id: "docentes",
    label: "Docentes",
    icon: UserCog,
    to: "/docentes",
    description: "Equipo, contratos y carga",
    roles: ["admin", "direccion", "utp"],
    items: [
      { to: "/docentes", label: "Listado" },
      { to: "/contratos", label: "Contratos" },
      { to: "/reemplazos", label: "Reemplazos" },
    ],
  },
  {
    id: "horarios",
    label: "Horarios",
    icon: CalendarRange,
    to: "/horarios",
    description: "Generación, conflictos y espacios",
    roles: ["admin", "direccion", "utp", "docente"],
    items: [
      { to: "/horarios", label: "Ver horarios" },
      { to: "/generar-horarios", label: "Generar horarios" },
      { to: "/conflictos", label: "Conflictos" },
      { to: "/bloques", label: "Bloques horarios" },
      { to: "/espacios", label: "Espacios" },
    ],
  },
  {
    id: "pie",
    label: "PIE",
    icon: Sparkles,
    to: "/pie",
    description: "Programa de Integración Escolar",
    roles: ["admin", "direccion", "utp", "docente"],
  },
  {
    id: "inspectoria",
    label: "Inspectoría",
    icon: ShieldCheck,
    to: "/inspectoria",
    description: "Asistencia, atrasos, retiros y convivencia",
    roles: ["admin", "direccion", "inspectoria"],
    items: [
      { to: "/inspectoria", label: "Panel general" },
      { to: "/inspectoria/atrasos", label: "Atrasos y retiros" },
      { to: "/inspectoria/convivencia", label: "Convivencia" },
    ],
  },
  {
    id: "recursos",
    label: "Recursos e Inventario",
    icon: Boxes,
    to: "/recursos",
    description: "Activos, salas y materiales",
    roles: ["admin", "direccion", "inspectoria"],
    comingSoon: true,
  },
  {
    id: "analitica",
    label: "Analítica y Reportes",
    icon: BarChart3,
    to: "/estadisticas",
    description: "Indicadores UTP, dirección e inspectoría",
    roles: ["admin", "direccion", "utp", "inspectoria"],
    items: [
      { to: "/direccion", label: "Panel Dirección", roles: ["admin", "direccion"] },
      { to: "/estadisticas", label: "Estadísticas generales" },
    ],
  },
  {
    id: "plataforma",
    label: "Plataforma",
    icon: ShieldCheck,
    to: "/superadmin",
    description: "Gestión global de organizaciones",
    roles: ["superadmin"],
  },
  {
    id: "admin",
    label: "Administración",
    icon: Settings,
    to: "/ajustes",
    description: "Usuarios, ajustes y auditoría",
    roles: ["admin"],
    items: [
      { to: "/ajustes", label: "Ajustes y usuarios" },
      { to: "/configuracion", label: "Configuración institucional" },
      { to: "/importar", label: "Importar datos" },
      { to: "/admin/auditoria", label: "Auditoría" },
    ],
  },
];

/** Superadmin "puro": sin roles dentro de un colegio. */
export function isPlatformOnly(roles: AppRole[]): boolean {
  return roles.includes("superadmin") && roles.every((r) => r === "superadmin");
}

export function canAccessModule(roles: AppRole[], mod: ModuleDef): boolean {
  // Un superadmin sin rol en un colegio no tiene clases, cursos ni horario:
  // solo ve la gestión de la plataforma.
  if (isPlatformOnly(roles)) return mod.roles.includes("superadmin");
  if (roles.includes("superadmin")) return true;
  return mod.roles.some((r) => roles.includes(r));
}


/** Rol "principal" para decidir el dashboard a mostrar. */
export function primaryRole(roles: AppRole[]): AppRole {
  const priority: AppRole[] = [
    "superadmin",
    "admin",
    "direccion",
    "utp",
    "inspectoria",
    "editor",
    "viewer",
    "docente",
  ];
  for (const r of priority) if (roles.includes(r)) return r;
  return "docente";
}

// Suppress unused icon lint
void ClipboardList;
