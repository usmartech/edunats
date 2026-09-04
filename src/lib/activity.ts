/* ------------------------------------------------------------------ *
 * Activity + notification feed.
 *
 * The legacy portal kept `auditLogs` and `notifications` in localStorage
 * and polled them every 30s (`startRealTimeUpdates`). Here the same two
 * concepts collapse onto one server-side table (`audit_log`) that is
 * already scoped by row level security, and "real time" is an actual
 * Postgres change stream instead of a timer.
 * ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ActivityScope = "platform" | "national" | "regional" | "school";

export type ActivityEntry = {
  id: string;
  actor_id: string | null;
  scope: string;
  scope_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

export type NotificationKind = "success" | "warning" | "error" | "info" | "system";

/** Legacy `checkSystemEvents` mapped events to a severity; keep that rule. */
export function severityOf(action: string): NotificationKind {
  const a = action.toLowerCase();
  if (a.includes("fail") || a.includes("denied") || a.includes("error") || a.includes("delete"))
    return "error";
  if (a.includes("reject") || a.includes("alert") || a.includes("warn") || a.includes("locked"))
    return "warning";
  if (a.includes("approve") || a.includes("create") || a.includes("register") || a.includes("payment"))
    return "success";
  if (a.includes("platform") || a.includes("setting") || a.includes("config")) return "system";
  return "info";
}

export const KIND_ICON: Record<NotificationKind, string> = {
  success: "✅",
  warning: "⚠️",
  error: "⛔",
  info: "ℹ️",
  system: "⚙️",
};

/** Human title for an audit action key, e.g. `school.approved` → "School approved". */
export function actionTitle(action: string): string {
  const words = action.replace(/[._-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function activityMessage(entry: ActivityEntry): string {
  const detail = entry.detail ?? {};
  const candidate =
    (detail["message"] as string | undefined) ??
    (detail["name"] as string | undefined) ??
    (detail["school_name"] as string | undefined) ??
    (detail["email"] as string | undefined);
  if (candidate) return candidate;
  if (entry.target_table) return `${entry.target_table}${entry.target_id ? ` · ${entry.target_id.slice(0, 8)}` : ""}`;
  return "System event";
}

/* --------------------------------- writes -------------------------- */

/**
 * Record an auditable action. Insert is guarded by RLS
 * (`actor_id = auth.uid()`), so this is a no-op when signed out.
 */
export async function logActivity(input: {
  action: string;
  scope?: ActivityScope;
  scopeId?: string | null;
  targetTable?: string | null;
  targetId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const actorId = auth.user?.id;
  if (!actorId) return;
  await supabase.from("audit_log").insert({
    actor_id: actorId,
    action: input.action,
    scope: input.scope ?? "platform",
    scope_id: input.scopeId ?? null,
    target_table: input.targetTable ?? null,
    target_id: input.targetId ?? null,
    detail: (input.detail ?? {}) as never,
  });
}

/* --------------------------------- reads --------------------------- */

export async function fetchActivity(opts?: {
  scopeId?: string | null;
  limit?: number;
}): Promise<ActivityEntry[]> {
  let query = supabase
    .from("audit_log")
    .select("id, actor_id, scope, scope_id, action, target_table, target_id, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 25);
  if (opts?.scopeId) query = query.eq("scope_id", opts.scopeId);
  const { data } = await query;
  return (data ?? []) as ActivityEntry[];
}

/**
 * Live feed. `fresh` mirrors the legacy "real-time indicator": true while
 * an event newer than five minutes exists, exactly the old window.
 */
export function useActivityFeed(scopeId?: string | null, limit = 25) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(false);

  const reload = useCallback(async () => {
    const rows = await fetchActivity({ scopeId: scopeId ?? null, limit });
    setEntries(rows);
    setReady(true);
  }, [scopeId, limit]);

  useEffect(() => {
    void reload();
    const channel = supabase
      .channel(`audit-feed-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_log" },
        (payload) => {
          const row = payload.new as ActivityEntry;
          if (scopeId && row.scope_id && row.scope_id !== scopeId) return;
          setEntries((prev) => [row, ...prev].slice(0, limit));
          setLive(true);
          setTimeout(() => setLive(false), 4000);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload, scopeId, limit]);

  const recent = entries.filter(
    (e) => new Date(e.created_at).getTime() > Date.now() - 5 * 60 * 1000,
  );

  return { entries, recent, ready, live: live || recent.length > 0, reload };
}

/* ---------------------------- read markers -------------------------- */

const READ_KEY = "portal.notifications.readAt";

export function lastReadAt(): number {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(READ_KEY) ?? 0);
}

export function markAllRead() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(READ_KEY, String(Date.now()));
}
