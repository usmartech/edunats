/* ------------------------------------------------------------------ *
 * Tenant context — the single source of truth for "who is asking".
 *
 * Feature code never passes a schoolId to the storage layer by hand.
 * It sets the context once (on login / school switch) and the scoped
 * repositories inject + verify isolation on every operation. When the
 * backend moves to OCI, the same context is forwarded to the adapter,
 * which can push isolation down into the database (VPD / RLS policy)
 * instead of enforcing it in the process.
 * ------------------------------------------------------------------ */

export type TenantContext = {
  /** Active tenant. `null` means "no tenant selected" — scoped reads return []. */
  schoolId: string | null;
  /** Actor performing the operation (used for audit trails). */
  userId?: string;
  role?: string;
  /** Cross-tenant read access. Only ever true for platform super admins. */
  crossTenant?: boolean;
};

const listeners = new Set<(ctx: TenantContext) => void>();

let context: TenantContext = { schoolId: null };

export function getTenantContext(): TenantContext {
  return context;
}

export function setTenantContext(next: Partial<TenantContext>) {
  context = { ...context, ...next };
  for (const fn of listeners) fn(context);
}

export function onTenantChange(fn: (ctx: TenantContext) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Run a block against another tenant without leaking the switch. */
export async function withTenant<T>(schoolId: string, fn: () => Promise<T>): Promise<T> {
  const prev = context;
  context = { ...context, schoolId };
  try {
    return await fn();
  } finally {
    context = prev;
  }
}

export class TenantIsolationError extends Error {
  constructor(collection: string, id?: string) {
    super(`Tenant isolation violation on ${collection}${id ? `/${id}` : ""}`);
    this.name = "TenantIsolationError";
  }
}

export function requireSchoolId(ctx: TenantContext = context): string {
  if (!ctx.schoolId) throw new TenantIsolationError("<no active tenant>");
  return ctx.schoolId;
}

/** Field every tenant-scoped row carries. Adapters map it to a column/partition key. */
export const TENANT_KEY = "schoolId" as const;
