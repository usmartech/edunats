/* ------------------------------------------------------------------ *
 * Central module registry for the main portal.
 *
 * The landing page never lists modules. After authentication the portal
 * renders ONLY the modules the signed-in user may reach, based on the
 * intersection of (a) role allow-list and (b) numeric access level.
 *
 * Individual modules are delivered later: each entry declares either a
 * `route` (already implemented in this app) or nothing (placeholder page
 * is rendered at /modules/$moduleKey until the real one lands).
 * ------------------------------------------------------------------ */

import type { RoleId } from "./access-control";

export type AccessLevel = "Basic" | "Standard" | "Admin" | "Super Admin";

export const ACCESS_LEVELS: Record<AccessLevel, number> = {
  Basic: 1,
  Standard: 2,
  Admin: 3,
  "Super Admin": 4,
};

export const ROLE_ACCESS_LEVEL: Record<RoleId, AccessLevel> = {
  "super-admin": "Super Admin",
  admin: "Admin",
  staff: "Standard",
  student: "Basic",
  parent: "Basic",
};

export type ModuleGroup = "Core" | "Academics" | "Administration" | "System";

export type ModuleDef = {
  key: string;
  name: string;
  icon: string;
  description: string;
  group: ModuleGroup;
  accessLevel: AccessLevel;
  roles: RoleId[];
  /** Set once the real module ships in this app. */
  route?: string;
};

const ALL: RoleId[] = ["super-admin", "admin", "staff", "student", "parent"];

export const MODULE_REGISTRY: ModuleDef[] = [
  /* ---------------------------------- Core */
  {
    key: "dashboard",
    name: "Dashboard",
    icon: "📊",
    description: "Overview, KPIs and role-specific activity feed.",
    group: "Core",
    accessLevel: "Basic",
    roles: ALL,
  },
  {
    key: "messaging",
    name: "Messaging",
    icon: "💬",
    description: "Internal messaging and school-wide announcements.",
    group: "Core",
    accessLevel: "Basic",
    roles: ALL,
  },
  {
    key: "performance-tracker",
    name: "Performance Tracker",
    icon: "📈",
    description: "Longitudinal student performance tracking.",
    group: "Core",
    accessLevel: "Basic",
    roles: ALL,
  },
  /* ----------------------------- Academics */
  {
    key: "attendance",
    name: "Attendance",
    icon: "📅",
    description: "Daily and per-period attendance capture.",
    group: "Academics",
    accessLevel: "Standard",
    roles: ["super-admin", "admin", "staff"],
  },
  {
    key: "assessment",
    name: "Assessment",
    icon: "🧮",
    description: "Continuous assessment and grading workflows.",
    group: "Academics",
    accessLevel: "Standard",
    roles: ["super-admin", "admin", "staff"],
  },
  {
    key: "exams",
    name: "Exams & Quizzes",
    icon: "📝",
    description: "Exam scheduling, proctored quizzes and marking.",
    group: "Academics",
    accessLevel: "Basic",
    roles: ["super-admin", "admin", "staff", "student"],
  },
  {
    key: "results",
    name: "Results",
    icon: "🎯",
    description: "Termly reports, transcripts and result publishing.",
    group: "Academics",
    accessLevel: "Basic",
    roles: ALL,
  },
  {
    key: "timetable",
    name: "Timetable",
    icon: "🗓️",
    description: "Class timetables, rooms and teacher allocation.",
    group: "Academics",
    accessLevel: "Basic",
    roles: ["super-admin", "admin", "staff", "student"],
  },
  {
    key: "library",
    name: "Library",
    icon: "📚",
    description: "Catalogue, lending and digital resources.",
    group: "Academics",
    accessLevel: "Basic",
    roles: ["super-admin", "admin", "staff", "student"],
  },
  {
    key: "parent-communication",
    name: "Parent Communication",
    icon: "👨‍👩‍👧",
    description: "Guardian threads, consent forms and notices.",
    group: "Academics",
    accessLevel: "Basic",
    roles: ["super-admin", "admin", "staff", "parent"],
  },
  /* ------------------------- Administration */
  {
    key: "admissions",
    name: "Admissions",
    icon: "🧾",
    description: "Applications, enrolment and placement.",
    group: "Administration",
    accessLevel: "Admin",
    roles: ["super-admin", "admin"],
  },
  {
    key: "students",
    name: "Students",
    icon: "🧑‍🎓",
    description: "Student directory, records and guardians.",
    group: "Administration",
    accessLevel: "Admin",
    roles: ["super-admin", "admin"],
  },
  {
    key: "staff",
    name: "Staff Management",
    icon: "🧑‍🏫",
    description: "Directory, performance, scheduling and offers.",
    group: "Administration",
    accessLevel: "Admin",
    roles: ["super-admin", "admin"],
    route: "/staff",
  },
  {
    key: "fees",
    name: "Fees & Invoicing",
    icon: "💳",
    description: "Fee structures, billing runs and receipts.",
    group: "Administration",
    accessLevel: "Admin",
    roles: ["super-admin", "admin"],
  },
  {
    key: "invoices",
    name: "Invoices",
    icon: "📄",
    description: "Invoice tracking, statements and reconciliation.",
    group: "Administration",
    accessLevel: "Basic",
    roles: ["super-admin", "admin", "parent"],
  },
  {
    key: "financial",
    name: "Financial Management",
    icon: "💰",
    description: "Budgets, payroll integration and reporting.",
    group: "Administration",
    accessLevel: "Admin",
    roles: ["super-admin", "admin"],
  },
  /* -------------------------------- System */
  {
    key: "user-management",
    name: "User Management",
    icon: "👥",
    description: "Accounts, roles and permission assignment.",
    group: "System",
    accessLevel: "Admin",
    roles: ["super-admin", "admin"],
    route: "/members",
  },
  {
    key: "user-verification",
    name: "User Verification",
    icon: "🔍",
    description: "Check and verify member accounts and their granted roles.",
    group: "System",
    accessLevel: "Super Admin",
    roles: ["super-admin"],
    route: "/members",
  },
  {
    key: "configuration",
    name: "System Configuration",
    icon: "⚙️",
    description: "Schools, education levels, subjects and policy.",
    group: "System",
    accessLevel: "Super Admin",
    roles: ["super-admin"],
    route: "/config",
  },
  {
    key: "platform-configuration",
    name: "Platform Configuration",
    icon: "🌍",
    description: "Platform name, countries, regions and school register.",
    group: "System",
    accessLevel: "Super Admin",
    roles: ["super-admin"],
    route: "/manage",
  },
  {
    key: "advanced-reporting",
    name: "Advanced Reporting",
    icon: "📉",
    description: "Cross-school analytics and export pipelines.",
    group: "System",
    accessLevel: "Super Admin",
    roles: ["super-admin"],
  },
  {
    key: "audit-security",
    name: "Audit & Security",
    icon: "🛡️",
    description: "Audit trail, sessions and security policy.",
    group: "System",
    accessLevel: "Super Admin",
    roles: ["super-admin"],
  },
];

