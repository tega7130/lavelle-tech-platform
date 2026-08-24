import type { Permission, StaffRole } from "@/generated/prisma/client";

// Deliberately no `export { Permission, StaffRole }` here — re-exporting
// a Prisma-generated enum as a VALUE (not just a type) causes any
// "use client" component that imports it, even transitively through this
// file, to crash Turbopack's bundler outright ("chunking context does
// not support external modules (request: node:module)"), reproducible
// in both `next dev` and `next build`. Every constant below is built
// from plain string literals cast to the enum's type instead of
// referencing the enum object itself, and this file exports the TYPES
// only. Call sites that need the real enum object (server-side Prisma
// queries) import Permission/StaffRole directly from
// "@/generated/prisma/client".
export type { Permission, StaffRole };

export interface PermissionMeta {
  key: Permission;
  category: string;
  description: string;
}

// The permission catalogue, grouped by category — Slice 08 README
// "Permissions" table. Every permission has a plain-English description
// shown beside its toggle.
export const PERMISSIONS: PermissionMeta[] = [
  { key: "VIEW_CANDIDATES" as Permission, category: "Candidate management", description: "View candidate profiles, enrolments and progress" },
  { key: "EDIT_CANDIDATE_DETAILS" as Permission, category: "Candidate management", description: "Edit candidate contact and profile details" },
  { key: "SUSPEND_CANDIDATES" as Permission, category: "Candidate management", description: "Suspend and reactivate candidate accounts" },
  { key: "MANAGE_PROGRAMMES" as Permission, category: "Academic", description: "Create, edit and publish programmes and their content" },
  { key: "MANAGE_INTAKES_COHORTS" as Permission, category: "Academic", description: "Create and manage intake periods and cohorts" },
  { key: "MARK_SUBMISSIONS" as Permission, category: "Academic", description: "Submit and edit grades for drafting exercises and examinations" },
  { key: "MODERATE_GRADES" as Permission, category: "Academic", description: "Act as second marker on a returned mark" },
  { key: "MANAGE_EXAMS" as Permission, category: "Academic", description: "Build examinations and manage sittings and results" },
  { key: "RESET_CANDIDATE_PROGRESS" as Permission, category: "Academic", description: "Reset a candidate's progress in a programme back to the start" },
  { key: "VIEW_FINANCE" as Permission, category: "Finance", description: "View payment history and transaction records" },
  { key: "CONFIRM_PAYMENTS" as Permission, category: "Finance", description: "Manually confirm payments and record offline transactions" },
  { key: "MANAGE_FINANCE" as Permission, category: "Finance", description: "Process refunds and adjust the ledger" },
  { key: "ISSUE_CERTIFICATES" as Permission, category: "Credentials", description: "Trigger certificate generation on programme completion" },
  { key: "REVOKE_CERTIFICATES" as Permission, category: "Credentials", description: "Revoke an issued certificate with a mandatory reason" },
  { key: "MANAGE_ANNOUNCEMENTS" as Permission, category: "Communications", description: "Compose, schedule and send announcements to candidates" },
  { key: "MANAGE_BLOG" as Permission, category: "Marketing", description: "Write, edit and publish blog posts" },
  { key: "RESPOND_SUPPORT" as Permission, category: "Support", description: "View and respond to candidate support requests" },
  { key: "MANAGE_STAFF" as Permission, category: "Platform", description: "Create staff accounts and assign or revoke permissions" },
  { key: "VIEW_AUDIT_LOG" as Permission, category: "Platform", description: "Read the admin audit log" },
];

export const PERMISSION_CATEGORIES = [...new Set(PERMISSIONS.map((p) => p.category))];

// Role tag colours (white text) — README "Roles and their colours" table.
export const ROLE_COLORS: Record<StaffRole, string> = {
  SUPER_ADMIN: "#0c356f",
  REGISTRAR: "#1668e3",
  ACADEMIC_ADMIN: "#0f766e",
  FACULTY: "#6d28d9",
  FINANCE: "#a16207",
  SUPPORT: "#475569",
  READ_ONLY: "#64748b",
  CONTENT_MANAGER: "#9333ea",
} as Record<StaffRole, string>;

