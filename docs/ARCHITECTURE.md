# Architecture — Lavelle Tech Platform

## Framework & Runtime

**Framework:** Next.js 16.3.0 with App Router  
**Language:** TypeScript (strict mode)  
**Runtime:** Node.js 20+ (serverless on Vercel)  
**Database:** PostgreSQL with Prisma ORM 7.9.1  
**Styling:** Tailwind CSS 4  

The application is a **monolithic Next.js application** with:
- Server-side rendering (SSR) for public pages
- Client-side interactivity for forms and real-time UI
- Server Actions for mutations
- Route handlers for webhooks and file serving
- Middleware for request authentication and routing

---

## Application Layers

```
┌──────────────────────────────────────────────────────────────┐
│                   USER INTERFACES                            │
├──────────────────────────────────────────────────────────────┤
│ Public Website  │  Candidate Portal  │  Admin Portal         │
│ (pages)         │  (pages)           │  (pages)              │
│ Marketing       │  Registration      │  Dashboard            │
│ Programmes      │  Profile           │  Staff Management     │
│ Blog            │  Learning          │  Programme Auth       │
│ FAQ             │  Exams             │  Candidate Records    │
│ Certificate     │  Certificates      │  Payments             │
│ Verification    │  Support           │  Marking              │
│ Contact Form    │                    │  Exam Admin           │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                   NEXT.JS APP ROUTER                         │
├──────────────────────────────────────────────────────────────┤
│ Server Components (RSC) │ Client Components (Interactivity)  │
│ - Fetching data         │ - Forms, buttons, modals           │
│ - Permission checks     │ - Real-time validation            │
│ - Page rendering        │ - UI state management              │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│        SERVER ACTIONS & API ROUTES (Mutation Layer)          │
├──────────────────────────────────────────────────────────────┤
│ Server Actions (Form handling)                               │
│ - registerCandidate()       - createProgramme()              │
│ - signInCandidate()         - publishExam()                  │
│ - submitDrafting()          - issueCredential()              │
│ - recordVideoProgress()     - suspendCandidate()             │
│                                                               │
│ Route Handlers (APIs)                                        │
│ - POST /api/webhooks/[provider]  (Nomba, Paystack)          │
│ - POST /api/sitting/answer       (Exam answer submission)    │
│ - POST /api/uploads/sign         (Presigned URL generation)  │
│ - POST /api/progress/draft       (Drafting autosave)         │
│ - POST /api/cron/*               (Scheduled jobs)            │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                   MIDDLEWARE (Request Level)                 │
├──────────────────────────────────────────────────────────────┤
│ - Session extraction from cookies                            │
│ - Route protection (redirect unauthenticated)               │
│ - Permission gating                                          │
│ - Logging and monitoring                                     │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│            BUSINESS LOGIC LAYER (/src/lib)                   │
├──────────────────────────────────────────────────────────────┤
│ 130+ files organizing domain logic:                          │
│ - Authentication (candidate-auth.ts, staff-auth.ts)         │
│ - Authorization (rbac.ts, permissions.ts)                    │
│ - Programmes (programme-*.ts, 7 files)                      │
│ - Enrollment (enrolment.ts, payment*.ts)                    │
│ - Learning (lecture-*.ts, progress.ts, notes.ts)            │
│ - Assessment (marking*.ts, rubric*.ts, grading.ts)         │
│ - Exams (exam-*.ts, sitting*.ts, 8 files)                  │
│ - Certificates (certificate-*.ts, 5 files)                 │
│ - Support (support*.ts, 3 files)                            │
│ - Announcements (announcement-*.ts, 3 files)                │
│ - Analytics (analytics-*.ts, 5 files)                       │
│ - Admin (admin-*.ts, 3 files)                               │
│ - Utilities (validation, email, PDF, slug, etc.)            │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                   DATABASE ACCESS (Prisma)                   │
├──────────────────────────────────────────────────────────────┤
│ - Type-safe queries (generated client)                       │
│ - Transactions for multi-step operations                     │
│ - Connection pooling via Prisma Postgres Adapter            │
│ - Migrations versioned in /prisma/migrations/                │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                   PostgreSQL DATABASE                        │
├──────────────────────────────────────────────────────────────┤
│ - 67 models (candidates, staff, programmes, assessments)    │
│ - 39 enums (statuses, roles, permissions, types)            │
│ - Constraints: FK, unique, check, partial unique indexes    │
│ - Audit table (append-only, DB role restricted)             │
└──────────────────────────────────────────────────────────────┘
```