export const MODULE_GROUPS: ModuleGroup[] = ["Core", "Academics", "Administration", "System"];

export const getModule = (key: string) => MODULE_REGISTRY.find((m) => m.key === key);

export function hasModuleAccess(role: RoleId | null | undefined, key: string): boolean {
  if (!role) return false;
  const mod = getModule(key);
  if (!mod) return false;
  if (!mod.roles.includes(role)) return false;
  return ACCESS_LEVELS[ROLE_ACCESS_LEVEL[role]] >= ACCESS_LEVELS[mod.accessLevel];
}

export function accessibleModules(role: RoleId | null | undefined): ModuleDef[] {
  if (!role) return [];
  return MODULE_REGISTRY.filter((m) => hasModuleAccess(role, m.key));
}

/* ------------------------------------------------------------------ *
 * Per-school configurability.
 *
 * The ecosystem is centralised, but every school operates independently:
 * a school's Super Admin/School Manager can switch tenant-scoped modules on or
 * off, and the portal reflects that instantly. Platform (System) modules
 * belong to the national control plane and are never school-toggleable.
 * ------------------------------------------------------------------ */

/** Modules a school can enable or disable for itself. */
export const TENANT_MODULES: ModuleDef[] = MODULE_REGISTRY.filter((m) => m.group !== "System");

/** Platform-wide modules — always on, gated by role only. */
export const PLATFORM_MODULES: ModuleDef[] = MODULE_REGISTRY.filter((m) => m.group === "System");

export const isPlatformModule = (m: ModuleDef) => m.group === "System";

/** Default feature map stamped onto every newly provisioned school. */
export function defaultModuleFeatures(): Record<string, boolean> {
  return Object.fromEntries(TENANT_MODULES.map((m) => [m.key, true]));
}

/** A module is enabled unless the school explicitly turned it off. */
export function moduleEnabledForSchool(
  key: string,
  features: Record<string, boolean> | undefined | null,
): boolean {
  const mod = getModule(key);
  if (!mod) return false;
  if (isPlatformModule(mod)) return true;
  return features?.[key] !== false;
}

/**
 * Modules visible to a user inside one school: role allow-list ∩ access
 * level ∩ the school's own enabled feature set.
 */
export function schoolModules(
  role: RoleId | null | undefined,
  features: Record<string, boolean> | undefined | null,
): ModuleDef[] {
  return accessibleModules(role).filter((m) => moduleEnabledForSchool(m.key, features));
}
