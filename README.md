# Lavelle Tech Platform

Professional legal specialization and CPD platform for the Nigerian legal market. Candidates register, browse a catalogue of specialization programmes, pay per programme, study online, sit a proctored certifying examination, and receive a credential any third party can verify publicly.

Two slices are in this repository so far:

- **Foundation** — design tokens, the shared component library, the two app shells (candidate portal, admin), the base domain schema, staff/admin authentication and RBAC.
- **Slice 1: registration, sign in, applicant state** — candidate self-registration, sign in, the applicant/enrolled account gate, and the profile-completion flow.

Everything else (programme catalogue, payment, course player, assessment, admin operations, marketing site) ships as later, vertical-slice handoffs — see each design handoff's own README for the planned order.

## Stack

- **Next.js 16** (App Router) + TypeScript — Server Components, Server Actions, route handlers
- **Tailwind CSS v4**, themed with the exact tokens from the design handoffs — Poppins, exact hex values, no eyedropping
- **PostgreSQL** via **Prisma 7** (driver adapter: `@prisma/adapter-pg`), `citext` + `pgcrypto` extensions
- **Two independent auth systems, by design:**
  - **Staff/admin** — Auth.js (NextAuth) v5, credentials provider, JWT session
  - **Candidates** — hand-rolled, database-backed sessions (opaque token cookie, hashed at rest), so suspending an account revokes every live session immediately — something a self-contained JWT can't do. See `src/lib/candidate-session.ts` for the rationale.
- **Vitest** for tests (`npm test`) — runs against the real local Postgres, not a mock

## Getting started

Point `DATABASE_URL` in `.env` at any local Postgres — either a native install (Postgres.app, Homebrew) or the bundled `docker-compose.yml`:

```bash
npm install
cp .env.example .env         # pick the DATABASE_URL line for your setup, or edit it directly
npm run db:up                # only if using docker-compose — docker compose up -d
npm run db:migrate           # applies the schema (uses MIGRATE_DATABASE_URL — see below)
npm run db:seed              # loads demo data
npm run dev
```

### Two database roles

The app runtime connects as a restricted Postgres role, `lavelle_app`, which has full CRUD on every table **except** `audit_event` — there it's INSERT/SELECT only, enforced at the database level (not just the service layer), because the audit log is append-only by contract. Migrations need `CREATE`/role-management privileges that role doesn't have, so they run as a separate, more privileged role via `MIGRATE_DATABASE_URL`. Both are pre-filled in `.env`/`.env.example` for local dev; the `lavelle_app` role and its grants are created by `prisma/migrations/*_app_role_audit_grants`.

Then visit:

- `/register`, `/sign-in` — candidate registration and sign in
- `/portal/*` — the candidate shell, gated: an unpaid applicant sees Dashboard, Catalogue, Profile & ID and Contact us only; Programme, Deadlines, Assessment, Exams, Credentials and Lavelle AI are absent until `candidate_number` is set (first confirmed payment, Slice 3's job — see "the seam" below)
- `/admin/*` — the staff shell (no sign-in screen yet; sign in via `POST /api/auth/callback/staff`)
- [http://localhost:3000/preview/portal](http://localhost:3000/preview/portal) / [`/preview/admin`](http://localhost:3000/preview/admin) — the two shells rendered without auth, for design-fidelity review

Demo accounts (seeded by `prisma/seed.ts`, password `Lavelle2026!` for all):

| Email | Role |
| --- | --- |
| `c.okonji@chambers.ng` | Candidate — enrolled |
| `i.danjuma@example.com` | Candidate — applicant (unpaid, nav-gated) |
| `a.obi@lavelle.ng` | Staff — Super Admin |
| `b.eze@lavelle.ng` | Staff — Operations Admin |
| `f.udo@lavelle.ng` | Staff — Finance Admin |
| `k.balogun@lavelle.ng` | Staff — Academic Admin |
| `t.nwachukwu@lavelle.ng` | Staff — Faculty |
| `h.suleiman@lavelle.ng` | Staff — Support Agent |

**The seam:** `UPDATE "Candidate" SET "candidateNumber" = 'LVL/2026/00001' WHERE email = '...'` flips that account straight to the enrolled shell, with no other row touched — `is_enrolled` is derived from `candidate_number IS NOT NULL`, never stored. This is what Slice 3 (catalogue → payment → enrolment) will drive for real.

No email provider is wired up — verification links are logged to the server console (`[dev] verification email for ...`), not actually sent.

## What's here

| Path | What it is |
| --- | --- |
| `src/app/globals.css` | Design tokens (`@theme`) — colors, fonts, spacing, radii, shadows, light/dark |
| `src/components/ui/` | Component library — Button, Tag, Field/Input, Checkbox, Radio, Segmented, Toggle, Card, Table, Dialog/SlideOver |
| `src/components/shell/` | `CandidateShell`, `CoursePlayerShell`, `AdminShell` — the two app shells and their chrome rules |
| `src/components/auth/`, `src/app/(auth)/` | Register / Sign in screens |
| `src/components/portal/applicant-dashboard.tsx` | The applicant-state dashboard + 3-step profile-completion modal |
| `src/app/portal/`, `src/app/admin/` | Route groups wiring the shells to real sessions |
| `src/app/preview/` | Auth/DB-free renders of both shells, for visual QA only |
| `prisma/schema.prisma` | Full domain model, including the Slice 1 candidate/session/audit tables (column names/types kept verbatim from that handoff's README — later slices reference them by name) |
| `prisma/seed.ts` | Reference data from the design handoffs |
| `src/lib/candidate-session.ts` | Database-backed candidate sessions, `getCurrentCandidate()`, the applicant gate helpers |
| `src/app/actions/candidate-auth.ts` | Server Actions: register, sign in, sign out, resend verification, update profile |
| `src/lib/rate-limit.ts` | Postgres-backed fixed-window rate limiter (register/sign-in/resend, by IP and by email) |
| `src/proxy.ts` | Route protection — layer 1 of the applicant gate (Next 16 renamed `middleware.ts` → `proxy.ts`) |
| `src/lib/auth.ts`, `src/lib/auth.config.ts` | NextAuth config — staff/admin only |
| `src/lib/permissions.ts`, `src/lib/rbac.ts` | The 17-permission catalogue, 6 role presets, staff-side audit logging |
| `tests/` | Vitest — applicant-number concurrency, session revocation, the three-layer applicant gate, per-field validation |

## The applicant gate, enforced three times

Per Slice 1's README: hiding nav items is a courtesy, not a boundary.

1. **`src/proxy.ts`** — real DB-backed session check (Next 16's Proxy defaults to the Node.js runtime, so this isn't a stateless guess); redirects an applicant away from a gated route.
2. **Each gated page** (`src/app/portal/{programme,deadlines,assessment,exams,credentials,ai}/page.tsx`) — calls `requireEnrolledPage()` independently.
3. **`requireEnrolled()`** in `src/lib/candidate-session.ts` — the seam future Server Actions/route handlers call before touching gated data. No gated data exists yet in this slice; this is the hook later slices use.

## What's deliberately not here yet

Password reset (present in the design file but absent from Slice 1's data model/action list), staff-side suspend/reactivate UI (Slice 8), the marketing site, and every feature screen inside the two shells beyond the applicant dashboard (catalogue, payment, course player, assessment, admin operations, etc.).