---

## Request/Response Flow

### Example: Candidate Takes a Quiz

```
1. UI (Client Component)
   ↓
2. [quiz-screen.tsx] renders QuizQuestion + QuizOption components
   ↓
3. User selects option, clicks "Submit"
   ↓
4. Client calls Server Action → submitQuizAttempt({quizId, answers, ...})
   ↓
5. submitQuizAttempt (Server Action)
   ├─ Extract session from cookies
   ├─ Verify candidate auth (middleware + action-level check)
   ├─ Call lib function: recordQuizAttempt(candidateId, quizId, answers)
   │
6. recordQuizAttempt (Business Logic)
   ├─ Validate: quiz exists, candidate enrolled, deadline not passed
   ├─ Compare answers to quiz key (marked wrong/right)
   ├─ Create QuizAttempt row with results
   ├─ Update LectureProgress.stepsCompleted if all steps done
   ├─ Compute updated progress %
   ├─ Record AuditEvent (QUIZ_ATTEMPT)
   ├─ Return: { score, passed, nextAction, ... }
   │
7. Database (/src/generated/prisma)
   ├─ INSERT QuizAttempt row
   ├─ UPDATE LectureProgress row
   ├─ INSERT AuditEvent row
   │
8. Response sent back to client
   ↓
9. UI Updates
   ├─ Show score badge
   ├─ Show "Quiz Passed" or "Quiz Failed"
   ├─ Enable/disable next button based on score
   ├─ Trigger success toast
```

### Example: Finance Staff Records Offline Payment

```
1. Admin UI (Client Component)
   ↓
2. [offline-payment-dialog.tsx] renders form
   ↓
3. Staff fills: amount, mode (bank_transfer/cash/POS/cheque), notes
   ↓
4. Client calls Server Action → recordOfflinePaymentAction({enrollmentId, amount, mode, notes})
   ↓
5. recordOfflinePaymentAction (Server Action)
   ├─ Extract session from cookies
   ├─ Verify staff auth + permission: CONFIRM_PAYMENTS
   ├─ Call lib function: recordOfflinePayment(enrollmentId, ...)
   │
6. recordOfflinePayment (Business Logic)
   ├─ Validate: enrollment exists, payment pending, amount matches
   ├─ Create Payment row (status: SUCCESS, provider: OFFLINE, mode, notes)
   ├─ Create OfflinePaymentMode row (for audit)
   ├─ Update Enrolment to ACTIVE
   ├─ Issue IdCard
   ├─ Create Notification for candidate (payment confirmed)
   ├─ Queue email: paymentReceivedEmail()
   ├─ Record AuditEvent (PAYMENT_RECORDED)
   │
7. Database Operations (in transaction)
   ├─ INSERT Payment
   ├─ INSERT OfflinePaymentMode
   ├─ UPDATE Enrolment
   ├─ INSERT IdCard
   ├─ INSERT Notification
   ├─ INSERT AuditEvent
   │
8. Email sent asynchronously (never blocks response)
   │
9. Response sent to client
   ↓
10. UI Updates
    ├─ Close dialog
    ├─ Refresh enrolment list
    ├─ Show success toast
```

---

## Frontend Architecture

### Components Structure

```
/src/components/
├── /ui                      # Reusable UI components
│   ├── button.tsx           # <Button> with variants
│   ├── input.tsx            # Form inputs with validation
│   ├── form.tsx             # React Hook Form wrapper
│   ├── dialog.tsx           # Modal/dialog
│   ├── table.tsx            # Data table
│   ├── card.tsx             # Card container
│   └── ... (20+ UI components)
│
├── /shell                   # Layout shells
│   ├── admin-shell.tsx      # Admin sidebar + header
│   ├── candidate-shell.tsx  # Candidate portal navigation
│   └── session-expiry-banner.tsx
│
├── /auth                    # Authentication forms
│   ├── register-form.tsx
│   ├── login-form.tsx
│   ├── password-reset-form.tsx
│   └── otp-input.tsx
│
├── /admin                   # Admin-specific features
│   ├── programme-list.tsx
│   ├── programme-editor.tsx
│   ├── exam-builder.tsx
│   ├── marking-queue.tsx
│   └── ... (15+ admin components)
│
├── /portal                  # Candidate portal components
│   ├── course-player.tsx    # Full-screen lecture player
│   ├── progress-ring.tsx    # Visual progress indicator
│   ├── quiz-screen.tsx
│   ├── exam-sitting.tsx
│   └── ... (20+ portal components)
│
└── /site                    # Public website components
    ├── site-header.tsx
    ├── site-footer.tsx
    ├── programme-carousel.tsx
    └── ... (10+ marketing components)
```

