import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useActivityFeed, actionTitle, activityMessage } from "@/lib/activity";
import { getTimeAgo, loadFromStorage, saveToStorage } from "@/lib/utils";
import type { RoleId } from "@/lib/access-control";

export type DashboardPrefs = {
  showUserInfo: boolean;
  showQuickActions: boolean;
  showRecentActivity: boolean;
};

const PREFS_KEY = "portal.dashboardSettings";

const DEFAULT_PREFS: DashboardPrefs = {
  showUserInfo: true,
  showQuickActions: true,
  showRecentActivity: true,
};

export function loadPrefs(): DashboardPrefs {
  return { ...DEFAULT_PREFS, ...(loadFromStorage<Partial<DashboardPrefs>>(PREFS_KEY) ?? {}) };
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
      <div className="mt-3 text-sm">{children}</div>
    </div>
  );
}

/** Role-aware shortcuts — the legacy `renderQuickActionsWidget`, typed. */
function quickActions(role: RoleId): { key: string; label: string }[] {
  const actions: { key: string; label: string }[] = [];
  if (role === "super-admin" || role === "admin") {
    actions.push({ key: "admissions", label: "New admission" });
    actions.push({ key: "staff", label: "Manage staff" });
  }
  if (role === "staff") {
    actions.push({ key: "attendance", label: "Take attendance" });
    actions.push({ key: "assessment", label: "Create assessment" });
  }
  actions.push({ key: "results", label: "View results" });
  return actions;
}

/**
 * The dashboard summary strip: user info, role-aware quick actions and a
 * live recent-activity feed, each toggleable — the legacy "Customize
 * Dashboard" modal, rebuilt on the real audit trail.
 */
export function DashboardWidgets({
  role,
  fullName,
  accessLevel,
  moduleCount,
  schoolId,
}: {
  role: RoleId;
  fullName: string;
  accessLevel: string;
  moduleCount: number;
  schoolId?: string | null;
}) {
  const [prefs, setPrefs] = useState<DashboardPrefs>(() => loadPrefs());
  const [editing, setEditing] = useState(false);
  const { entries, ready } = useActivityFeed(schoolId ?? null, 5);

  const toggle = (key: keyof DashboardPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    saveToStorage(PREFS_KEY, next);
  };

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Overview
        </h2>
        <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
          Customize dashboard
        </Button>
      </div>

      {editing && (
        <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-dashed border-border p-4 text-sm">
          {(
            [
              ["showUserInfo", "User information"],
              ["showQuickActions", "Quick actions"],
              ["showRecentActivity", "Recent activity"],
            ] as [keyof DashboardPrefs, string][]
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={prefs[key]} onChange={() => toggle(key)} />
              {label}
            </label>
          ))}
          <button
            className="text-sm font-semibold text-primary"
            onClick={() => {
              setPrefs(DEFAULT_PREFS);
              saveToStorage(PREFS_KEY, DEFAULT_PREFS);
            }}
          >
            Reset to default
          </button>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {prefs.showUserInfo && (
          <Card title="User information">
            <p>
              <strong>{fullName}</strong>
            </p>
            <p className="text-muted-foreground">Role: {role.replace("-", " ")}</p>
            <p className="text-muted-foreground">Access level: {accessLevel}</p>
            <p className="text-muted-foreground">Available modules: {moduleCount}</p>
          </Card>
        )}

        {prefs.showQuickActions && (
          <Card title="Quick actions">
            <div className="flex flex-wrap gap-2">
              {quickActions(role).map((a) => (
                <Link
                  key={a.key}
                  to="/modules/$moduleKey"
                  params={{ moduleKey: a.key }}
                  className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted"
                >
                  {a.label}
                </Link>
              ))}
            </div>
          </Card>
        )}

        {prefs.showRecentActivity && (
          <Card title="Recent activity">
            {!ready && <p className="text-muted-foreground">Loading…</p>}
            {ready && entries.length === 0 && (
              <p className="text-muted-foreground">No recent activity</p>
            )}
            <ul className="space-y-2">
              {entries.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span className="truncate">
                    <strong>{actionTitle(e.action)}</strong> · {activityMessage(e)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {getTimeAgo(e.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </section>
  );
}
