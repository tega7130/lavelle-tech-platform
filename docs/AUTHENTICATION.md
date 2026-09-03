# Authentication & Authorization — Lavelle Tech Platform

## Authentication Overview

Lavelle uses **database-backed sessions** (not JWT) for both candidates and staff. Sessions are stored in the `Session` table with separate isolation between user types.

---

## Candidate Authentication Flow

### Registration

```
User enters: email, password, first name, last name
    ↓
registerCandidate() Server Action
  ├─ Validate email (unique, valid format)
  ├─ Validate password (min 8 chars, complexity)
  ├─ Hash password with bcryptjs (12 rounds)
  ├─ Create Candidate row (status: ACTIVE)
  ├─ Generate 6-digit OTP
  ├─ Create EmailOtpChallenge row (hashed OTP, 5-min expiry)
  ├─ Send OTP via email
  ├─ Redirect to /register/verify-email
    ↓
User enters OTP
    ↓
verifyEmailOtp() Server Action
  ├─ Validate OTP code (length, expiry, correct)
  ├─ Check against hashed value in database
  ├─ Mark EmailOtpChallenge as verified
  ├─ Create Session row (candidateId, 24h expiry)
  ├─ Hash session token with CANDIDATE_SESSION_SECRET
  ├─ Set cookie: lavelle_candidate_session = token_hash
  ├─ Record AuditEvent (CANDIDATE_REGISTERED)
  ├─ Redirect to profile completion flow
```

**Key Files:**
- `/src/lib/candidate-auth.ts` - Business logic
- `/src/app/actions/candidate-auth.ts` - Server Actions
- `/src/app/(auth)/(register)/page.tsx` - UI

### Sign-In

```
User enters: email, password
    ↓
signInCandidate() Server Action
  ├─ Fetch Candidate by email
  ├─ Verify password hash with bcryptjs
  ├─ Check status (not SUSPENDED)
  ├─ Create Session row
  ├─ Hash token, store hash in database
  ├─ Set session cookie
  ├─ Record AuditEvent
  ├─ Redirect to dashboard
```

### Password Reset

```
User enters email
    ↓
requestPasswordReset() Server Action
  ├─ Find candidate by email
  ├─ Generate 6-digit OTP
  ├─ Create PasswordResetOtpChallenge (15-min expiry)
  ├─ Send OTP via email
    ↓
User enters OTP + new password
    ↓
verifyPasswordResetOtp() + resetPassword()
  ├─ Validate OTP
  ├─ Hash new password
  ├─ Update Candidate.passwordHash
  ├─ Delete all existing sessions (force re-login)
  ├─ Record AuditEvent
```

### Session Lifecycle

```
Session Created
  ├─ Token: random 32-byte value
  ├─ Hash: HMAC-SHA256(token, CANDIDATE_SESSION_SECRET)
  ├─ Stored in database: { candidateId, tokenHash, expiresAt }
  ├─ Cookie: lavelle_candidate_session = token_hash
  ├─ Expiry: 24 hours from creation (never extended)
    ↓
Per-Request Verification (Middleware)
  ├─ Extract cookie
  ├─ Hash cookie value
  ├─ Query Session table for matching hash
  ├─ Check expiry (created + 24h < now?)
  ├─ If valid → attach candidateId to request
  ├─ If invalid → clear cookie, redirect to sign-in
    ↓
Session Revocation (Immediate)
  ├─ On logout: DELETE Session row
  ├─ On account suspension: DELETE all candidate's Session rows
  ├─ On password change: DELETE all candidate's Session rows
  ├─ Effect: Any ongoing request fails immediately
```

---

## Staff Authentication Flow

### Invitation

```
Admin invites staff via email
    ↓
inviteStaff() (Admin Action)
  ├─ Create Staff row (status: INVITED, no passwordHash)
  ├─ Create StaffInvitationToken (30-day expiry)
  ├─ Send invitation email with activation link
    ↓
Staff clicks link: /staff/activate?token=xyz
    ↓
GET /api/staff/activate
  ├─ Validate token (hash, expiry, not yet used)
  ├─ Redirect to /staff/set-password?token=xyz
    ↓
Staff enters password + confirms
    ↓
setStaffPassword() Server Action
  ├─ Validate token again
  ├─ Hash password
  ├─ Update Staff.passwordHash
  ├─ Update Staff.status = ACTIVE
  ├─ Mark StaffInvitationToken as used
  ├─ Create initial Session
  ├─ Redirect to admin dashboard
```