export const ROLE_LABELS: Record<StaffRole, string> = {
  SUPER_ADMIN: "Super Admin",
  REGISTRAR: "Registrar",
  ACADEMIC_ADMIN: "Academic Admin",
  FACULTY: "Faculty",
  FINANCE: "Finance",
  SUPPORT: "Support",
  READ_ONLY: "Read Only",
  CONTENT_MANAGER: "Content Manager",
} as Record<StaffRole, string>;

// REVOKE_CERTIFICATES and MANAGE_STAFF are deliberately absent from every
// preset below — per the README, no preset grants them; only
// PERMISSIONS.map(...) (all 17, for Super Admin) does. A super admin
// holds every permission as a real, individually-revocable row — rule 1
// ("the grant is the authority") applies to super admins too; there is
// no separate bypass flag.
const VIEW_CANDIDATES = "VIEW_CANDIDATES" as Permission;
const EDIT_CANDIDATE_DETAILS = "EDIT_CANDIDATE_DETAILS" as Permission;
const SUSPEND_CANDIDATES = "SUSPEND_CANDIDATES" as Permission;
const MANAGE_PROGRAMMES = "MANAGE_PROGRAMMES" as Permission;
const MANAGE_INTAKES_COHORTS = "MANAGE_INTAKES_COHORTS" as Permission;
const MARK_SUBMISSIONS = "MARK_SUBMISSIONS" as Permission;
const MODERATE_GRADES = "MODERATE_GRADES" as Permission;
const MANAGE_EXAMS = "MANAGE_EXAMS" as Permission;
const RESET_CANDIDATE_PROGRESS = "RESET_CANDIDATE_PROGRESS" as Permission;
const VIEW_FINANCE = "VIEW_FINANCE" as Permission;
const CONFIRM_PAYMENTS = "CONFIRM_PAYMENTS" as Permission;
const MANAGE_FINANCE = "MANAGE_FINANCE" as Permission;
const ISSUE_CERTIFICATES = "ISSUE_CERTIFICATES" as Permission;
const MANAGE_ANNOUNCEMENTS = "MANAGE_ANNOUNCEMENTS" as Permission;
const MANAGE_BLOG = "MANAGE_BLOG" as Permission;
const RESPOND_SUPPORT = "RESPOND_SUPPORT" as Permission;
const VIEW_AUDIT_LOG = "VIEW_AUDIT_LOG" as Permission;

// Applying a preset replaces the current permission set — README.
export const ROLE_PRESETS: Record<StaffRole, Permission[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.key), // all 18
  REGISTRAR: [
    VIEW_CANDIDATES, EDIT_CANDIDATE_DETAILS, SUSPEND_CANDIDATES,
    MANAGE_INTAKES_COHORTS, ISSUE_CERTIFICATES, MANAGE_ANNOUNCEMENTS, RESPOND_SUPPORT, VIEW_AUDIT_LOG,
  ],
  // MODERATE_GRADES (second-marker) sits with Academic Admin, not
  // Faculty — Faculty are the first markers being moderated.
  ACADEMIC_ADMIN: [
    VIEW_CANDIDATES, MARK_SUBMISSIONS, MODERATE_GRADES, MANAGE_PROGRAMMES, MANAGE_EXAMS,
    RESET_CANDIDATE_PROGRESS, MANAGE_INTAKES_COHORTS, ISSUE_CERTIFICATES, VIEW_AUDIT_LOG,
  ],
  FACULTY: [VIEW_CANDIDATES, MARK_SUBMISSIONS],
  FINANCE: [VIEW_CANDIDATES, VIEW_FINANCE, CONFIRM_PAYMENTS, MANAGE_FINANCE, VIEW_AUDIT_LOG],
  SUPPORT: [VIEW_CANDIDATES, RESPOND_SUPPORT],
  READ_ONLY: [VIEW_CANDIDATES, VIEW_FINANCE, VIEW_AUDIT_LOG],
  CONTENT_MANAGER: [MANAGE_BLOG],
} as Record<StaffRole, Permission[]>;

/**
 * Presence is the authority (rule 1) — a permission check is nothing
 * more than "does a StaffPermission row exist for this staff/permission
 * pair." Super admins hold all 17 rows for real (seeded by
 * applyRolePreset), so there is no separate bypass branch here.
 */
export function hasPermission(
  staff: { grants: { permission: Permission }[] },
  permission: Permission
): boolean {
  return staff.grants.some((g) => g.permission === permission);
}
