# EduNat Migration Map — From Single-School Portal to National Hierarchy

## What the uploaded code already has

- **Cloud backend present**: `schools`, `profiles`, `user_roles` (with `app_role` enum already containing `super_admin, national_admin, regional_admin, school_admin, staff, teacher, parent, student`), `school_settings`, `education_levels`, `school_types`, and a generic JSONB `records` store, all with RLS and security-definer helpers (`has_role`, `is_super_admin`, `is_platform_admin`, `is_school_admin`, `has_school_access`, `can_write_school`).
- **Routes**: `/` (landing + sign-in), `/auth`, `/setup`, `/portal` (single school workspace), `/national` (read-only rollup), `/config`, `/staff`, `/modules/$moduleKey`, `/reset-password`.
- **Two parallel identity systems**: a real cloud identity (`src/lib/platform.ts`) and a legacy localStorage identity (`src/lib/access-control.ts` + `src/lib/session.ts`) still driving `/setup`, `/` sign-in and module gating.

## Gaps against the criteria

1. No **regional** layer: `regional_admin` exists in the enum but has no region entity, no scoping helper, no dashboard. Region is a free-text column on `schools`.
2. No **country/national** entity: `country` is free text; national admins are treated as global.
3. **Self-service school registration missing**: only super admin can insert into `schools`; there is no registration request table or flow.
4. **First-time setup wrong**: `/setup` creates localStorage "super-admin/admin" accounts and mentions school details; it must create only Super Admin + National Admin real cloud accounts.
5. **Dashboard naming static**: headers show hardcoded product names, not school/region/country/platform names.
6. **Platform settings** (platform name, branding) have no table — super admin cannot rename the platform.
7. Legacy localStorage auth is a security and correctness liability alongside the cloud identity.

---

## Target hierarchy

```text
Platform (super_admin)  — platform_settings.name
  └── Country (national_admin)      — dashboard = country name
        └── Region (regional_admin) — dashboard = region name
              └── School (school_admin) — dashboard = school name
                    └── staff / teacher / parent / student
```

---

## Phase 1 — Data layer (one migration)

New tables (each with GRANTs, RLS enabled, then policies):

- `platform_settings` — singleton row: `platform_name`, `tagline`, `logo_url`, `support_email`. Read: all authenticated. Write: super admin only.
- `countries` — `id, code, name, active`. Write: super admin.
- `regions` — `id, country_id, code, name, active`. Write: super admin + national admin of that country.
- `school_registrations` — `id, requested_by, school_name, proposed_code, country_id, region_id, district, type_code, level_codes, contact_phone, status ('pending'|'approved'|'rejected'), reviewed_by, reviewed_at, rejection_reason`.
- `audit_log` — `id, actor_id, scope, scope_id, action, target_table, target_id, detail jsonb, created_at`. Insert via triggers/server fns; read by admins at or above the scope.

Changes to existing tables:

- `schools`: add `country_id UUID REFERENCES countries`, `region_id UUID REFERENCES regions`, `status TEXT DEFAULT 'active'`, `created_by UUID`; backfill `countries`/`regions` from existing free-text `country`/`region` values; keep the text columns as deprecated mirrors for one release.
- `user_roles`: add `country_id`, `region_id` (nullable) so `national_admin` and `regional_admin` rows carry a scope; keep `school_id` for school-level roles. Replace the unique index with one covering `(user_id, role, school_id, region_id, country_id)`.

New/updated security-definer helpers:

- `is_national_admin(_user, _country_id)`, `is_regional_admin(_user, _region_id)`
- `school_in_scope(_user, _school_id)` — true for super admin, national admin of the school's country, regional admin of the school's region, or any role row on that school.
- Rewrite `has_school_access` and `can_write_school` on top of `school_in_scope` so every existing policy on `records`, `school_settings` and `schools` inherits regional/national oversight automatically. This is the single highest-leverage step: module data is already stored in `records`, so all modules gain hierarchy in one change.

