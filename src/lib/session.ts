/* ------------------------------------------------------------------ *
 * Portal session (client-side placeholder until the backend lands).
 *
 * NOTE: this is presentation-level gating only. When the real identity
 * provider is wired up, replace read/sign-in below and keep the same
 * shape — every consumer reads through `useSession`.
 * ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { readUsers, getRole, type RoleId } from "./access-control";
import { ROLE_ACCESS_LEVEL, type AccessLevel } from "./modules";

export type Session = {
  userId: string;
  username: string;
  fullName: string;
  role: RoleId;
  accessLevel: AccessLevel;
  /** Tenant the user is operating inside. Super Admins may switch. */
  schoolId?: string | undefined;
  schoolName?: string | undefined;
  /** Only Super Admins get cross-tenant (national) visibility. */
  crossTenant?: boolean;
  signedInAt: string;
};

const KEY = "portal.session";
const listeners = new Set<(s: Session | null) => void>();

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.sessionStorage.getItem(KEY) || "null") as Session | null;
  } catch {
    return null;
  }
}

function write(session: Session | null) {
  if (typeof window === "undefined") return;
  if (session) window.sessionStorage.setItem(KEY, JSON.stringify(session));
  else window.sessionStorage.removeItem(KEY);
  for (const fn of listeners) fn(session);
}

export function signIn(input: {
  identifier: string;
  role: RoleId;
  schoolId?: string | undefined;
  schoolName?: string | undefined;
}): Session {
  const identifier = input.identifier.trim();
  const match = readUsers().find(
    (u) =>
      u.username.toLowerCase() === identifier.toLowerCase() ||
      u.email.toLowerCase() === identifier.toLowerCase(),
  );
  const role = match?.role ?? input.role;
  const session: Session = {
    userId: match?.id ?? `guest-${role}-${Date.now()}`,
    username: match?.username ?? identifier,
    fullName: match?.fullName ?? identifier,
    role,
    accessLevel: ROLE_ACCESS_LEVEL[role],
    schoolId: input.schoolId,
    schoolName: input.schoolName,
    crossTenant: role === "super-admin",
    signedInAt: new Date().toISOString(),
  };
  write(session);
  return session;
}

/** Switch the tenant the session is operating inside (Super Admin only). */
export function setSessionSchool(schoolId: string, schoolName: string) {
  const current = readSession();
  if (!current) return null;
  const next: Session = { ...current, schoolId, schoolName };
  write(next);
  return next;
}

export function signOut() {
  write(null);
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(readSession());
    setReady(true);
    const fn = (s: Session | null) => setSession(s);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  return { session, ready, role: session ? getRole(session.role) : null };
}
