/* ------------------------------------------------------------------ *
 * Storage bootstrap.
 *
 * The app ships with the local adapter so it runs standalone, and swaps
 * to the centralized cloud store the moment a national platform session
 * exists. Feature code never learns which one is active.
 * ------------------------------------------------------------------ */

import { configureData, localDataProvider } from "./provider";
import { supabaseDataProvider } from "./adapters/supabase";

let active: "local" | "cloud" = "local";

export function activeStore() {
  return active;
}

/** Point every repository at the central national database. */
export function activateCloudStore() {
  if (active === "cloud") return;
  configureData({ db: supabaseDataProvider });
  active = "cloud";
}

/** Fall back to the on-device store (signed out / offline demo mode). */
export function activateLocalStore() {
  if (active === "local") return;
  configureData({ db: localDataProvider });
  active = "local";
}

/**
 * A persisted platform session means this browser belongs to the national
 * ecosystem, so the very first read must already hit the central database.
 * Waiting for the async identity fetch would let a page load (and seed) the
 * on-device demo store first, and the school would appear to have data that
 * is not in the national register.
 */
function hasPersistedCloudSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) return true;
    }
  } catch {
    return false;
  }
  return false;
}

if (hasPersistedCloudSession()) activateCloudStore();