Policy updates:

- `schools_insert`: allow an authenticated user to insert **only** via the approved-registration path (server fn with service role), not directly.
- `schools_update/delete`: super admin anywhere; national admin within their country; regional admin within their region; school admin on their own school (update only).
- `user_roles`: extend management policies so national admins manage roles inside their country and regional admins inside their region.

## Phase 2 — Bootstrap & first-time setup

- Add `is_platform_bootstrapped()` (any `super_admin` row exists?) exposed through a public server fn.
- Rewrite `/setup` to a two-step wizard using real Supabase auth:
  1. **Super Admin** — full name, email, password, platform name, country name/code. On submit: sign up, insert `platform_settings`, insert `countries` row, grant `super_admin` (no scope).
  2. **National Admin** — full name, email, country selector. Creates the account and grants `national_admin` scoped to that country.
- No school, regional, or other roles are creatable here. Once bootstrapped, `/setup` redirects to `/auth`.
- Delete `createAccount`/`readUsers` localStorage paths from the setup flow.

## Phase 3 — School registration

- Add a prominent **"Register your school"** button on `/` and `/auth`.
- `/register-school` route: sign in or sign up, then a form (school name, country, region, district, type, levels, contact). Submits to a `createSchoolRegistration` server fn.
- Approval: super/national/regional admins see pending requests in their dashboard; approving runs `approveSchoolRegistration` (service role, after verifying the approver's scope) which creates the `schools` row, the `school_settings` row, and grants the requester `school_admin` on that school — **the requester automatically becomes the school admin**.
- Optional config flag `auto_approve_registrations` in `platform_settings`: when on, the school is created immediately on submit and the requester becomes school admin without review.

## Phase 4 — Dashboards & routing

Route map after migration:

| Route | Audience | Dashboard title |
|---|---|---|
| `/` | public | platform name |
| `/setup` | first run only | platform name |
| `/register-school` | any signed-in user | platform name |
| `/portal` | school users | **school name** |
| `/regional` | regional_admin | **region name** |
| `/national` | national_admin | **country name** |
| `/platform` | super_admin | **platform name** |

- Extend `usePlatformIdentity` to resolve `scope: 'platform' | 'national' | 'regional' | 'school'` plus `scopeLabel` (platform/country/region/school name) and the list of schools in scope.
- `landingRoute()` returns `/platform`, `/national`, `/regional` or `/portal` from that scope.
- Single `<DashboardHeader />` renders `scopeLabel` everywhere, so the naming rule is enforced in one place.
- `/regional` reuses the `/national` table component with a region filter; `/national` filters by country; `/platform` shows everything plus platform settings, countries/regions management, registration queue, user/role administration and destructive actions (delete school, delete region, delete country, rename platform) behind confirm dialogs.
- Higher-scope admins can drill into any school in scope via the existing `switchSchool`, which sets the tenant context used by every module.

## Phase 5 — Consolidation & cleanup

- Retire `src/lib/session.ts` and the localStorage store in `src/lib/access-control.ts`; keep only the role/module/permission definitions and map cloud roles onto them (`regional_admin` and `national_admin` get their own portal roles instead of collapsing into `super-admin`/`admin`).
- Route all writes through the existing `records` repository so tenant scoping stays automatic.
- Write audit entries for role grants, registration approvals, school/region/country deletion and platform renames.
- Verify: sign-in as each of the four admin tiers, confirm dashboard title, confirm a school admin cannot read another school, confirm a regional admin sees only their region.

## Sequencing

1. Migration (Phase 1) — nothing user-visible breaks; helpers stay backward compatible.
2. Setup rewrite (Phase 2).
3. Registration flow (Phase 3).
4. Dashboards and scoped headers (Phase 4).
5. Cleanup (Phase 5).

Phases 1-2 must ship together; 3 and 4 can ship independently after that.