### Client Components (Interactivity)

Client components (`"use client"`) handle:
- Form submission via Server Actions
- Real-time validation with Zod
- Loading/error state management
- Modal and dropdown interactions
- Video player controls
- Drag-and-drop for programme reordering
- Exam answer flagging/navigation

**Example:** `src/components/portal/quiz-screen.tsx`
```typescript
"use client"; // Client-side interactivity

export function QuizScreen({ quiz, onComplete }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  
  const handleSubmit = async () => {
    const result = await submitQuizAttemptAction({ 
      quizId: quiz.id, 
      answers 
    });
    if (result.success) {
      setSubmitted(true);
      onComplete(result.score);
    }
  };
  
  return (
    <div>
      {/* Render questions, handle selection, submit button */}
    </div>
  );
}
```

### Server Components (Data Fetching)

Server components fetch data and don't send JavaScript to browser:
- Programme detail pages
- Candidate dashboard
- Admin reports
- Lecture content (static)

**Example:** `src/app/admin/candidates/[id]/page.tsx`
```typescript
// Server Component (no "use client")

export default async function CandidateRecordPage({ params }) {
  // Direct database access (no API call needed)
  const candidate = await getCandidateDetail(params.id);
  const enrolments = await getCandidateEnrolments(params.id);
  
  return (
    <div>
      <h1>{candidate.name}</h1>
      <EnrolmentTable enrolments={enrolments} />
    </div>
  );
}
```

---

## Backend Architecture

### Server Actions

Server Actions handle form submissions and mutations:

```typescript
// /src/app/actions/candidate-auth.ts
"use server";

export async function registerCandidate(formData: unknown) {
  // 1. Validate input
  const input = registerSchema.parse(formData);
  
  // 2. Extract request context (IP, headers)
  const ip = await getClientIp();
  
  // 3. Call business logic
  const result = await createCandidate(
    input.email,
    input.password,
    input.firstName,
    input.lastName
  );
  
  // 4. Handle errors/success
  if (!result.ok) {
    return { error: result.error };
  }
  
  // 5. Revalidate affected paths
  revalidatePath("/");
  
  // 6. Redirect or return success
  redirect("/register/verify-email");
}
```

### API Routes

Route handlers (`/src/app/api/`) handle webhooks, file operations, and specialized endpoints:

```typescript
// /src/app/api/webhooks/nomba/route.ts
export async function POST(req: Request) {
  // 1. Extract signature from headers
  const signature = req.headers.get("x-nomba-signature");
  
  // 2. Read body
  const body = await req.text();
  
  // 3. Verify HMAC-SHA256 signature
  if (!verifyNombaSignature(body, signature)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // 4. Parse and process
  const event = JSON.parse(body);
  const result = await handlePaymentWebhook(event);
  
  // 5. Return idempotent response
  return Response.json({ success: true });
}
```

### Middleware

Middleware (`/src/middleware.ts`) intercepts requests:

```typescript
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Public routes (no auth required)
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }
  
  // Admin routes (staff auth required)
  if (pathname.startsWith("/admin")) {
    const staffSession = await getStaffSession(request);
    if (!staffSession) {
      return redirectTo("/staff/sign-in");
    }
    // Attach session to request
    return NextResponse.next();
  }
  
  // Candidate routes (candidate auth required)
  if (pathname.startsWith("/portal")) {
    const candidateSession = await getCandidateSession(request);
    if (!candidateSession) {
      return redirectTo("/(auth)/sign-in");
    }
  }
}
```

### Background Jobs (Cron)

Vercel Cron Jobs handle scheduled tasks:

```typescript
// /src/app/api/cron/send-scheduled/route.ts
export async function POST(req: Request) {
  // 1. Verify request is from Vercel (bearer token)
  const token = req.headers.get("authorization")?.split(" ")[1];
  if (token !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // 2. Find all SCHEDULED announcements
  const announcements = await prisma.announcement.findMany({
    where: { state: AnnouncementState.SCHEDULED }
  });
  
  // 3. Send each via email, in-app, WhatsApp, SMS
  for (const announcement of announcements) {
    await deliverAnnouncement(announcement);
  }
  
  // 4. Update state to SENT
  await prisma.announcement.updateMany({
    data: { state: AnnouncementState.SENT }
  });
  
  return Response.json({ sent: announcements.length });
}
```

