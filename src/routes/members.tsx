import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScopeHeader } from "@/components/ScopeHeader";
import { usePlatformIdentity } from "@/lib/platform";
import {
  inviteSchoolMember,
  listSchoolMembers,
  removeSchoolMember,
  transferSchoolAdmin,
  updateMemberRole,
} from "@/lib/members.functions";

const ROLES = ["school_admin", "staff", "teacher", "parent", "student"] as const;
type Role = (typeof ROLES)[number];

type Member = {
  roleId: string;
  userId: string;
  role: Role;
  fullName: string | null;
  email: string | null;
  createdAt: string;
};

export const Route = createFileRoute("/members")({
  head: () => ({
    meta: [
      { title: "School Members — Invitations & Roles" },
      {
        name: "description",
        content:
          "School administrators invite staff, teachers, parents and students, change their roles and transfer administrator rights.",
      },
      { property: "og:title", content: "School Members — Invitations & Roles" },
      {
        property: "og:description",
        content: "Invite people into your school and manage who administers it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const { identity, ready } = usePlatformIdentity();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "staff" as Role,
  });

  const list = useServerFn(listSchoolMembers);
  const add = useServerFn(inviteSchoolMember);
  const setRole = useServerFn(updateMemberRole);
  const remove = useServerFn(removeSchoolMember);
  const transfer = useServerFn(transferSchoolAdmin);

  const schoolId = identity?.activeSchoolId ?? null;
  const isSchoolAdmin =
    !!identity &&
    (identity.scope !== "school" ||
      identity.assignments.some((a) => a.role === "school_admin" && a.schoolId === schoolId));

  useEffect(() => {
    if (ready && (!identity || !schoolId || !isSchoolAdmin))
      navigate({ to: "/portal", replace: true });
  }, [ready, identity, schoolId, isSchoolAdmin, navigate]);

  const load = useCallback(async () => {
    if (!schoolId) return;
    try {
      const result = await list({ data: { schoolId } });
      setMembers(result.members as Member[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load members");
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready || !identity || !schoolId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading members…
      </div>
    );
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      toast.success(message);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitInvite(event: FormEvent) {
    event.preventDefault();
    if (!schoolId) return;
    await run(
      () =>
        add({
          data: {
            schoolId,
            email: invite.email,
            fullName: invite.fullName,
            role: invite.role,
            password: invite.password || null,
          },
        }),
      "Invitation sent",
    );
    setInvite({ fullName: "", email: "", password: "", role: invite.role });
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <ScopeHeader identity={identity} subtitle="People and roles in this school" />

      <main className="mx-auto max-w-5xl space-y-8 px-5 py-10">
        <form onSubmit={submitInvite} className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Invite someone to this school
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Full name"
              value={invite.fullName}
              onChange={(e) => setInvite({ ...invite, fullName: e.target.value })}
              required
            />
            <Input
              type="email"
              placeholder="Email"
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              required
            />
            <Input
              type="password"
              placeholder="Temporary password (optional)"
              value={invite.password}
              onChange={(e) => setInvite({ ...invite, password: e.target.value })}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={invite.role}
              onChange={(e) => setInvite({ ...invite, role: e.target.value as Role })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {label(r)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="mt-4" disabled={busy}>
            {busy ? "Working…" : "Send invitation"}
          </Button>
        </form>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Members
          </h2>
          <div className="mt-4 space-y-3">
            {members.map((m) => (
              <div
                key={m.roleId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div>
                  <p className="font-bold">{m.fullName ?? m.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {m.email} · {label(m.role)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={m.role}
                    disabled={busy}
                    onChange={(e) =>
                      void run(
                        () =>
                          setRole({
                            data: { schoolId, userId: m.userId, role: e.target.value as Role },
                          }),
                        "Role updated",
                      )
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {label(r)}
                      </option>
                    ))}
                  </select>
                  {m.role !== "school_admin" && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            transfer({
                              data: {
                                schoolId,
                                userId: m.userId,
                                stepDown: window.confirm(
                                  "Step down to staff after transferring admin rights?",
                                ),
                                stepDownRole: "staff",
                              },
                            }),
                          "Admin rights transferred",
                        )
                      }
                    >
                      Make admin
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      window.confirm(`Remove ${m.fullName ?? m.email} from this school?`) &&
                      void run(
                        () => remove({ data: { schoolId, userId: m.userId } }),
                        "Member removed",
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function label(role: Role) {
  return role === "school_admin"
    ? "School Manager"
    : role[0]!.toUpperCase() + role.slice(1);
}
