/* ------------------------------------------------------------------ *
 * Portal session bridge.
 *
 * The portal originally read a browser-only session. With cloud auth in
 * place, the national identity is authoritative: whenever a cloud
 * session exists it is projected into the same `Session` shape every
 * consumer already expects, so no feature code changes. The local store
 * remains as the offline/demo fallback.
 * ------------------------------------------------------------------ */

import { getRole } from "./access-control";
import { ROLE_ACCESS_LEVEL } from "./modules";
import { signOut as signOutLocal, useSession, type Session } from "./session";
import { signOutPlatform, usePlatformIdentity, setActiveSchoolId } from "./platform";

export type PortalSession = {
  session: Session | null;
  ready: boolean;
  role: ReturnType<typeof getRole> | null;
  /** True when the session comes from the central cloud identity. */
  cloud: boolean;
};

export function usePortalSession(): PortalSession {
  const local = useSession();
  const { identity, ready: cloudReady } = usePlatformIdentity();

  if (identity) {
    const session: Session = {
      userId: identity.userId,
      username: identity.email ?? identity.userId,
      fullName: identity.fullName ?? identity.email ?? "Account",
      role: identity.portalRole,
      accessLevel: ROLE_ACCESS_LEVEL[identity.portalRole],
      schoolId: identity.activeSchoolId ?? undefined,
      schoolName: undefined,
      crossTenant: identity.platformWide,
      signedInAt: new Date().toISOString(),
    };
    return { session, ready: true, role: getRole(identity.portalRole), cloud: true };
  }

  return {
    session: local.session,
    ready: cloudReady && local.ready,
    role: local.role,
    cloud: false,
  };
}

/** Clears whichever session is active. */
export async function signOutPortal(cloud: boolean) {
  if (cloud) {
    setActiveSchoolId(null);
    await signOutPlatform();
  }
  signOutLocal();
}