**Vercel Cron Jobs Configured:**
- `POST /api/cron/send-scheduled` - Every minute (announcement delivery)
- `POST /api/cron/expire-sittings` - Every hour (exam sitting expiry)

---

## Database Architecture

### Connection Strategy
- **Local Development:** PostgreSQL via Docker
- **Staging/Production:** Vercel Postgres with Prisma Postgres Adapter
- **Connection Pooling:** Prisma's built-in pooling (managed by adapter)
- **Transactions:** Used for multi-step operations (registration, payment)

### Data Patterns

**Immutable Records:**
- `Certificate` - Issued once, never edited. Revocation creates superseded certificate
- `AuditEvent` - Append-only audit log (DB role has INSERT/SELECT only)
- `Payment` - Recording is immutable (offline records are manual, webhook-based permanent)

**Derived-on-Read:**
- `Deadline` state (computed from enrollment schedule + suspension)
- Progress percentage (computed from LectureProgress records)
- Module completion percentage (computed from lecture states)
- Grade band (computed from ProgrammeResult marks)

**Snapshots (Stored at Point-in-Time):**
- `ProgrammeResult` stores snapshot of assessment weighting used
- `ProgrammeResult` stores snapshot of grade band used
- Ensures historical accuracy if rules change mid-year

**Polymorphic Tables:**
- `Session` (one row per login session; XOR: candidateId OR staffId)
- `Notification` (serves both candidates and staff)
- `Mark` (stores marking for both DRAFTING and EXAMINATION)

### Relationships & Cascades

**Key Foreign Keys:**
- `Enrolment.candidateId` → `Candidate` (RESTRICT: prevent candidate deletion if enrolled)
- `Enrolment.programmeId` → `Programme` (CASCADE: delete enrolments if programme deleted)
- `LectureProgress.lectureId` → `Lecture` (CASCADE: delete progress if lecture deleted)
- `DraftingSubmission.lectureId` → `Lecture` (CASCADE)
- `Mark.markableId` + `markableKind` (polymorphic, no FK constraint)

**No Cascade Deletes For:**
- `Candidate` (business rule: never delete candidates)
- `Payment` (immutable financial record)
- `Certificate` (immutable credential)

---

## Authentication Flow (Detailed)

### Candidate Registration
```
1. POST /register (client)
   ↓
2. registerCandidate() Server Action
   ├─ Validate email, password, first/last name
   ├─ Hash password with bcryptjs (12 rounds)
   ├─ Create Candidate row (status: ACTIVE)
   ├─ Generate EmailOtpChallenge (6-digit OTP)
   ├─ Send OTP via email
   ├─ Store in database (hashed, with expiry)
   │
3. POST /verify-email (client submits OTP)
   ↓
4. verifyEmailOtp() Server Action
   ├─ Validate OTP code
   ├─ Check expiry (5 minutes)
   ├─ Mark EmailOtpChallenge as verified
   ├─ Create Session row (candidateId, 24h expiry)
   ├─ Set session cookie (lavelle_candidate_session)
   ├─ Redirect to dashboard
```

### Staff Sign-In
```
1. POST /staff/sign-in (client)
   ↓
2. staffSignIn() Server Action
   ├─ Validate email + password
   ├─ Fetch Staff record
   ├─ Verify password hash
   ├─ Check status (not SUSPENDED/DEACTIVATED)
   │
3. Create Session row (staffId, 24h expiry)
   ├─ Generate random token
   ├─ Hash token with STAFF_SESSION_SECRET
   ├─ Store hash in database
   ├─ Set session cookie (lavelle_staff_session)
   │
4. Redirect to admin dashboard
```

### Session Verification (Per-Request)
```
1. Middleware runs on every request
   ├─ Extract cookie: lavelle_candidate_session or lavelle_staff_session
   ├─ If no cookie → public or auth required route check
   ├─ Parse cookie value (token)
   ├─ Hash token with session secret
   ├─ Query Session table for matching hash
   ├─ Check expiry (created + 24h < now?)
   ├─ If valid → attach to request context
   ├─ If invalid → clear cookie, redirect to sign-in
```

### Session Revocation
Session is revoked immediately when:
- Candidate calls `signOutCandidate()`
- Staff calls `signOutStaff()`
- Candidate account suspended (all sessions deleted)
- Staff account deactivated (all sessions deleted)
- Password changed (all sessions deleted)

