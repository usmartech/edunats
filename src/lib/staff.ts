/* Staff domain — multi-tenant and storage-agnostic.
 *
 * No direct `db` access: every call goes through a scoped repository so
 * row-level isolation is guaranteed no matter which adapter is active. */

import { COLLECTIONS, type Entity, type PageResult, type Query } from "./data/provider";
import { createRepository, type Repository } from "./data/repository";
import { withTenant } from "./data/tenant";



export type StaffMember = Entity & {
  schoolId: string;
  fullName: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  levelCode?: string;
  subjectCodes?: string[];
  employmentType: "full-time" | "part-time" | "contract" | "volunteer";
  startDate: string;
  salary: number;
  status: "active" | "on-leave" | "exited";
};

export type PerformanceReview = Entity & {
  schoolId: string;
  staffId: string;
  staffName: string;
  period: string;
  rating: string;
  comments: string;
  reviewer: string;
};

export type StaffSchedule = Entity & {
  schoolId: string;
  staffId: string;
  staffName: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  subjectCode?: string;
  status: "active" | "cancelled";
};

export type OfferLetter = Entity & {
  schoolId: string;
  candidateName: string;
  candidateEmail: string;
  position: string;
  salary: number;
  startDate: string;
  status: "draft" | "sent" | "accepted" | "rejected";
};

export const staffRepo = createRepository<StaffMember>(COLLECTIONS.staff);
export const reviewRepo = createRepository<PerformanceReview>(COLLECTIONS.performances);
export const scheduleRepo = createRepository<StaffSchedule>(COLLECTIONS.schedules);
export const offerRepo = createRepository<OfferLetter>(COLLECTIONS.offers);

const recent = { orderBy: { field: "createdAt", dir: "desc" } } as const;

/* The explicit `schoolId` argument is a convenience for callers that manage
 * their own school switcher; isolation itself comes from the repository. */
export const listStaff = (schoolId: string) =>
  withTenant(schoolId, () => staffRepo.list(recent as never));
export const listReviews = (schoolId: string) =>
  withTenant(schoolId, () => reviewRepo.list(recent as never));
export const listSchedules = (schoolId: string) =>
  withTenant(schoolId, () => scheduleRepo.list(recent as never));
export const listOffers = (schoolId: string) =>
  withTenant(schoolId, () => offerRepo.list(recent as never));

/* --------------------------- paginated reads ----------------------- *
 * Preferred for large tenants: the adapter returns one page plus an
 * opaque cursor, so nothing scales with total row count. Equality
 * filters are declared here (department/status/staffId) because those
 * are exactly the composite indexes registered in `INDEXES`. */

export const DEFAULT_PAGE_SIZE = 25;

export type PageParams<T extends Entity> = {
  limit?: number;
  cursor?: string | null;
  where?: Query<T>["where"];
  filters?: Query<T>["filters"];
  withTotal?: boolean;
};

function pageOf<T extends Entity>(repo: Repository<T>) {
  return (schoolId: string, params: PageParams<T> = {}): Promise<PageResult<T>> =>
    withTenant(schoolId, () =>
      repo.listPage({
        where: params.where,
        filters: params.filters,
        orderBy: { field: "createdAt", dir: "desc" },
        limit: params.limit ?? DEFAULT_PAGE_SIZE,
        cursor: params.cursor ?? null,
        withTotal: params.withTotal ?? true,
      } as Query<T>),
    );
}

export const listStaffPage = pageOf(staffRepo);
export const listReviewsPage = pageOf(reviewRepo);
export const listSchedulesPage = pageOf(scheduleRepo);
export const listOffersPage = pageOf(offerRepo);

export const countStaff = (schoolId: string, where?: Query<StaffMember>["where"]) =>
  withTenant(schoolId, () => staffRepo.count({ where } as Query<StaffMember>));

/** Streams every page — use for exports/analytics instead of a full list(). */
export async function* streamStaff(schoolId: string, pageSize = 200) {
  const repo = staffRepo;
  let cursor: string | null = null;
  for (;;) {
    const page = await withTenant(schoolId, () =>
      repo.listPage({ limit: pageSize, cursor, orderBy: { field: "createdAt", dir: "desc" } } as Query<StaffMember>),
    );
    if (page.rows.length) yield page.rows;
    if (!page.hasMore || !page.nextCursor) return;
    cursor = page.nextCursor;
  }
}



type New<T extends Entity> = Omit<T, "id" | "createdAt" | "updatedAt">;

const tenantOf = (data: { schoolId?: unknown }) => String(data["schoolId"] ?? "");

export const createStaff = (data: New<StaffMember>) =>
  withTenant(tenantOf(data), () => staffRepo.create(data as never));
export const updateStaff = (id: string, patch: Partial<StaffMember>) => staffRepo.update(id, patch);
export const removeStaff = (id: string) => staffRepo.remove(id);

export const createReview = (data: New<PerformanceReview>) =>
  withTenant(tenantOf(data), () => reviewRepo.create(data as never));

export const createSchedule = (data: New<StaffSchedule>) =>
  withTenant(tenantOf(data), () => scheduleRepo.create(data as never));
export const removeSchedule = (id: string) => scheduleRepo.remove(id);

export const createOffer = (data: New<OfferLetter>) =>
  withTenant(tenantOf(data), () => offerRepo.create(data as never));
export const updateOffer = (id: string, patch: Partial<OfferLetter>) => offerRepo.update(id, patch);
export const removeOffer = (id: string) => offerRepo.remove(id);

export function staffMetrics(
  staff: StaffMember[],
  reviews: PerformanceReview[],
  schedules: StaffSchedule[],
  offers: OfferLetter[],
) {
  const payroll = staff.reduce((sum, s) => sum + (Number(s.salary) || 0), 0);
  const teachers = staff.filter((s) => s.position.toLowerCase().includes("teacher")).length;
  const admins = staff.filter((s) => /admin|manager/i.test(s.position)).length;
  const ratings = reviews.map((r) => Number(r.rating)).filter((n) => !Number.isNaN(n));
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const byDepartment = staff.reduce<Record<string, number>>((acc, s) => {
    acc[s.department] = (acc[s.department] ?? 0) + 1;
    return acc;
  }, {});
  return {
    total: staff.length,
    teachers,
    admins,
    payroll,
    avgRating,
    schedules: schedules.filter((s) => s.status === "active").length,
    offers: offers.length,
    accepted: offers.filter((o) => o.status === "accepted").length,
    byDepartment,
  };
}