### Sign-In (Standard)

```
Staff enters email + password
    ↓
staffSignIn() Server Action
  ├─ Fetch Staff by email
  ├─ Verify password hash
  ├─ Check status (ACTIVE; not SUSPENDED/DEACTIVATED)
  ├─ Create Session row (staffId, 24h expiry)
  ├─ Hash token with STAFF_SESSION_SECRET
  ├─ Set cookie: lavelle_staff_session = token_hash
  ├─ Record AuditEvent (STAFF_SIGNED_IN)
  ├─ Redirect to admin dashboard
```

### Sign-In (OTP Alternative)

```
Staff chooses "Sign in with code" option
    ↓
staffSignInViaOtp() Server Action
  ├─ Fetch Staff by email
  ├─ Check status is ACTIVE
  ├─ Generate 6-digit OTP
  ├─ Create StaffLoginOtpChallenge (5-min expiry)
  ├─ Send OTP via email
    ↓
Staff enters OTP
    ↓
verifyStaffLoginOtp()
  ├─ Validate OTP
  ├─ Create Session row
  ├─ Set session cookie
  ├─ Redirect to dashboard
```

### Password Reset

```
Staff clicks "Forgot password" on sign-in page
    ↓
requestStaffPasswordReset()
  ├─ Send OTP to email
  ├─ Create PasswordResetOtpChallenge
    ↓
Staff enters OTP + new password
    ↓
verifyStaffPasswordResetOtp() + resetStaffPassword()
  ├─ Validate OTP
  ├─ Update passwordHash
  ├─ Delete all staff sessions
  ├─ Redirect to sign-in
```

---

## Session Security

### Token Hashing
```
Token Generation:
  random_token = crypto.getRandomValues(32 bytes)
  token_hash = HMAC-SHA256(random_token, session_secret)
  
Database Storage:
  Session { tokenHash: token_hash, ... }
  
Verification:
  incoming_token = request.cookies.lavelle_candidate_session
  computed_hash = HMAC-SHA256(incoming_token, session_secret)
  if (computed_hash === stored_token_hash) { valid }
```

### Cookie Settings
```typescript
{
  name: 'lavelle_candidate_session',     // or lavelle_staff_session
  value: token_hash,
  httpOnly: true,    // No access from JavaScript
  secure: true,      // HTTPS only in production
  sameSite: 'Lax',   // CSRF protection
  path: '/',
  maxAge: 86400,     // 24 hours
}
```

### No Session Extension
- Sessions expire exactly 24 hours from creation
- No refresh tokens or idle-timeout tracking
- Users must re-authenticate after 24 hours
- Prevents session hijacking from becoming permanent

### Concurrent Sessions
- One session per user (new login revokes old session)
- Enforced via `@unique([candidateId])` on Session table
- Staff can have multiple concurrent sessions (for testing)

---

## Authorization & Permissions

### Role-Based Access

8 Staff Roles with preset permissions:

| Role | Permissions | Use Case |
|------|-----------|----------|
| **SUPER_ADMIN** | All 17 permissions | Complete system access |
| **REGISTRAR** | VIEW_CANDIDATES, EDIT_CANDIDATE_DETAILS, MANAGE_INTAKES_COHORTS | Intake & candidate management |
| **ACADEMIC_ADMIN** | MANAGE_PROGRAMMES, MARK_SUBMISSIONS, MODERATE_GRADES | Curriculum & grading |
| **FACULTY** | MARK_SUBMISSIONS | Grading only |
| **FINANCE** | VIEW_FINANCE, CONFIRM_PAYMENTS, MANAGE_FINANCE | Payment processing |
| **SUPPORT** | RESPOND_SUPPORT | Support desk operations |
| **READ_ONLY** | VIEW_CANDIDATES, VIEW_FINANCE, VIEW_AUDIT_LOG | Reporting/analytics only |
| **CONTENT_MANAGER** | MANAGE_BLOG | Blog authoring |

### Granular Permissions

17 permissions stored as `StaffPermission` rows (not boolean flags):