---

## Authorization System

### Role-Based Access
8 Staff Roles (in `StaffRole` enum):
- `SUPER_ADMIN` - Full access
- `REGISTRAR` - Candidate intake management
- `ACADEMIC_ADMIN` - Programme authoring
- `FACULTY` - Lecture delivery, marking
- `FINANCE` - Payment and ledger management
- `SUPPORT` - Support desk operations
- `READ_ONLY` - Dashboard view only
- `CONTENT_MANAGER` - Blog authoring

### Permission-Based Gating
17 Granular Permissions (checked at action level):
- `VIEW_CANDIDATES`
- `EDIT_CANDIDATE_DETAILS`
- `SUSPEND_CANDIDATES`
- `MANAGE_PROGRAMMES`
- `MANAGE_INTAKES_COHORTS`
- `MARK_SUBMISSIONS`
- `MODERATE_GRADES`
- `MANAGE_EXAMS`
- `RESET_CANDIDATE_PROGRESS`
- `VIEW_FINANCE`
- `CONFIRM_PAYMENTS`
- `MANAGE_FINANCE`
- `ISSUE_CERTIFICATES`
- `REVOKE_CERTIFICATES`
- `MANAGE_ANNOUNCEMENTS`
- `MANAGE_BLOG`
- `RESPOND_SUPPORT`
- `MANAGE_STAFF`
- `VIEW_AUDIT_LOG`

### Permission Check Pattern
```typescript
// In any Server Action
export async function suspendCandidateAction(candidateId: string) {
  const staffSession = await getStaffSession();
  
  // Check permission
  if (!staffSession) {
    throw new Error("Unauthorized");
  }
  
  const hasPermission = await requireStaffPermission(
    staffSession.staffId,
    Permission.SUSPEND_CANDIDATES
  );
  
  if (!hasPermission) {
    throw new Error("Forbidden: insufficient permissions");
  }
  
  // Proceed with action
  return suspendCandidate(candidateId);
}
```

### SUPER_ADMIN Special Case
- SUPER_ADMIN is NOT a bypass flag
- SUPER_ADMIN role explicitly holds all 17 permissions as database rows
- Same permission checks apply
- This ensures consistency and auditability

---

## External Integrations

### Payment Webhooks (Nomba)
```
1. Candidate completes payment on Nomba gateway
   ↓
2. Nomba sends POST to /api/webhooks/nomba
   ├─ Body: { transactionId, customerId, amount, status, ... }
   ├─ Header X-Nomba-Signature: HMAC-SHA256(body, webhook_secret)
   │
3. Webhook handler verifies signature
   ├─ Reconstruct body from request
   ├─ Compute HMAC-SHA256 hash
   ├─ Compare with header signature
   ├─ Return 401 if mismatch
   │
4. Process payment event
   ├─ Check WebhookEvent table for idempotency key
   ├─ If already processed → return 200 (idempotent)
   ├─ Extract enrollmentId from customerId
   ├─ Create Payment row (status: SUCCESS)
   ├─ Update Enrolment to ACTIVE
   ├─ Issue IdCard
   ├─ Create Notification for candidate
   ├─ Mark WebhookEvent as processed
   │
5. Return 200 OK (async email queued)
```

### Email Delivery (Brevo SMTP)
```
nodemailer transports to:
  Host: smtp-relay.brevo.com
  Port: 587 (TLS)
  Auth: apiKey (Brevo API key)
  
Email templates:
- Verification OTP
- Verification link
- Password reset OTP
- Staff invitation
- Payment received
- Enrolment confirmation
- Exam registration
- Announcement (multi-channel)

Async pattern:
- Queue email in Promise.resolve() (fire and forget)
- Log to EmailLog table for audit
- Never block webhook/action response
```

### Media (Cloudinary)
```
Upload flow:
1. Client requests presigned URL
   POST /api/uploads/sign
   ├─ Verify permission
   ├─ Generate token via cloudinary.utils.generateSignature()
   ├─ Return token + upload URL
   
2. Client uploads directly to Cloudinary
   POST to cloudinary.com/upload
   ├─ Send file + token (no server I/O)
   ├─ Cloudinary responds with mediaId + duration
   
3. Cloudinary sends webhook
   POST /api/webhooks/cloudinary
   ├─ Create MediaAsset row with public URL
   ├─ Update Programme.heroAssetId or Lecture.mediaAssetId
   
4. Client displays media
   GET presigned URL (signed by backend)
```

