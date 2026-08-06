# Lavelle Tech Platform

Professional legal specialization and CPD platform for the Nigerian legal market. Candidates register, browse a catalogue of specialization programmes, pay per programme, study online, sit a proctored certifying examination, and receive a credential any third party can verify publicly.

This repository currently contains **only the foundation**: design tokens, the shared component library, the two app shells (candidate portal, admin), the domain schema, and authentication/RBAC. No product screens (dashboards, catalogue, marking queue, etc.) exist yet — those ship as later, vertical-slice handoffs.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4**, themed with the exact tokens from the design handoff (`design_handoff_00_foundations/styles.css`) — Poppins, exact hex values, no eyedropping
- **PostgreSQL** via **Prisma 7** (driver adapter: `@prisma/adapter-pg`)
- **Auth.js (NextAuth) v5**, credentials-based, two separate login domains (Candidate, Staff), JWT sessions

## Getting started

```bash
npm install
cp .env.example .env        # already populated for local Docker Postgres
npm run db:up                # docker compose up -d — starts Postgres
npm run db:migrate           # applies the schema and seeds demo data
npm run dev
```

Then visit:

- [http://localhost:3000/preview/portal](http://localhost:3000/preview/portal) / [`/preview/admin`](http://localhost:3000/preview/admin) — the two shells rendered without auth, for design-fidelity review
- `/portal/*` and `/admin/*` — the real, auth-gated routes (require signing in through `/api/auth/callback/candidate` or `/api/auth/callback/staff`; there is no sign-in screen yet, see below)

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

**Docker is required for local Postgres and isn't available in every environment this was built in** — if `npm run db:up` fails, install Docker Desktop (or point `DATABASE_URL` in `.env` at any Postgres instance) before running `db:migrate`.

## What's here

| Path | What it is |
| --- | --- |
| `src/app/globals.css` | Design tokens (`@theme`) — colors, fonts, spacing, radii, shadows, light/dark |
| `src/components/ui/` | Component library — Button, Tag, Field/Input, Checkbox, Radio, Segmented, Toggle, Card, Table, Dialog/SlideOver |
| `src/components/shell/` | `CandidateShell`, `CoursePlayerShell`, `AdminShell` — the two app shells and their chrome rules |
| `src/app/portal/`, `src/app/admin/` | Route groups wiring the shells to real sessions, with stub pages per nav item |
| `src/app/preview/` | Auth/DB-free renders of both shells, for visual QA only |
| `prisma/schema.prisma` | Full domain model — Candidate, Staff, Programme, Module, Lecture, Intake, Cohort, Enrolment, Payment, Question, Examination, ExaminationSitting, Certificate, PermissionGrant, AuditLogEntry, ContactRequest |
| `prisma/seed.ts` | Reference data from the design handoff README |
| `src/lib/auth.ts`, `src/lib/auth.config.ts`, `src/middleware.ts` | NextAuth config (candidate + staff credential providers), route protection |
| `src/lib/permissions.ts` | The 17-permission catalogue, 6 role presets, role colours |
| `src/lib/rbac.ts` | Server-side guards: permission checks, role-preset application, the "at least one active super admin" invariant, audit logging |

## What's deliberately not here yet

Register / Sign in / Verify screens, the marketing site, and every feature screen inside the two shells (dashboards, programme catalogue, marking queue, exam builder, candidate record, finance, etc.) — see the design handoff's "What comes next" section for the planned slice order.