```
Permission                   | Category | Used For
VIEW_CANDIDATES              | Access   | See candidate list
EDIT_CANDIDATE_DETAILS       | Modify   | Edit profile, suspend
SUSPEND_CANDIDATES           | Modify   | Account suspension
MANAGE_PROGRAMMES            | Modify   | Create/edit courses
MANAGE_INTAKES_COHORTS       | Modify   | Manage enrollment periods
MARK_SUBMISSIONS             | Assess   | Grade drafting
MODERATE_GRADES              | Assess   | Review marks, appeal handling
MANAGE_EXAMS                 | Modify   | Build exams, manage windows
RESET_CANDIDATE_PROGRESS     | Admin    | Restart course progress
VIEW_FINANCE                 | Access   | See payment data
CONFIRM_PAYMENTS             | Modify   | Record offline payments
MANAGE_FINANCE               | Modify   | Generate reports, refunds
ISSUE_CERTIFICATES           | Modify   | Award credentials
REVOKE_CERTIFICATES          | Modify   | Revoke credentials
MANAGE_ANNOUNCEMENTS         | Modify   | Send notifications
MANAGE_BLOG                  | Modify   | Author/publish blog
RESPOND_SUPPORT              | Modify   | Handle support tickets
MANAGE_STAFF                 | Admin    | Invite, suspend staff
VIEW_AUDIT_LOG               | Access   | View event log
```

### Permission Check Pattern

```typescript
// In any Server Action or Route Handler
import { requireStaffPermission } from '@/lib/rbac';
import { Permission } from '@prisma/client';

export async function suspendCandidateAction(candidateId: string) {
  // Extract session from cookies
  const staffSession = await getStaffSession();
  if (!staffSession) {
    throw new Error("Unauthorized");
  }
  
  // Check permission (throws if missing)
  await requireStaffPermission(
    staffSession.staffId,
    Permission.SUSPEND_CANDIDATES
  );
  
  // Permission granted; proceed
  return suspendCandidate(candidateId);
}
```

**How it works:**
```typescript
// /src/lib/rbac.ts
export async function requireStaffPermission(
  staffId: string,
  permission: Permission
): Promise<void> {
  const granted = await prisma.staffPermission.findUnique({
    where: { staffId_permission: { staffId, permission } }
  });
  
  if (!granted) {
    throw new Error(`Permission denied: ${permission}`);
  }
}
```

### SUPER_ADMIN is Not a Bypass

**Misconception:** SUPER_ADMIN role automatically bypasses permission checks.  
**Reality:** SUPER_ADMIN explicitly holds all 17 permissions as database rows.

```typescript
// When staff is created as SUPER_ADMIN
const permissions = [
  'VIEW_CANDIDATES',
  'EDIT_CANDIDATE_DETAILS',
  'SUSPEND_CANDIDATES',
  'MANAGE_PROGRAMMES',
  'MANAGE_INTAKES_COHORTS',
  'MARK_SUBMISSIONS',
  'MODERATE_GRADES',
  'MANAGE_EXAMS',
  'RESET_CANDIDATE_PROGRESS',
  'VIEW_FINANCE',
  'CONFIRM_PAYMENTS',
  'MANAGE_FINANCE',
  'ISSUE_CERTIFICATES',
  'REVOKE_CERTIFICATES',
  'MANAGE_ANNOUNCEMENTS',
  'MANAGE_BLOG',
  'RESPOND_SUPPORT',
  'MANAGE_STAFF',
  'VIEW_AUDIT_LOG',
];

// Each permission stored as a StaffPermission row
for (const perm of permissions) {
  await prisma.staffPermission.create({
    data: { staffId, permission: perm }
  });
}
```

**Why?** Consistency, auditability, and future flexibility (could revoke individual permissions from SUPER_ADMIN if needed).

---

## Account Suspension & Deactivation

### Candidate Suspension

```typescript
await suspendCandidate(candidateId);
  ├─ Update Candidate.status = SUSPENDED
  ├─ Delete all candidate's Session rows (force logout)
  ├─ Prevent access to: portal, exams, submissions
  ├─ Prevent new enrollments
  ├─ Keep: audit trail, enrolments, results, certificates
  ├─ Record AuditEvent (CANDIDATE_SUSPENDED)
```