### Monitoring (Sentry)
```
Automatically captures:
- Unhandled exceptions
- Server Action errors
- API route errors
- Client-side errors

Configuration:
- @sentry/nextjs middleware
- Tunnel route at /monitoring (bypass ad-blockers)
- Source maps uploaded on build
- Session replay on errors (dev mode only)
```

---

## Caching Strategy

### React Cache (Per-Request)
```typescript
// /src/lib/candidate-reads.ts
export const getCandidateDetail = cache(
  async (candidateId: string) => {
    return prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { profile: true }
    });
  }
);
```

**Why:** Prevent N+1 queries within single request (e.g., multiple components fetching same candidate).

### Next.js Route Cache (ISR)
Programme listing pages revalidate every 1 hour:
```typescript
export const revalidate = 3600; // seconds
```

### No Browser/Edge Caching
- Candidate portal pages are personalized (no caching)
- API responses include `Cache-Control: no-store`
- Admin pages have `no-cache` headers

---

## Error Handling

### Business Logic Errors
```typescript
// /src/lib/enrolment.ts
export async function createEnrolment(candidateId, programmeId) {
  // Validation errors
  if (!candidate) throw new Error("Candidate not found");
  if (!programme) throw new Error("Programme not found");
  
  // Business rule errors
  if (candidate.status === CandidateAccountStatus.SUSPENDED) {
    throw new Error("Suspended candidates cannot enroll");
  }
  
  if (programme.status !== ProgrammeStatus.ACTIVE) {
    throw new Error("Programme is not open for enrollment");
  }
  
  // Proceed with enrolment
}
```

### Server Action Error Handling
```typescript
export async function enrollCandidateAction(programmeId: string) {
  try {
    const result = await createEnrolment(candidateId, programmeId);
    revalidatePath("/portal/dashboard");
    return { ok: true, enrolmentId: result.id };
  } catch (error) {
    if (error.message.includes("not found")) {
      return { ok: false, error: "Programme not found" };
    }
    if (error.message.includes("Suspended")) {
      return { ok: false, error: "Your account is suspended" };
    }
    // Log unexpected errors to Sentry
    captureException(error);
    return { ok: false, error: "An error occurred" };
  }
}
```

### UI Error Display
```typescript
// Client Component
export function EnrollButton({ programmeId }) {
  const [result, setPending] = startTransition(() => {
    enrollCandidateAction(programmeId).then(setPending);
  });
  
  if (result?.error) {
    return <div className="error">{result.error}</div>;
  }
  
  return <button onClick={...}>Enroll</button>;
}
```

---

## Type Safety

### End-to-End Type Inference
- Prisma generates types from schema
- Server Actions receive typed arguments
- Zod validates at boundaries
- TypeScript strict mode prevents type errors

```typescript
// Automatically typed from schema
const candidate: Prisma.CandidateGetPayload<{
  include: { profile: true }
}> = await getCandidateWithProfile(id);

// Zod validation
const input = registerSchema.parse(formData);
// input is now { email, password, firstName, lastName }

// Server Action argument types inferred
export async function submitQuizAction(data: {
  quizId: string;
  answers: Record<string, string>;
}) { ... }
```

---

## Summary: Request Path from Click to Database

```
User clicks "Submit Quiz"
  ↓
Client Component (quiz-screen.tsx)
  ↓
Server Action: submitQuizAttemptAction()
  ├─ Extract session from cookies (middleware)
  ├─ Validate permissions
  ├─ Parse & validate input (Zod)
  ↓
Business Logic: recordQuizAttempt(candidateId, quizId, answers)
  ├─ Fetch quiz definition
  ├─ Compare answers to quiz key
  ├─ Compute score
  ├─ Create QuizAttempt record
  ├─ Update LectureProgress if needed
  ├─ Record AuditEvent
  ├─ Trigger notification (async)
  ↓
Prisma Client (Generated)
  ├─ Execute INSERT QuizAttempt
  ├─ Execute UPDATE LectureProgress
  ├─ Execute INSERT AuditEvent
  ↓
PostgreSQL Database
  ├─ Validate constraints
  ├─ Persist data
  ├─ Return inserted IDs
  ↓
Response sent back
  ↓
Client updates UI
  ├─ Show score badge
  ├─ Show "Quiz Passed"
  ├─ Trigger success notification
```

This flow ensures type safety, permission checking, auditability, and data consistency at every level.
