/* ------------------------------------------------------------------ *
 * Multi-tenant catalogue: unlimited schools, education levels,
 * school types and subjects/courses — all configurable by Super Admin.
 * ------------------------------------------------------------------ */

import { COLLECTIONS, db, newId, type Entity } from "./data/provider";
import { activeStore } from "./data/bootstrap";
import { defaultModuleFeatures } from "./modules";

export type EducationLevel = Entity & {
  code: string;
  name: string;
  order: number;
  minAge?: number;
  maxAge?: number;
  active: boolean;
};

export type SchoolType = Entity & {
  code: string;
  name: string;
  description: string;
  active: boolean;
};

export type School = Entity & {
  name: string;
  code: string;
  country: string;
  region?: string;
  timezone: string;
  currency: string;
  locale: string;
  typeCode: string;
  levelCodes: string[];
  active: boolean;
};

export type Subject = Entity & {
  schoolId: string | null; // null = global catalogue template
  levelCode: string;
  code: string;
  name: string;
  credits?: number;
  elective: boolean;
  active: boolean;
};

export type TenantSettings = Entity & {
  schoolId: string;
  positions: string[];
  departments: string[];
  ratingScale: { value: string; label: string }[];
  scheduleTypes: string[];
  gradingSystem: "letter" | "percentage" | "gpa" | "points";
  academicYearStartMonth: number;
  weekStartsOn: "monday" | "sunday";
  features: Record<string, boolean>;
};

const stamp = () => {
  const now = new Date().toISOString();
  return { id: newId(), createdAt: now, updatedAt: now };
};

/* ------------------------- seed catalogue -------------------------- */

export const DEFAULT_LEVELS: Omit<EducationLevel, keyof Entity>[] = [
  { code: "early-years", name: "Early Years / Nursery", order: 1, minAge: 2, maxAge: 5, active: true },
  { code: "primary", name: "Primary / Elementary", order: 2, minAge: 6, maxAge: 11, active: true },
  { code: "junior-secondary", name: "Junior Secondary / Middle", order: 3, minAge: 12, maxAge: 14, active: true },
  { code: "senior-secondary", name: "Senior Secondary / High", order: 4, minAge: 15, maxAge: 18, active: true },
  { code: "tvet", name: "Technical & Vocational (TVET)", order: 5, active: true },
  { code: "tertiary", name: "Tertiary / University", order: 6, active: true },
  { code: "continuing", name: "Continuing & Professional Education", order: 7, active: true },
];

export const DEFAULT_SCHOOL_TYPES: Omit<SchoolType, keyof Entity>[] = [
  { code: "public", name: "Public / Government", description: "State funded, national curriculum.", active: true },
  { code: "private", name: "Private / Independent", description: "Privately funded, own fee structure.", active: true },
  { code: "international", name: "International", description: "IB, Cambridge or multi-curriculum.", active: true },
  { code: "faith", name: "Faith-based", description: "Mission or religious foundation.", active: true },
  { code: "special", name: "Special Needs", description: "Inclusive and assisted learning.", active: true },
  { code: "online", name: "Online / Virtual", description: "Fully remote delivery.", active: true },
  { code: "vocational", name: "Vocational Institute", description: "Skills and trade certification.", active: true },
];

export const DEFAULT_SUBJECTS: { levelCode: string; code: string; name: string; elective?: boolean }[] = [
  { levelCode: "primary", code: "ENG", name: "English Language" },
  { levelCode: "primary", code: "MTH", name: "Mathematics" },
  { levelCode: "primary", code: "SCI", name: "Integrated Science" },
  { levelCode: "primary", code: "SOC", name: "Social Studies" },
  { levelCode: "junior-secondary", code: "ENG", name: "English Language" },
  { levelCode: "junior-secondary", code: "MTH", name: "Mathematics" },
  { levelCode: "junior-secondary", code: "ICT", name: "Computing / ICT" },
  { levelCode: "senior-secondary", code: "PHY", name: "Physics" },
  { levelCode: "senior-secondary", code: "CHM", name: "Chemistry" },
  { levelCode: "senior-secondary", code: "BIO", name: "Biology" },
  { levelCode: "senior-secondary", code: "ECO", name: "Economics", elective: true },
  { levelCode: "tvet", code: "ELEC", name: "Electrical Installation" },
  { levelCode: "tertiary", code: "CS101", name: "Introduction to Computer Science" },
  { levelCode: "tertiary", code: "BUS201", name: "Business Management" },
];