### Candidate Reactivation

```typescript
await reactivateCandidate(candidateId);
  ├─ Update Candidate.status = ACTIVE
  ├─ Sessions not auto-created (candidate must re-authenticate)
  ├─ Record AuditEvent
```

### Staff Suspension

```typescript
await suspendStaff(staffId);
  ├─ Update Staff.status = SUSPENDED
  ├─ Delete all staff's Session rows
  ├─ Extend all their assigned candidate deadlines (if any)
  ├─ Keep: audit trail, grading records
  ├─ Record AuditEvent (STAFF_SUSPENDED)
```

### Staff Deactivation

```typescript
await deactivateStaff(staffId);
  ├─ Update Staff.status = DEACTIVATED
  ├─ Delete all sessions
  ├─ Remove from: assignments, support desk routing
  ├─ Keep: historical records
  ├─ Cannot be reactivated (marked as deleted)
  ├─ Record AuditEvent (STAFF_DEACTIVATED)
```

---

## Candidate Profile Completion

After email verification, candidates complete a profile:

```
Email Verified
  ↓
Profile Completion Flow (3 steps)
  ├─ Step 1: Personal info (professional status, experience band)
  ├─ Step 2: Photo upload (ID card photo)
  ├─ Step 3: Browse programmes (select course interest)
  ├─ On completion: Redirect to candidate dashboard
```

**Data Stored in `CandidateProfile`:**
- Professional status (PRACTISING_LAWYER, LAW_STUDENT, etc.)
- Experience band (0-2, 3-5, 6-10, 10+ years)
- Contact details (phone, address)
- Photo URL

---

## Authorization Patterns

### Route Protection (Middleware)

```typescript
// /src/middleware.ts
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Public routes (no auth)
  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }
  
  // Candidate portal
  if (pathname.startsWith('/portal')) {
    const candidateSession = await getCandidateSession(request);
    if (!candidateSession) {
      return redirectTo('/(auth)/sign-in');
    }
  }
  
  // Admin portal
  if (pathname.startsWith('/admin')) {
    const staffSession = await getStaffSession(request);
    if (!staffSession) {
      return redirectTo('/staff/sign-in');
    }
  }
}
```

### Action-Level Permission Checks

```typescript
// Server Action that requires permission
export async function publishProgrammeAction(programmeId: string) {
  const staffSession = await getStaffSession();
  
  // Check permission
  await requireStaffPermission(
    staffSession.staffId,
    Permission.MANAGE_PROGRAMMES
  );
  
  // Proceed
  return publishProgramme(programmeId);
}
```

### Route Handler Protection

```typescript
// /src/app/api/exam-registrations/[id]/admission-slip/route.ts
export async function GET(req: Request, { params }) {
  // Check candidate auth
  const candidateSession = await getCandidateSession(req);
  if (!candidateSession) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Generate PDF
  return generateAdmissionSlip(params.id, candidateSession.candidateId);
}
```

---

## Audit Logging

Every authentication action creates an `AuditEvent`:

```
CANDIDATE_REGISTERED        - New candidate created
CANDIDATE_EMAIL_VERIFIED    - Email verification complete
CANDIDATE_SIGNED_IN         - Candidate login
CANDIDATE_SIGNED_OUT        - Candidate logout
CANDIDATE_SUSPENDED         - Account suspended
CANDIDATE_REACTIVATED       - Account reactivated
CANDIDATE_PASSWORD_RESET    - Password changed

STAFF_INVITED               - Staff invitation sent
STAFF_PASSWORD_SET          - Password set during activation
STAFF_SIGNED_IN             - Staff login
STAFF_SIGNED_OUT            - Staff logout
STAFF_SUSPENDED             - Account suspended
STAFF_DEACTIVATED           - Account deactivated
STAFF_PASSWORD_RESET        - Password changed
STAFF_PERMISSION_GRANTED    - Permission added
STAFF_PERMISSION_REVOKED    - Permission removed
```

**Example audit record:**
```json
{
  "eventType": "CANDIDATE_SUSPENDED",
  "performedByStaffId": "staff-123",
  "targetCandidateId": "cand-456",
  "details": {
    "reason": "Misconduct during exam",
    "suspendedAt": "2026-09-03T10:00:00Z"
  },
  "createdAt": "2026-09-03T10:00:00Z"
}
```

