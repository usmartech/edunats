/* ------------------------------------------------------------------ *
 * Single reusable access-control structure.
 * Consolidation map:
 *   super-admin                -> super-admin (preserved)
 *   school-manager + admin     -> admin
 *   staff + teacher            -> staff
 *   student (both sources)     -> student
 *   parent                     -> parent (preserved)
 * ------------------------------------------------------------------ */

export type RoleId = "super-admin" | "admin" | "staff" | "student" | "parent";

export type Role = {
  id: RoleId;
  name: string;
  icon: string;
  level: string;
  tagline: string;
  merged: string[];
  accent: string;
  modules: string[];
  permissions: string[];
};

export const MODULES = {
  core: ["Dashboard", "Messaging", "Performance Tracker"],
  academic: [
    "Attendance",
    "Students",
    "Exams & Quizzes",
    "Timetable",
    "Library",
    "Results",
    "Assessment",
    "Termly Reports",
    "Parent Communication",
  ],
  admin: ["Admissions", "Fees & Invoicing", "Invoices", "Staff Management"],
  system: ["User Management", "System Configuration", "Audit & Security"],
} as const;

export const ROLES: Role[] = [
  {
    id: "super-admin",
    name: "Super Admin",
    icon: "🛡️",
    level: "Super Administrator Access",
    tagline: "System-wide control, configuration and audit.",
    merged: ["Preserved from unified entry point"],
    accent: "bg-role-super",
    modules: [...MODULES.core, ...MODULES.academic, ...MODULES.admin, ...MODULES.system],
    permissions: [
      "All Administrator permissions",
      "Create administrator accounts",
      "System-wide configuration",
      "Full audit and security access",
    ],
  },
  {
    id: "admin",
    name: "School Manager",
    icon: "⚙️",
    level: "School Manager Access",
    tagline: "Registrar, finance and school-wide operations.",
    merged: ["School Manager", "Admin"],
    accent: "bg-role-admin",
    modules: [...MODULES.core, ...MODULES.academic, ...MODULES.admin],
    permissions: [
      "All Standard permissions",
      "Manage staff accounts",
      "Create and edit school policies",
      "Access financial reports",
      "User management capabilities",
    ],
  },
  {
    id: "staff",
    name: "Staff",
    icon: "🧑‍🏫",
    level: "Standard Access",
    tagline: "Teaching, library and general staff tools.",
    merged: ["Teacher", "Staff"],
    accent: "bg-role-staff",
    modules: [...MODULES.core, ...MODULES.academic],
    permissions: [
      "Create and edit assessment records",
      "Mark attendance for assigned classes",
      "Manage student records",
      "Live classes and communication tools",
    ],
  },
  {
    id: "student",
    name: "Student",
    icon: "🧑‍🎓",
    level: "Basic Access",
    tagline: "Courses, results, timetable and progress.",
    merged: ["Student (LMS)", "Student (SMS)"],
    accent: "bg-role-student",
    modules: [...MODULES.core, "Results", "Timetable", "Library", "Exams & Quizzes"],
    permissions: [
      "View enrolled classes and materials",
      "Take proctored quizzes and exams",
      "View personal performance reports",
      "Basic profile management",
    ],
  },
  {
    id: "parent",
    name: "Parent",
    icon: "👨‍👩‍👧",
    level: "Basic Access",
    tagline: "Monitor your child's progress and fees.",
    merged: ["Preserved from unified entry point"],
    accent: "bg-role-parent",
    modules: [...MODULES.core, "Results", "Parent Communication", "Invoices"],
    permissions: [
      "View child's assigned classes",
      "Access child's attendance records",
      "View child's performance reports",
      "Basic profile management",
    ],
  },
];

export const getRole = (id: RoleId) => ROLES.find((r) => r.id === id)!;

/* ---------------------------- local store --------------------------- */

export type StoredUser = {
  id: string;
  fullName: string;
  email: string;
  username: string;
  phone?: string;
  role: RoleId;
  schoolName?: string;
  schoolAddress?: string;
  createdAt: string;
  modules: string[];
  permissions: string[];
};

const USERS_KEY = "users";
const AUDIT_KEY = "auditLogs";

export function readUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(USERS_KEY) || "[]") as StoredUser[];
  } catch {
    return [];
  }
}

export function createAccount(input: {
  role: RoleId;
  fullName: string;
  email: string;
  username: string;
  phone?: string;
  schoolName?: string;
  schoolAddress?: string;
}): StoredUser {
  const users = readUsers();
  const role = getRole(input.role);
  const user: StoredUser = {
    id: `${input.role}-${Date.now()}`,
    ...input,
    createdAt: new Date().toISOString(),
    modules: role.modules,
    permissions: role.permissions,
  };
  users.push(user);
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));

  try {
    const logs = JSON.parse(window.localStorage.getItem(AUDIT_KEY) || "[]");
    logs.push({
      id: `audit-${Date.now()}`,
      action: "ACCOUNT_CREATED",
      role: input.role,
      username: input.username,
      timestamp: new Date().toISOString(),
    });
    window.localStorage.setItem(AUDIT_KEY, JSON.stringify(logs));
  } catch {
    /* audit logging is best-effort */
  }
  return user;
}

export function passwordScore(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  return { score, label: labels[score]! };
}