export const DEFAULT_SETTINGS: Omit<TenantSettings, keyof Entity | "schoolId"> = {
  positions: ["Teacher", "Administrator", "Support Staff", "Manager", "Counsellor", "Librarian"],
  departments: ["Academic", "Administration", "IT Support", "Maintenance", "Finance", "Student Affairs"],
  ratingScale: [
    { value: "5", label: "Excellent" },
    { value: "4", label: "Very Good" },
    { value: "3", label: "Good" },
    { value: "2", label: "Needs Improvement" },
    { value: "1", label: "Unsatisfactory" },
  ],
  scheduleTypes: ["Regular Class", "Duty / Supervision", "Meeting", "Training", "Examination", "Overtime"],
  gradingSystem: "letter",
  academicYearStartMonth: 9,
  weekStartsOn: "monday",
  features: defaultModuleFeatures(),
};

/* ------------------------- data accessors -------------------------- */

export async function ensureSeeded(): Promise<void> {
  // The national catalog (levels, school types, school register) is centrally
  // managed once the cloud store is active — only platform admins may write it,
  // so ordinary sessions must never attempt to seed it.
  if (activeStore() === "cloud") return;

  const [levels, types, schools] = await Promise.all([
    db.list<EducationLevel>(COLLECTIONS.levels),
    db.list<SchoolType>(COLLECTIONS.schoolTypes),
    db.list<School>(COLLECTIONS.schools),
  ]);

  if (levels.length === 0) {
    await db.bulkPut<EducationLevel>(
      COLLECTIONS.levels,
      DEFAULT_LEVELS.map((l) => ({ ...stamp(), ...l }) as EducationLevel),
    );
  }
  if (types.length === 0) {
    await db.bulkPut<SchoolType>(
      COLLECTIONS.schoolTypes,
      DEFAULT_SCHOOL_TYPES.map((t) => ({ ...stamp(), ...t }) as SchoolType),
    );
  }
  if (schools.length === 0) {
    const school = await db.create<School>(COLLECTIONS.schools, {
      name: "Demo Academy",
      code: "DEMO",
      country: "Ghana",
      region: "Greater Accra",
      timezone: "Africa/Accra",
      currency: "GHS",
      locale: "en-GH",
      typeCode: "private",
      levelCodes: ["primary", "junior-secondary", "senior-secondary"],
      active: true,
    } as never);
    await db.bulkPut<Subject>(
      COLLECTIONS.subjects,
      DEFAULT_SUBJECTS.map(
        (s) =>
          ({
            ...stamp(),
            schoolId: school.id,
            levelCode: s.levelCode,
            code: s.code,
            name: s.name,
            elective: s.elective ?? false,
            active: true,
          }) as Subject,
      ),
    );
    await db.create<TenantSettings>(COLLECTIONS.settings, {
      schoolId: school.id,
      ...DEFAULT_SETTINGS,
    } as never);
  }
}

export async function listSchools() {
  return db.list<School>(COLLECTIONS.schools, { orderBy: { field: "name" } });
}

export async function listLevels() {
  return db.list<EducationLevel>(COLLECTIONS.levels, { orderBy: { field: "order" } });
}

export async function listSchoolTypes() {
  return db.list<SchoolType>(COLLECTIONS.schoolTypes, { orderBy: { field: "name" } });
}

export async function listSubjects(schoolId?: string) {
  return db.list<Subject>(COLLECTIONS.subjects, {
    ...(schoolId ? { where: { schoolId } } : {}),
    orderBy: { field: "name" },
  });
}

export async function getSettings(schoolId: string): Promise<TenantSettings> {
  const rows = await db.list<TenantSettings>(COLLECTIONS.settings, { where: { schoolId } });
  if (rows[0]) {
    // Merge in modules that shipped after this school was provisioned, so a
    // school never silently loses access to a newly released module.
    const merged = { ...defaultModuleFeatures(), ...rows[0].features };
    if (Object.keys(merged).length !== Object.keys(rows[0].features ?? {}).length) {
      return db.update<TenantSettings>(COLLECTIONS.settings, rows[0].id, { features: merged });
    }
    return rows[0];
  }
  return db.create<TenantSettings>(COLLECTIONS.settings, {
    schoolId,
    ...DEFAULT_SETTINGS,
  } as never);
}

export async function saveSettings(id: string, patch: Partial<TenantSettings>) {
  return db.update<TenantSettings>(COLLECTIONS.settings, id, patch);
}

export function formatMoney(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

const ACTIVE_SCHOOL_KEY = "activeSchoolId";

export function readActiveSchoolId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_SCHOOL_KEY);
}

export function writeActiveSchoolId(id: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_SCHOOL_KEY, id);
}