---

## Password Security

### Hashing Algorithm
- **Algorithm:** bcryptjs (Blowfish cipher)
- **Rounds:** 12 (computational cost, slows brute-force)
- **Salting:** Automatic per bcrypt

### Password Requirements
- Minimum 8 characters (enforced via Zod schema)
- No complexity requirements (UX decision)

### Password Storage
- Never stored in plain text
- Hash stored in `Candidate.passwordHash` or `Staff.passwordHash`
- Database queries by email (unique), not password

---

## Session Expiry & Reconnection

### Session Expiry Behavior
```
Session created at: 2026-09-03 10:00:00
Expires at: 2026-09-04 10:00:00 (exactly 24h later)

At 10:00:01 on Sep 4:
  - Session is now invalid
  - User's next request fails authentication
  - Middleware redirects to sign-in page
  - Session cookie cleared
```

### User Experience
- No warning banner (session expires silently on next action)
- User returns to sign-in page
- No session extension (refreshing dashboard doesn't extend 24h)
- Can be improved: Add banner "Session expires in 1 hour" (not currently implemented)

---

## Rate Limiting

Rate limits protect against brute-force attacks:

```
POST /register
  ├─ Limit: 5 registrations per email per hour
  ├─ Storage: RateLimitAttempt table
  ├─ Enforced in: registerCandidate() action

POST /sign-in
  ├─ Limit: 10 attempts per email per hour
  ├─ Storage: RateLimitAttempt table
  ├─ Enforced in: signInCandidate() action

POST /password-reset/otp
  ├─ Limit: 5 OTP requests per email per hour
```

**Implementation:**
```typescript
async function checkRateLimit(key: string, action: string) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 3600000); // 1 hour ago
  
  const attempt = await prisma.rateLimitAttempt.findUnique({
    where: { key_action_windowStart: { key, action, windowStart } }
  });
  
  if (attempt && attempt.attemptCount >= MAX_ATTEMPTS) {
    throw new Error("Too many attempts. Try again later.");
  }
  
  // Increment counter
  await prisma.rateLimitAttempt.upsert({
    where: { key_action_windowStart: { key, action, windowStart } },
    update: { attemptCount: { increment: 1 } },
    create: { key, action, windowStart, attemptCount: 1 }
  });
}
```

---

## Multi-Factor Authentication (MFA)

**Current Status:** Not implemented.

**Can be added:**
- TOTP (authenticator apps)
- SMS OTP
- Email OTP (already used for password reset)
- Security keys (WebAuthn/FIDO2)

---

## Key Files

| File | Purpose |
|------|---------|
| `/src/lib/candidate-auth.ts` | Candidate auth business logic (register, sign-in, password reset) |
| `/src/lib/staff-auth.ts` | Staff auth business logic (invitation, sign-in, password reset) |
| `/src/lib/candidate-session.ts` | Session create/validate/revoke for candidates |
| `/src/lib/staff-session.ts` | Session create/validate/revoke for staff |
| `/src/lib/rbac.ts` | Permission checking, role-based access |
| `/src/lib/permissions.ts` | Permission definitions, role presets |
| `/src/app/actions/candidate-auth.ts` | Candidate auth server actions (exposed to client) |
| `/src/app/actions/staff-auth.ts` | Staff auth server actions |
| `/src/middleware.ts` | Request authentication, route gating |
| `/src/app/(auth)/page.tsx` | Sign-in/register UI |
| `/src/app/staff/sign-in/page.tsx` | Staff sign-in UI |

---

## Summary

| Aspect | Implementation |
|--------|---|
| **Session Type** | Database-backed (not JWT) |
| **Session Expiry** | 24 hours (fixed, no extension) |
| **Password Hashing** | bcryptjs (12 rounds) |
| **Token Hashing** | HMAC-SHA256 |
| **Cookie Security** | HttpOnly, Secure, SameSite=Lax |
| **Candidate Auth** | Email + password |
| **Staff Auth** | Email + password or OTP |
| **Authorization** | Role-based + granular permissions |
| **Audit Logging** | All auth events logged |
| **Rate Limiting** | Per-email-per-hour limits |
| **Session Revocation** | Immediate on suspension/logout |
