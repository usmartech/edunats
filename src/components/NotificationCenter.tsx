import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  KIND_ICON,
  actionTitle,
  activityMessage,
  lastReadAt,
  markAllRead,
  severityOf,
  useActivityFeed,
} from "@/lib/activity";
import { getTimeAgo } from "@/lib/utils";

/**
 * Replaces the legacy `NotificationSystem` class + 30s polling loop.
 * The feed is the server-side audit trail, streamed over Postgres
 * changes, so notifications are shared across devices instead of being
 * trapped in one browser's localStorage.
 */
export function NotificationCenter({ scopeId }: { scopeId?: string | null }) {
  const { entries, live, ready } = useActivityFeed(scopeId ?? null, 25);
  const [open, setOpen] = useState(false);
  const [readAt, setReadAt] = useState(() => lastReadAt());

  const unread = useMemo(
    () => entries.filter((e) => new Date(e.created_at).getTime() > readAt).length,
    [entries, readAt],
  );

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {live && (
          <span
            className="rounded-full bg-primary-foreground/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
            title="Live activity in the last few minutes"
          >
            ● Live
          </span>
        )}
        <Button
          variant="outline"
          aria-label="Notifications"
          className="relative border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
          onClick={() => setOpen((v) => !v)}
        >
          🔔
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </div>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(24rem,90vw)] overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-lift">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-bold">Notifications</h3>
            <button
              className="text-xs font-semibold text-primary"
              onClick={() => {
                markAllRead();
                setReadAt(Date.now());
              }}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!ready && <p className="p-4 text-sm text-muted-foreground">Loading activity…</p>}
            {ready && entries.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No recent activity.</p>
            )}
            {entries.map((e) => {
              const kind = severityOf(e.action);
              const isUnread = new Date(e.created_at).getTime() > readAt;
              return (
                <div
                  key={e.id}
                  className={`flex gap-3 border-b border-border px-4 py-3 ${isUnread ? "bg-muted/50" : ""}`}
                >
                  <span className="text-lg leading-none">{KIND_ICON[kind]}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{actionTitle(e.action)}</p>
                    <p className="truncate text-sm text-muted-foreground">{activityMessage(e)}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {getTimeAgo(e.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
