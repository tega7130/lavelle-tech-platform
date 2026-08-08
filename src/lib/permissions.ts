import { Permission, StaffRole } from "@/generated/prisma/client";

export { Permission, StaffRole };

export interface PermissionMeta {
  key: Permission;
  category: string;
  description: string;
}

// The 18-permission catalogue, six categories — README "Permissions" table.
// Every permission has a plain-English description shown beside its toggle.
export const PERMISSIONS: PermissionMeta[] = [
  { key: Permission.VIEW_CANDIDATES, category: "Candidate management", description: "View candidate profiles and account details" },
  { key: Permission.EDIT_CANDIDATES, category: "Candidate management", description: "Edit candidate contact details, verify email, suspend accounts" },
  { key: Permission.VIEW_CONTACT_REQUESTS, category: "Candidate management", description: "See support requests submitted by candidates" },
  { key: Permission.RESOLVE_CONTACT_REQUESTS, category: "Candidate management", description: "Respond to and resolve candidate contact requests" },
  { key: Permission.ADD_ADMIN_NOTES, category: "Candidate management", description: "Add internal notes to candidate profiles" },
  { key: Permission.VIEW_PAYMENTS, category: "Finance", description: "View payment history and transaction records" },
  { key: Permission.MANAGE_PAYMENTS, category: "Finance", description: "Manually confirm payments, process refunds" },
  { key: Permission.VIEW_GRADES, category: "Academic", description: "View quiz, examination and drafting exercise results" },
  { key: Permission.GRADE_ASSESSMENTS, category: "Academic", description: "Submit and edit grades for drafting exercises and examinations" },
  { key: Permission.MODERATE_MARKS, category: "Academic", description: "Act as second marker on a returned mark" },
  { key: Permission.MANAGE_PROGRAMMES, category: "Academic", description: "Create, edit and publish programmes and their content" },
  { key: Permission.MANAGE_INTAKES, category: "Academic", description: "Create and manage intake periods and cohorts" },
  { key: Permission.ISSUE_CERTIFICATES, category: "Credentials", description: "Trigger certificate generation on programme completion" },
  { key: Permission.REVOKE_CERTIFICATES, category: "Credentials", description: "Revoke an issued certificate with a mandatory reason" },
  { key: Permission.VIEW_AUDIT_LOG, category: "Platform", description: "Read the admin audit log" },
  { key: Permission.EXPORT_DATA, category: "Platform", description: "Export candidate records, grades and reports as CSV or PDF" },
  { key: Permission.MANAGE_STAFF, category: "Platform", description: "Create staff accounts and assign or revoke permissions" },
  { key: Permission.SUPER_ADMIN, category: "Super access", description: "Full access. Bypasses all checks. Assign with caution." },
];

export const PERMISSION_CATEGORIES = [...new Set(PERMISSIONS.map((p) => p.category))];

// Role tag colours (white text) — README "Roles and their colours" table.
export const ROLE_COLORS: Record<StaffRole, string> = {
  SUPER_ADMIN: "#0c356f",
  OPERATIONS_ADMIN: "#1668e3",
  FINANCE_ADMIN: "#a16207",
  ACADEMIC_ADMIN: "#0f766e",
  FACULTY: "#6d28d9",
  SUPPORT_AGENT: "#475569",
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  SUPER_ADMIN: "Super Admin",
  OPERATIONS_ADMIN: "Operations Admin",
  FINANCE_ADMIN: "Finance Admin",
  ACADEMIC_ADMIN: "Academic Admin",
  FACULTY: "Faculty",
  SUPPORT_AGENT: "Support Agent",
};

// REVOKE_CERTIFICATES, MANAGE_STAFF and SUPER_ADMIN are deliberately absent
// from this list — per the README's role table, no preset below grants
// them; only PERMISSIONS.map(...) (all 18, for Super Admin) does.
const { VIEW_CANDIDATES, EDIT_CANDIDATES, VIEW_CONTACT_REQUESTS, RESOLVE_CONTACT_REQUESTS, ADD_ADMIN_NOTES, VIEW_PAYMENTS, MANAGE_PAYMENTS, VIEW_GRADES, GRADE_ASSESSMENTS, MODERATE_MARKS, MANAGE_PROGRAMMES, MANAGE_INTAKES, ISSUE_CERTIFICATES, VIEW_AUDIT_LOG, EXPORT_DATA } = Permission;

// Applying a preset replaces the current permission set — README.
export const ROLE_PRESETS: Record<StaffRole, Permission[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.key), // all 18
  OPERATIONS_ADMIN: [
    VIEW_CANDIDATES, EDIT_CANDIDATES, VIEW_CONTACT_REQUESTS, RESOLVE_CONTACT_REQUESTS, ADD_ADMIN_NOTES,
    VIEW_PAYMENTS, VIEW_GRADES, MANAGE_INTAKES, ISSUE_CERTIFICATES, VIEW_AUDIT_LOG, EXPORT_DATA,
  ],
  FINANCE_ADMIN: [VIEW_CANDIDATES, VIEW_PAYMENTS, MANAGE_PAYMENTS, VIEW_AUDIT_LOG, EXPORT_DATA],
  // MODERATE_MARKS (second-marker) sits with Academic Admin, not Faculty —
  // Faculty are the first markers being moderated.
  ACADEMIC_ADMIN: [
    VIEW_CANDIDATES, VIEW_GRADES, GRADE_ASSESSMENTS, MODERATE_MARKS, MANAGE_PROGRAMMES, MANAGE_INTAKES,
    ISSUE_CERTIFICATES, VIEW_AUDIT_LOG,
  ],
  FACULTY: [VIEW_CANDIDATES, VIEW_GRADES, GRADE_ASSESSMENTS],
  SUPPORT_AGENT: [VIEW_CANDIDATES, VIEW_CONTACT_REQUESTS, RESOLVE_CONTACT_REQUESTS, ADD_ADMIN_NOTES],
};

// Only Super Admin and Operations Admin may edit staff; everyone else sees
// the permissions card read-only (README).
export const STAFF_EDIT_ROLES: StaffRole[] = [StaffRole.SUPER_ADMIN, StaffRole.OPERATIONS_ADMIN];

/** super_admin's SUPER_ADMIN grant bypasses every other check. */
export function hasPermission(
  staff: { role: StaffRole; grants: { permission: Permission; granted: boolean }[] },
  permission: Permission
): boolean {
  if (staff.grants.some((g) => g.permission === Permission.SUPER_ADMIN && g.granted)) return true;
  return staff.grants.some((g) => g.permission === permission && g.granted);
}

export function canEditStaff(role: StaffRole): boolean {
  return STAFF_EDIT_ROLES.includes(role);
}
