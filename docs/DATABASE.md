# Database Schema — Lavelle Tech Platform

**Database:** PostgreSQL 14+  
**ORM:** Prisma 7.9.1  
**Models:** 67  
**Enums:** 39  
**Location:** `/prisma/schema.prisma`

---

## Core Entities

### Candidate (User Account)

```prisma
model Candidate {
  id                   String   @id @default(uuid())
  applicantNumber      Int      @unique
  applicantNumberYear  Int      // Year the number was issued
  email                String   @unique
  passwordHash         String   // bcryptjs hash (12 rounds)
  firstName            String
  lastName             String
  status               CandidateAccountStatus // ACTIVE, SUSPENDED
  
  // One-to-one relationships
  profile              CandidateProfile?
  
  // Enrollment, sessions, progress
  enrolments           Enrolment[]
  examRegistrations    ExamRegistration[]
  sessions             Session[] // Separate polymorphic table
  
  // Audit & notifications
  notifications        Notification[] // Link via candidateId
  auditEvents          AuditEvent[]   // Candidate-related actions
  supportRequests      SupportRequest[] // Candidate-raised tickets
  supportMessages      SupportMessage[] // Candidate replies
  
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}

enum CandidateAccountStatus {
  ACTIVE
  SUSPENDED      // Candidate cannot access portal
}
```

**Key Behavior:**
- Each candidate has unique `applicantNumber` (e.g., "LAV-2026-001")
- `applicantNumberYear` tracks the cohort year
- Status changes from ACTIVE → SUSPENDED revoke all sessions immediately
- Email is unique (cannot register twice)

### Staff (Admin Account)

```prisma
model Staff {
  id                String    @id @default(uuid())
  email             String    @unique
  firstName         String
  lastName          String
  role              StaffRole // SUPER_ADMIN, REGISTRAR, ACADEMIC_ADMIN, etc.
  status            StaffStatus // ACTIVE, INVITED, SUSPENDED, DEACTIVATED
  passwordHash      String?   // Null until password set
  
  // Permissions (granular, via separate table)
  permissions       StaffPermission[]
  
  // Sessions & authentication
  sessions          Session[]
  invitationTokens  StaffInvitationToken[]
  
  // Content authorship & actions
  programmes        Programme[] @relation("CreatedByStaff")
  lectures          Lecture[] @relation("AuthorStaff")
  exams             Exam[] @relation("CreatedByStaff")
  certificates      Certificate[] @relation("IssuedByStaff")
  certificateRevoked Certificate[] @relation("RevokedByStaff")
  
  // Support & marking
  supportRequests   SupportRequest[] @relation("AssignedStaff")
  supportMessages   SupportMessage[] @relation("AuthorStaff")
  marks             Mark[] @relation("MarkedByStaff")
  
  // Audit
  auditEventsBy     AuditEvent[] @relation("PerformedByStaff")
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([email], where: { status: { not: "DEACTIVATED" } })
}

enum StaffRole {
  SUPER_ADMIN
  REGISTRAR
  ACADEMIC_ADMIN
  FACULTY
  FINANCE
  SUPPORT
  READ_ONLY
  CONTENT_MANAGER
}

enum StaffStatus {
  ACTIVE
  INVITED          // Waiting for password set
  SUSPENDED        // Cannot login, sessions revoked
  DEACTIVATED      // Fully removed from staff list
}
```

### Staff Permissions (Granular)

```prisma
model StaffPermission {
  id       String     @id @default(uuid())
  staffId  String
  staff    Staff      @relation(fields: [staffId], references: [id], onDelete: Cascade)
  permission Permission @unique
  
  createdAt DateTime @default(now())
  
  @@unique([staffId, permission])
}

enum Permission {
  // Candidate management
  VIEW_CANDIDATES
  EDIT_CANDIDATE_DETAILS
  SUSPEND_CANDIDATES
  
  // Academic
  MANAGE_PROGRAMMES
  MANAGE_INTAKES_COHORTS
  MARK_SUBMISSIONS
  MODERATE_GRADES
  
  // Exams
  MANAGE_EXAMS
  
  // Analytics
  RESET_CANDIDATE_PROGRESS
  
  // Finance
  VIEW_FINANCE
  CONFIRM_PAYMENTS
  MANAGE_FINANCE
  
  // Credentials
  ISSUE_CERTIFICATES
  REVOKE_CERTIFICATES
  
  // Communication
  MANAGE_ANNOUNCEMENTS
  MANAGE_BLOG
  RESPOND_SUPPORT
  
  // Admin
  MANAGE_STAFF
  VIEW_AUDIT_LOG
}
```

**Important:** SUPER_ADMIN explicitly holds all 17 permissions as rows (not a bypass flag).

---

## Session Management

### Session (Polymorphic)

```prisma
model Session {
  id                     String   @id @default(uuid())
  
  // XOR: exactly one of candidateId or staffId
  candidateId            String?  @unique
  candidate              Candidate? @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  
  staffId                String?  @unique
  staff                  Staff? @relation(fields: [staffId], references: [id], onDelete: Cascade)
  
  // Session data
  tokenHash              String   // HMAC-SHA256 hash of random token
  expiresAt              DateTime // 24 hours from creation (never extended)
  
  createdAt              DateTime @default(now())
}
```

**Key Behavior:**
- Exactly one of `candidateId` or `staffId` is non-null (enforced via check constraint)
- `tokenHash` is hashed with session secret (never stored plain)
- 24-hour expiry from creation (no idle timeout or extension)
- Deleted immediately on logout, account suspension, or password change

---

## Authentication Tokens

### Email Verification (Registration)

```prisma
model EmailOtpChallenge {
  id            String   @id @default(uuid())
  email         String   @unique
  otpHash       String   // Bcrypt hash of 6-digit code
  isVerified    Boolean  @default(false)
  attempt       Int      @default(0) // Rate limiting
  expiresAt     DateTime // 5 minutes
  
  createdAt     DateTime @default(now())
}
```

### Email Verification Alternative (Link)

```prisma
model EmailVerificationToken {
  id            String   @id @default(uuid())
  email         String   @unique
  tokenHash     String   // HMAC-SHA256 hash
  isUsed        Boolean  @default(false)
  expiresAt     DateTime // 24 hours
  
  createdAt     DateTime @default(now())
}
```

### Password Reset

```prisma
model PasswordResetOtpChallenge {
  id            String   @id @default(uuid())
  candidateId   String
  candidate     Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  otpHash       String   // Bcrypt hash
  isUsed        Boolean  @default(false)
  expiresAt     DateTime // 15 minutes
  
  createdAt     DateTime @default(now())
}

model StaffPasswordResetOtpChallenge {
  id            String   @id @default(uuid())
  staffId       String
  staff         Staff @relation(fields: [staffId], references: [id], onDelete: Cascade)
  otpHash       String
  isUsed        Boolean  @default(false)
  expiresAt     DateTime
  
  createdAt     DateTime @default(now())
}
```

### Staff Invitation

```prisma
model StaffInvitationToken {
  id            String   @id @default(uuid())
  staffId       String
  staff         Staff @relation(fields: [staffId], references: [id], onDelete: Cascade)
  tokenHash     String   // HMAC-SHA256 hash
  isUsed        Boolean  @default(false)
  expiresAt     DateTime // 30 days
  
  createdAt     DateTime @default(now())
}
```

---

## Academic Content

### Programme (Course)

```prisma
model Programme {
  id                    String   @id @default(uuid())
  code                  String   @unique // e.g., "ELR-201", "LAV-FOUND-TEC-001-2026"
  title                 String
  summary               String   // Plain text description (staff-written)
  tier                  ProgrammeTier // FOUNDATION, SPECIALIST, ADVANCED_PRACTITIONER
  status                ProgrammeStatus // DRAFT, ACTIVE, ARCHIVED
  
  // Metadata
  categoryId            String
  category              ProgrammeCategory @relation(fields: [categoryId], references: [id])
  author                String? // Optional author name (e.g., "Dr. Jane Smith")
  
  // Content
  modules               Module[]
  exams                 Exam[]
  
  // Enrollment & results
  enrolments            Enrolment[]
  assessmentWeightings  AssessmentWeighting[]
  programmeResults      ProgrammeResult[]
  
  // Publishing & media
  isExamOnlyShell       Boolean @default(false) // True if exam-only (no learning content)
  heroAssetId           String?
  heroAsset             MediaAsset? @relation("ProgrammeHeroImage", fields: [heroAssetId], references: [id])
  
  coverVideoAssetId     String?
  coverVideoAsset       MediaAsset? @relation("ProgrammeCoverVideo", fields: [coverVideoAssetId], references: [id])
  
  // Audit
  createdByStaffId      String
  createdByStaff        Staff @relation("CreatedByStaff", fields: [createdByStaffId], references: [id])
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@index([status])
  @@index([tier])
}

enum ProgrammeTier {
  FOUNDATION
  SPECIALIST
  ADVANCED_PRACTITIONER
}

enum ProgrammeStatus {
  DRAFT      // In authoring
  ACTIVE     // Open for enrollment
  ARCHIVED   // No new enrollments
}
```

### Module (Weekly Unit)

```prisma
model Module {
  id              String   @id @default(uuid())
  programmeId     String
  programme       Programme @relation(fields: [programmeId], references: [id], onDelete: Cascade)
  
  weekNumber      Int      // 1-16 (or more)
  title           String   // e.g., "Week 1: Introduction"
  orderIndex      Int      // Explicit ordering (overrides weekNumber)
  status          ContentStatus // DRAFT, PUBLISHED, ARCHIVED
  
  // Content
  lectures        Lecture[]
  quizzes         Quiz[]
  
  // Progress tracking
  lectureProgresses LectureProgress[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([programmeId, weekNumber])
  @@index([programmeId, orderIndex])
}
```

### Lecture (Individual Content Unit)

```prisma
model Lecture {
  id                  String   @id @default(uuid())
  moduleId            String
  module              Module @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  
  title               String   // e.g., "Contract Fundamentals"
  mediaKind           LectureMediaKind // SLIDES, VIDEO
  narrationMode       NarrationMode   // NONE, PER_SLIDE, FULL_LECTURE
  orderIndex          Int
  
  // Media
  mediaAssetId        String?
  mediaAsset          MediaAsset? @relation("LectureMedia", fields: [mediaAssetId], references: [id])
  
  // Metadata
  durationSeconds     Int? // For video tracking
  author              String? // Faculty name
  
  // Content
  slides              Slide[]
  quizzes             Quiz[] @relation("RelatedQuiz")
  draftingExercise    Lecture? @relation("HasDrafting") // Self-reference for drafting lecture
  parentDrafting      Lecture? @relation("HasDrafting", fields: [parentLectureId], references: [id])
  parentLectureId     String?
  
  // Progress & submissions
  lectureProgresses   LectureProgress[]
  notes               LectureNote[]
  draftingSubmissions DraftingSubmission[]
  
  // Assessments
  marks               Mark[] @relation("MarkableLecture")
  rubrics             MarkRubric[]
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  @@index([moduleId])
}

enum LectureMediaKind {
  SLIDES
  VIDEO
}

enum NarrationMode {
  NONE           // No narration
  PER_SLIDE      // Narration per slide
  FULL_LECTURE   // Full lecture narration
}
```

### Slide (Lecture Slides)

```prisma
model Slide {
  id              String   @id @default(uuid())
  lectureId       String
  lecture         Lecture @relation(fields: [lectureId], references: [id], onDelete: Cascade)
  
  orderIndex      Int
  title           String
  content         String  // Rich text markup (not HTML)
  
  // Per-slide narration
  narrationAssetId String?
  narrationAsset  MediaAsset? @relation("SlideNarration", fields: [narrationAssetId], references: [id])
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([lectureId])
}
```

---

## Learning Progress

### Lecture Progress

```prisma
model LectureProgress {
  id                    String   @id @default(uuid())
  enrolmentId           String
  enrolment             Enrolment @relation(fields: [enrolmentId], references: [id], onDelete: Cascade)
  lectureId             String
  lecture               Lecture @relation(fields: [lectureId], references: [id], onDelete: Cascade)
  
  // Progress state
  state                 LectureState // NOT_STARTED, IN_PROGRESS, COMPLETED
  
  // Step tracking
  stepsCompleted        Int @default(0) // E.g., 4 out of 5 steps done
  
  // Video tracking
  maxVideoPosition      Int? // Seconds (for resuming)
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@unique([enrolmentId, lectureId])
}

enum LectureState {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
}
```

### Video Watch Progress

```prisma
model VideoWatchProgress {
  id              String @id @default(uuid())
  enrolmentId     String
  lectureId       String
  
  maxPositionSeconds Int  // Farthest point reached
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([enrolmentId, lectureId])
}
```

### Lecture Notes (Candidate Private)

```prisma
model LectureNote {
  id              String   @id @default(uuid())
  candidateId     String
  candidate       Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  lectureId       String
  lecture         Lecture @relation(fields: [lectureId], references: [id], onDelete: Cascade)
  
  content         String  // Candidate's private notes (rich text)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([candidateId, lectureId])
}
```

---

## Assessments

### Drafting (Written Exercise)

```prisma
model DraftingSubmission {
  id                String   @id @default(uuid())
  candidateId       String
  candidate         Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  lectureId         String
  lecture           Lecture @relation(fields: [lectureId], references: [id], onDelete: Cascade)
  
  // Submission state machine
  state             SubmissionState // DRAFT, SUBMITTED, RETURNED, RESUBMITTED
  
  // Content
  draftContent      String  // Rich text
  
  // Timeline
  submittedAt       DateTime?
  returnedAt        DateTime?
  resubmittedAt     DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([candidateId, lectureId])
}

enum SubmissionState {
  DRAFT         // Not submitted yet
  SUBMITTED     // Awaiting marking
  RETURNED      // Marked and returned for revision
  RESUBMITTED   // Resubmitted after feedback
}
```

### Marking (Faculty Assessment)

```prisma
model Mark {
  id                String   @id @default(uuid())
  lectureId         String
  lecture           Lecture @relation("MarkableLecture", fields: [lectureId], references: [id], onDelete: Cascade)
  
  // Polymorphic: which type of submission?
  markableKind      MarkableKind // DRAFTING, EXAMINATION_WRITTEN
  markableId        String   // DraftingSubmission.id or ExaminationAnswer.id
  
  candidateId       String
  candidate         Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  
  // Grading
  markedByStaffId   String
  markedByStaff     Staff @relation("MarkedByStaff", fields: [markedByStaffId], references: [id])
  
  rawScore          Int      // 0-100
  state             MarkState // AWAITING, IN_REVIEW, RETURNED, RESUBMISSION_REQUESTED
  feedback          String?  // Faculty feedback (rich text)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([candidateId, lectureId])
}

enum MarkableKind {
  DRAFTING
  EXAMINATION_WRITTEN
}

enum MarkState {
  AWAITING               // Not yet marked
  IN_REVIEW              // Faculty reviewing
  RETURNED               // Marked and feedback given
  RESUBMISSION_REQUESTED // Faculty requested resubmission
}
```

### Quiz (Formative Assessment, Not Exam)

```prisma
model Quiz {
  id          String   @id @default(uuid())
  moduleId    String
  module      Module @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  lectureId   String
  lecture     Lecture @relation("RelatedQuiz", fields: [lectureId], references: [id], onDelete: Cascade)
  
  orderIndex  Int
  title       String   // e.g., "Module 1 Knowledge Check"
  
  // Questions
  questions   QuizQuestion[]
  
  // Attempts
  attempts    QuizAttempt[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model QuizQuestion {
  id              String   @id @default(uuid())
  quizId          String
  quiz            Quiz @relation(fields: [quizId], references: [id], onDelete: Cascade)
  
  orderIndex      Int
  text            String   // Question text
  questionType    String   // "multiple_choice" (extensible for future types)
  
  // MCQ options
  options         QuizOption[]
  
  // Correct answer
  correctOptionId String?
  correctOption   QuizOption? @relation("CorrectAnswer", fields: [correctOptionId], references: [id])
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([quizId])
}

model QuizOption {
  id                    String   @id @default(uuid())
  questionId            String
  question              QuizQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  
  orderIndex            Int
  text                  String   // Option text
  
  // Backreference from correct answer
  isCorrectFor          QuizQuestion? @relation("CorrectAnswer")
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model QuizAttempt {
  id          String   @id @default(uuid())
  quizId      String
  quiz        Quiz @relation(fields: [quizId], references: [id], onDelete: Cascade)
  
  candidateId String
  candidate   Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  
  // Results
  score       Int      // Percentage (0-100)
  passed      Boolean  // true if score >= 70%
  
  // Submission
  answers     QuizAnswer[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([candidateId])
}

model QuizAnswer {
  id              String   @id @default(uuid())
  attemptId       String
  attempt         QuizAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  
  questionId      String
  question        QuizQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  
  selectedOptionId String?
  selectedOption  QuizOption? @relation(fields: [selectedOptionId], references: [id])
  
  isCorrect       Boolean
  
  createdAt       DateTime @default(now())
}
```

---

## Enrollment & Intake

### Intake (Enrollment Period)

```prisma
model Intake {
  id              String   @id @default(uuid())
  month           IntakeMonth // JANUARY, APRIL, SEPTEMBER
  year            Int      // E.g., 2026
  status          IntakeStatus // OPEN, IN_PROGRESS, CLOSED
  
  cohorts         Cohort[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([month, year])
}

enum IntakeMonth {
  JANUARY
  APRIL
  SEPTEMBER
}

enum IntakeStatus {
  OPEN       // Enrollment window open
  IN_PROGRESS // Students learning
  CLOSED     // No new enrollments
}
```

### Cohort (Candidate Group)

```prisma
model Cohort {
  id              String   @id @default(uuid())
  intakeId        String
  intake          Intake @relation(fields: [intakeId], references: [id], onDelete: Cascade)
  
  programmeId     String
  programme       Programme @relation(fields: [programmeId], references: [id], onDelete: Cascade)
  
  enrolments      Enrolment[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([intakeId, programmeId])
}
```

### Enrollment

```prisma
model Enrolment {
  id                    String   @id @default(uuid())
  candidateId           String
  candidate             Candidate @relation(fields: [candidateId], references: [id], onDelete: Restrict)
  
  programmeId           String
  programme             Programme @relation(fields: [programmeId], references: [id], onDelete: Restrict)
  
  cohortId              String
  cohort                Cohort @relation(fields: [cohortId], references: [id], onDelete: Restrict)
  
  // Payment & lifecycle
  status                EnrolmentStatus // PENDING_PAYMENT, ACTIVE, COMPLETED, WITHDRAWN, REFUNDED
  feeMinor              Int      // Fee in minor units (cents, pence, kobo)
  
  // Progress tracking
  lectureProgresses     LectureProgress[]
  draftingSubmissions   DraftingSubmission[]
  quizAttempts          QuizAttempt[]
  
  // Deadlines (computed from this enrollment)
  deadlines             Deadline[]
  
  // Results
  programmeResult       ProgrammeResult?
  
  // Credentials
  certificates          Certificate[]
  idCard                IdCard?
  
  // Payment
  payments              Payment[]
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@unique([candidateId, programmeId])
}

enum EnrolmentStatus {
  PENDING_PAYMENT
  ACTIVE
  COMPLETED
  WITHDRAWN
  REFUNDED
}
```

---

## Exams

### Exam (Certifying Assessment)

```prisma
model Exam {
  id                      String   @id @default(uuid())
  title                   String   // e.g., "Energy Law & Regulation Final Exam"
  
  // Certification
  requiresProgrammeCompletion Boolean @default(true)
  prerequisiteTier        ProgrammeTier?
  
  // Exam lifecycle
  status                  ExamStatus // DRAFT, PUBLISHED, CLOSED, ARCHIVED
  attemptPolicy           AttemptPolicy // ONE_ATTEMPT, TWO_ATTEMPTS, ONE_RESIT_ON_REFERRAL
  allowReviewBeforeSubmit Boolean @default(false)
  
  // Windows (sittings)
  windows                 ExamWindow[]
  
  // Content
  questions               ExamQuestion[]
  requirements            ExamRequirement[]
  
  // Registrations & sittings
  registrations           ExamRegistration[]
  sittings                Sitting[]
  
  // Staff access
  staffAccess             ExamStaffAssignment[]
  
  // Audit
  createdByStaffId        String
  createdByStaff          Staff @relation("CreatedByStaff", fields: [createdByStaffId], references: [id])
  
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  
  @@index([status])
}

enum ExamStatus {
  DRAFT
  PUBLISHED
  CLOSED     // No new registrations
  ARCHIVED   // Historical record only
}

enum AttemptPolicy {
  ONE_ATTEMPT
  TWO_ATTEMPTS
  ONE_RESIT_ON_REFERRAL
}
```

### Exam Question Bank

```prisma
model ExamQuestion {
  id                String   @id @default(uuid())
  examId            String
  exam              Exam @relation(fields: [examId], references: [id], onDelete: Cascade)
  
  type              ExamQuestionType // OBJECTIVE, WRITTEN
  status            ExamQuestionStatus // DRAFT, IN_REVIEW, APPROVED, RETIRED
  
  text              String   // Question text
  marks             Int      // Points for this question
  
  // Objective question options
  options           ExamQuestionOption[]
  
  // Correct answer (for objective)
  correctOptionId   String?
  correctOption     ExamQuestionOption? @relation("CorrectAnswer", fields: [correctOptionId], references: [id])
  
  // Sitting usage
  sittingAnswers    SittingAnswer[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([examId, status])
}

enum ExamQuestionType {
  OBJECTIVE  // Multiple choice
  WRITTEN    // Short/long answer
}

enum ExamQuestionStatus {
  DRAFT
  IN_REVIEW
  APPROVED
  RETIRED    // Not used in new sittings
}

model ExamQuestionOption {
  id                    String   @id @default(uuid())
  questionId            String
  question              ExamQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  
  orderIndex            Int
  text                  String
  
  isCorrectFor          ExamQuestion? @relation("CorrectAnswer")
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model ExamRequirement {
  id              String   @id @default(uuid())
  examId          String
  exam            Exam @relation(fields: [examId], references: [id], onDelete: Cascade)
  
  text            String   // Display text
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Exam Windows (Sittings Schedule)

```prisma
model ExamWindow {
  id              String   @id @default(uuid())
  examId          String
  exam            Exam @relation(fields: [examId], references: [id], onDelete: Cascade)
  
  // Sitting period
  startsAt        DateTime // Exam window open date
  endsAt          DateTime // Exam window close date (+ 24 hours for late registrations usually)
  
  // Capacity
  capacity        Int      // Max candidates
  registeredCount Int @default(0) // Current registrations
  
  // Registrations
  registrations   ExamRegistration[]
  sittings        Sitting[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([examId, startsAt])
}
```

### Exam Registration

```prisma
model ExamRegistration {
  id                String   @id @default(uuid())
  windowId          String
  window            ExamWindow @relation(fields: [windowId], references: [id], onDelete: Cascade)
  
  examId            String
  exam              Exam @relation(fields: [examId], references: [id], onDelete: Cascade)
  
  candidateId       String
  candidate         Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  
  // Enrollment context
  enrolmentId       String?
  enrolment         Enrolment? @relation(fields: [enrolmentId], references: [id])
  
  // Pathway type
  pathway           CredentialPathway // PATHWAY (course-linked) or EXAMINATION_ONLY
  
  // Sitting
  sitting           Sitting?
  
  registeredAt      DateTime @default(now())
  
  @@unique([candidateId, windowId])
}

enum CredentialPathway {
  PATHWAY         // Part of a course programme
  EXAMINATION_ONLY // Standalone exam (no course prerequisite)
}
```

### Sitting (Exam Attempt)

```prisma
model Sitting {
  id                        String   @id @default(uuid())
  windowId                  String
  window                    ExamWindow @relation(fields: [windowId], references: [id], onDelete: Cascade)
  
  registrationId            String @unique
  registration              ExamRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  
  examId                    String
  exam                      Exam @relation(fields: [examId], references: [id], onDelete: Restrict)
  
  candidateId               String
  candidate                 Candidate @relation(fields: [candidateId], references: [id], onDelete: Restrict)
  
  // Attempt tracking
  attemptNumber             Int      // 1st or 2nd attempt (if policy allows)
  
  // Lifecycle
  state                     SittingState // REGISTERED, IN_PROGRESS, SUBMITTED, etc.
  
  // Proctor monitoring
  proctoringEvents          ProctoringEvent[]
  proctoringValidated       Boolean @default(false)
  proctoringNotes           String?
  
  // Submission
  startedAt                 DateTime?
  submittedAt               DateTime?
  
  // Answers & grading
  answers                   SittingAnswer[]
  finalScore                Int? // 0-100 (computed after marking)
  outcome                   ExamOutcome? // PASS or REFER
  
  // Review
  conductReview             ConductReview @default(PENDING) // PENDING, CLEARED, REFERRED
  
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
  
  @@index([candidateId, examId])
}

enum SittingState {
  REGISTERED       // Created, not started
  IN_PROGRESS      // Sitting active
  SUBMITTED        // Candidate submitted
  FORFEITED        // Did not show up
  EXPIRED          // Deadline passed
  MARKED           // Grades recorded
  RELEASED         // Results visible to candidate
}

enum ExamOutcome {
  PASS
  REFER            // Failed, may resit
}

enum ConductReview {
  PENDING          // Not yet reviewed
  CLEARED          // No conduct issues
  REFERRED         // Conduct violation noted
}
```

### Sitting Answers

```prisma
model SittingAnswer {
  id                String   @id @default(uuid())
  sittingId         String
  sitting           Sitting @relation(fields: [sittingId], references: [id], onDelete: Cascade)
  
  questionId        String
  question          ExamQuestion @relation(fields: [questionId], references: [id], onDelete: Restrict)
  
  // Response
  selectedOptionId  String? // For objective questions
  selectedOption    ExamQuestionOption? @relation(fields: [selectedOptionId], references: [id])
  
  writtenAnswer     String? // For written questions
  
  // Candidate actions
  flagged           Boolean @default(false) // Candidate flagged for review
  markedByCandidate Boolean @default(false) // Candidate clicked "marked"
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([sittingId, questionId])
}
```

### Proctoring Events (Invigilation Audit Log)

```prisma
model ProctoringEvent {
  id                String   @id @default(uuid())
  sittingId         String
  sitting           Sitting @relation(fields: [sittingId], references: [id], onDelete: Cascade)
  
  eventType         String // "tab_blur", "fullscreen_exit", "reconnect", "paste_blocked", etc.
  severity          String // "warning", "critical"
  timestamp         DateTime
  
  metadata          Json?  // Additional event data
  
  createdAt         DateTime @default(now())
  
  @@index([sittingId, timestamp])
}
```

### Exam Staff Assignment

```prisma
model ExamStaffAssignment {
  id                String   @id @default(uuid())
  examId            String
  exam              Exam @relation(fields: [examId], references: [id], onDelete: Cascade)
  
  staffId           String
  staff             Staff @relation(fields: [staffId], references: [id], onDelete: Cascade)
  
  role              String // "invigilator", "grader", "moderator"
  
  createdAt         DateTime @default(now())
  
  @@unique([examId, staffId])
}
```

---

## Certificates & Credentials

### Certificate

```prisma
model Certificate {
  id                    String   @id @default(uuid())
  certificateNumber     String   @unique // Permanent identifier (e.g., "LAV-2026-CERT-001")
  
  candidateId           String
  candidate             Candidate @relation(fields: [candidateId], references: [id], onDelete: Restrict)
  
  enrolmentId           String
  enrolment             Enrolment @relation(fields: [enrolmentId], references: [id], onDelete: Restrict)
  
  sittingId             String? // If exam-based
  sitting               Sitting? @relation(fields: [sittingId], references: [id])
  
  // Certification
  pathway               CredentialPathway // PATHWAY or EXAMINATION_ONLY
  templateVersion       Int      // Certificate template version
  
  // Lifecycle
  status                CertificateStatus // ACTIVE, REVOKED, SUPERSEDED
  issuedByStaffId       String
  issuedByStaff         Staff @relation("IssuedByStaff", fields: [issuedByStaffId], references: [id])
  issuedAt              DateTime
  
  revokedByStaffId      String?
  revokedByStaff        Staff? @relation("RevokedByStaff", fields: [revokedByStaffId], references: [id])
  revocationReason      String?
  revokedAt             DateTime?
  
  supersededByCertificateId String?
  supersededByCertificate Certificate? @relation("Superseded", fields: [supersededByCertificateId], references: [id])
  supersedes            Certificate? @relation("Superseded")
  
  // Public verification
  verificationLookups   VerificationLookup[]
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@index([candidateId, issuedAt])
  @@index([status])
}

enum CertificateStatus {
  ACTIVE
  REVOKED      // Certificate pulled (compliance)
  SUPERSEDED   // Replaced by newer certificate
}
```

### Certificate Template

```prisma
model CertificateTemplate {
  id                String   @id @default(uuid())
  version           Int      @default(1)
  
  // Template design
  designJson        String   // Template artwork + field overlays
  heroAssetId       String?
  heroAsset         MediaAsset? @relation(fields: [heroAssetId], references: [id])
  
  // Versioning
  isActive          Boolean  @default(true)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([version])
}
```

### Verification Lookup (Public Verification)

```prisma
model VerificationLookup {
  id                String   @id @default(uuid())
  certificateId     String
  certificate       Certificate @relation(fields: [certificateId], references: [id], onDelete: Cascade)
  
  hashedIp          String   // SHA256 hash of visitor IP (privacy)
  
  createdAt         DateTime @default(now())
  
  @@index([certificateId])
}
```

### ID Card (Issued on Payment)

```prisma
model IdCard {
  id                String   @id @default(uuid())
  enrolmentId       String @unique
  enrolment         Enrolment @relation(fields: [enrolmentId], references: [id], onDelete: Cascade)
  
  cardNumber        String   // Physical ID number
  
  issuedAt          DateTime @default(now())
  validUntil        DateTime // Expiry date
  
  createdAt         DateTime @default(now())
}
```

---

## Payments & Finance

### Payment

```prisma
model Payment {
  id                    String   @id @default(uuid())
  enrolmentId           String
  enrolment             Enrolment @relation(fields: [enrolmentId], references: [id], onDelete: Cascade)
  
  // Provider & method
  provider              String   // "nomba", "paystack", "offline"
  providerTransactionId String?  // Nomba/Paystack transaction ID
  
  offlineMode           OfflinePaymentMode? // Bank transfer, cash, POS, cheque
  
  // Amount
  amount                Int      // Minor units (cents, kobo, pence)
  currency              String   @default("NGN")
  
  // Status
  status                PaymentStatus // PENDING, SUCCESS, FAILED, REFUNDED
  purpose               PaymentPurpose // PROGRAMME_FEE, EXAMINATION_FEE
  
  // Metadata
  notes                 String?
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@index([enrolmentId])
  @@index([status])
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
  REFUNDED
}

enum PaymentPurpose {
  PROGRAMME_FEE
  EXAMINATION_FEE
}

enum OfflinePaymentMode {
  BANK_TRANSFER
  CASH_DEPOSIT
  POS_TERMINAL
  CHEQUE
}

model OfflinePaymentMode {
  id        String @id @default(uuid())
  paymentId String @unique
  mode      OfflinePaymentMode
  recordedBy String // Staff email
  
  createdAt DateTime @default(now())
}
```

### Webhook Events (Idempotent Handling)

```prisma
model WebhookEvent {
  id                String   @id @default(uuid())
  provider          String   // "nomba", "paystack"
  externalEventId   String   // Provider's event ID
  eventType         String   // "payment_success", "transfer_complete"
  
  payload           Json     // Full webhook body
  
  processed         Boolean  @default(false)
  processedAt       DateTime?
  
  createdAt         DateTime @default(now())
  
  @@unique([provider, externalEventId])
}
```

### Guest Checkout (Pre-Registration Payment)

```prisma
model GuestCheckout {
  id                String   @id @default(uuid())
  email             String
  
  programmeId       String
  programme         Programme @relation(fields: [programmeId], references: [id], onDelete: Cascade)
  
  status            GuestCheckoutStatus // PENDING, CONSUMED
  
  // After payment, guest registers → checkoutId linked to enrolment
  consumedAt        DateTime?
  consumedByEmail   String?
  
  createdAt         DateTime @default(now())
  expiresAt         DateTime // 24 hour token expiry
}

enum GuestCheckoutStatus {
  PENDING
  CONSUMED   // Guest registered and consumed
}
```

---

## Grading & Results

### Assessment Weighting

```prisma
model AssessmentWeighting {
  id                String   @id @default(uuid())
  programmeId       String
  programme         Programme @relation(fields: [programmeId], references: [id], onDelete: Cascade)
  
  kind              AssessmentKind // QUIZ, DRAFTING, EXAMINATION
  weightPercent     Int      // E.g., 40
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([programmeId, kind])
}

enum AssessmentKind {
  QUIZ
  DRAFTING
  EXAMINATION
}
```

### Grade Bands (Grade Scale)

```prisma
model GradeBandDefinition {
  id                String   @id @default(uuid())
  version           Int      // Supports time-based versions
  
  // Grade scale
  distinctionMin    Int      // E.g., 80
  meritMin          Int      // E.g., 70
  passMin           Int      // E.g., 60
  
  createdAt         DateTime @default(now())
  activatedAt       DateTime @default(now())
  deactivatedAt     DateTime?
  
  @@unique([version])
}
```

### Programme Result (Final Mark)

```prisma
model ProgrammeResult {
  id                        String   @id @default(uuid())
  enrolmentId               String @unique
  enrolment                 Enrolment @relation(fields: [enrolmentId], references: [id], onDelete: Cascade)
  
  // Computed marks
  quizMarkPercent           Int? // Average across quizzes
  draftingMarkPercent       Int? // Average across drafting
  examinationMarkPercent    Int? // Exam result (if taken)
  
  // Weighted final mark
  finalMark                 Int  // Percentage 0-100
  
  // Snapshot of rules at issuance
  assessmentWeightingSnapshot String // JSON snapshot
  gradeBandVersionSnapshot    Int    // Grade band version used
  
  // Grade band
  gradeBand                 GradeBand // DISTINCTION, MERIT, PASS, REFER
  
  // Issuing
  issuedAt                  DateTime
  issuedByStaffId           String
  issuedByStaff             Staff @relation(fields: [issuedByStaffId], references: [id])
  
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
  
  @@index([enrolmentId])
}

enum GradeBand {
  DISTINCTION
  MERIT
  PASS
  REFER
}
```

### Mark Rubric (Scoring Criteria)

```prisma
model MarkRubric {
  id                String   @id @default(uuid())
  lectureId         String
  lecture           Lecture @relation(fields: [lectureId], references: [id], onDelete: Cascade)
  
  title             String
  maxMarks          Int      // E.g., 50 points
  
  criteria          MarkRubricCriterion[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model MarkRubricCriterion {
  id                String   @id @default(uuid())
  rubricId          String
  rubric            MarkRubric @relation(fields: [rubricId], references: [id], onDelete: Cascade)
  
  orderIndex        Int
  description       String   // Criterion description
  marks             Int      // Points for this criterion
  
  createdAt         DateTime @default(now())
}
```

---

## Deadlines

### Deadline (Computed Progress Tracking)

```prisma
model Deadline {
  id                String   @id @default(uuid())
  enrolmentId       String
  enrolment         Enrolment @relation(fields: [enrolmentId], references: [id], onDelete: Cascade)
  
  kind              DeadlineKind // LECTURE_RELEASE, DRAFTING_DUE, QUIZ_DUE, EXAMINATION
  referenceId       String   // Lecture ID, etc.
  
  dueAt             DateTime // Actual deadline
  
  // State (computed on read, never stored)
  // overrideState   (if suspensions apply)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([enrolmentId, kind, referenceId])
}

enum DeadlineKind {
  LECTURE_RELEASE
  DRAFTING_DUE
  QUIZ_DUE
  EXAMINATION
}
```

---

## Support & Communication

### Support Request (Support Desk)

```prisma
model SupportRequest {
  id                    String   @id @default(uuid())
  referenceCode         String   @unique // User-facing ticket number
  
  // Requester (one of: candidate or anonymous from marketing)
  candidateId           String?
  candidate             Candidate? @relation(fields: [candidateId], references: [id], onDelete: SetNull)
  
  isAnonymous           Boolean @default(false)
  
  // Category & status
  category              RequestCategory // ENROLMENT, PAYMENT, TECHNICAL, etc.
  status                RequestStatus // OPEN, IN_PROGRESS, RESOLVED
  priority              RequestPriority // LOW, NORMAL, URGENT
  
  // Assignment
  assignedToStaffId     String?
  assignedToStaff       Staff? @relation("AssignedStaff", fields: [assignedToStaffId], references: [id], onDelete: SetNull)
  
  // Two-key rule: both staff must agree on resolution
  resolutionStaff1Id    String?
  resolutionStaff1      Staff? @relation("ResolutionStaff1", fields: [resolutionStaff1Id], references: [id], onDelete: SetNull)
  
  resolutionStaff2Id    String?
  resolutionStaff2      Staff? @relation("ResolutionStaff2", fields: [resolutionStaff2Id], references: [id], onDelete: SetNull)
  
  // Messages
  messages              SupportMessage[]
  
  // Internal notes (never visible to candidate)
  internalNotes         CandidateNote[]
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  resolvedAt            DateTime?
  
  @@index([candidateId])
  @@index([status, assignedToStaffId])
}

enum RequestCategory {
  ENROLMENT
  PAYMENT
  TECHNICAL
  PROGRAMME
  ENQUIRY
  OTHER
}

enum RequestStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
}

enum RequestPriority {
  LOW
  NORMAL
  URGENT
}

model SupportMessage {
  id                String   @id @default(uuid())
  supportRequestId  String
  supportRequest    SupportRequest @relation(fields: [supportRequestId], references: [id], onDelete: Cascade)
  
  // Author (one of: staff or candidate)
  authorStaffId     String?
  authorStaff       Staff? @relation("AuthorStaff", fields: [authorStaffId], references: [id], onDelete: SetNull)
  
  authorCandidateId String?
  authorCandidate   Candidate? @relation(fields: [authorCandidateId], references: [id], onDelete: SetNull)
  
  // Message
  body              String
  
  createdAt         DateTime @default(now())
  
  @@index([supportRequestId])
}

model CandidateNote {
  id                String   @id @default(uuid())
  supportRequestId  String
  supportRequest    SupportRequest @relation(fields: [supportRequestId], references: [id], onDelete: Cascade)
  
  // Internal-only (never shown to candidate)
  content           String
  createdByStaffId  String
  createdByStaff    Staff @relation(fields: [createdByStaffId], references: [id], onDelete: SetNull)
  
  createdAt         DateTime @default(now())
}
```

---

## Announcements & Notifications

### Announcement

```prisma
model Announcement {
  id                String   @id @default(uuid())
  
  title             String
  body              String   // Rich text markup
  
  state             AnnouncementState // DRAFT, SCHEDULED, SENT, WITHDRAWN
  scheduledFor      DateTime?
  sentAt            DateTime?
  
  // Audience
  targetCandidates  String[]  // JSON array: all, tier, programme, etc.
  targetStaff       String[]  // JSON array: roles or staff IDs
  
  // Channels
  channels          Channel[] // IN_APP, EMAIL, WHATSAPP, SMS
  
  // Delivery tracking
  deliveries        AnnouncementDelivery[]
  
  createdByStaffId  String
  createdByStaff    Staff @relation(fields: [createdByStaffId], references: [id])
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([state, scheduledFor])
}

enum AnnouncementState {
  DRAFT
  SCHEDULED
  SENT
  WITHDRAWN
}

enum Channel {
  IN_APP
  EMAIL
  WHATSAPP
  SMS
}

model AnnouncementDelivery {
  id                String   @id @default(uuid())
  announcementId    String
  announcement      Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  
  recipientId       String   // Candidate ID or Staff ID
  channel           Channel
  
  sentAt            DateTime?
  status            String   // "queued", "sent", "failed"
  
  createdAt         DateTime @default(now())
  
  @@unique([announcementId, recipientId, channel])
}
```

### Notification (Inbox Messages)

```prisma
model Notification {
  id                String   @id @default(uuid())
  
  // Recipient (one of: candidate or staff)
  candidateId       String?
  candidate         Candidate? @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  
  staffId           String?
  staff             Staff? @relation(fields: [staffId], references: [id], onDelete: Cascade)
  
  // Content
  title             String
  message           String
  category          NotificationCategory // ACCOUNT, CREDENTIAL, PROGRAMME, etc.
  
  // Metadata
  relatedId         String?  // Link to resource (programme ID, etc.)
  
  isRead            Boolean @default(false)
  readAt            DateTime?
  
  createdAt         DateTime @default(now())
  
  @@index([candidateId, isRead])
  @@index([staffId, isRead])
}

enum NotificationCategory {
  ACCOUNT
  CREDENTIAL
  PROGRAMME
  ASSESSMENT
  FINANCE
  SUPPORT
  ANNOUNCEMENT
  EXAMINATION
}
```

---

## Public Content

### ProgrammeListing (Marketing Site)

```prisma
model ProgrammeListing {
  id                String   @id @default(uuid())
  programmeId       String @unique
  programme         Programme @relation(fields: [programmeId], references: [id], onDelete: Cascade)
  
  // Marketing overrides (can differ from Programme)
  title             String
  blurb             String   // Short description for card
  heroAssetId       String?
  heroAsset         MediaAsset? @relation("ListingHeroImage", fields: [heroAssetId], references: [id])
  
  // Publication
  isPublished       Boolean @default(false)
  publishedAt       DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### Review (Student Testimonials)

```prisma
model Review {
  id                String   @id @default(uuid())
  
  candidateId       String
  candidate         Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  
  programmeId       String
  programme         Programme @relation(fields: [programmeId], references: [id], onDelete: Cascade)
  
  title             String
  body              String
  rating            Int      // 1-5 stars
  
  // Publication
  state             ReviewState // PENDING, PUBLISHED, DECLINED
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum ReviewState {
  PENDING
  PUBLISHED
  DECLINED
}
```

### Blog Post

```prisma
model BlogPost {
  id                String   @id @default(uuid())
  slug              String @unique
  
  title             String
  excerpt           String
  body              String   // Rich text markup (not HTML)
  
  authorName        String   // Byline
  tags              String[] // JSON array
  
  heroAssetId       String?
  heroAsset         MediaAsset? @relation("BlogPostHero", fields: [heroAssetId], references: [id])
  
  isPublished       Boolean @default(false)
  publishedAt       DateTime?
  publishedByStaffId String?
  publishedByStaff  Staff? @relation("BlogPostPublishedBy", fields: [publishedByStaffId], references: [id])
  
  unpublishedAt     DateTime?
  
  createdByStaffId  String
  createdByStaff    Staff @relation("BlogPostCreatedBy", fields: [createdByStaffId], references: [id])
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([isPublished, publishedAt])
}
```

### FAQ Entry

```prisma
model FaqEntry {
  id                String   @id @default(uuid())
  
  question          String
  answer            String   // Rich text
  
  orderIndex        Int      // Display order
  
  isPublished       Boolean @default(false)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### Programme Category

```prisma
model ProgrammeCategory {
  id                String   @id @default(uuid())
  name              String   // e.g., "Energy & Natural Resources"
  slug              String @unique
  
  programmes        Programme[]
  
  createdAt         DateTime @default(now())
}
```

---

## Media & Assets

### Media Asset

```prisma
model MediaAsset {
  id                String   @id @default(uuid())
  
  kind              String   // "image", "video", "audio", "document"
  mimeType          String   // "image/jpeg", "video/mp4", etc.
  
  // Cloudinary reference
  cloudinaryId      String?  // Cloudinary public_id
  cloudinaryUrl     String?  // Public serving URL
  
  // Local reference (fallback)
  localPath         String?
  
  // Metadata
  durationSeconds   Int?     // For audio/video
  width             Int?     // For images
  height            Int?     // For images
  fileSize          Int?     // In bytes
  
  // Uploader
  uploadedByStaffId String?
  uploadedByStaff   Staff? @relation(fields: [uploadedByStaffId], references: [id])
  
  createdAt         DateTime @default(now())
}
```

### Video Upload (Cloudinary Status Tracking)

```prisma
model VideoUpload {
  id                String   @id @default(uuid())
  mediaAssetId      String @unique
  mediaAsset        MediaAsset @relation(fields: [mediaAssetId], references: [id], onDelete: Cascade)
  
  cloudinaryJobId   String   // Cloudinary job ID for tracking
  processingStatus  String   // "pending", "processing", "completed", "failed"
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

---

## Audit & Monitoring

### Audit Event (Append-Only Log)

```prisma
model AuditEvent {
  id                String   @id @default(uuid())
  
  eventType         String   // "CANDIDATE_REGISTERED", "PAYMENT_RECEIVED", etc.
  
  // Actor
  performedByStaffId String?
  performedByStaff  Staff? @relation("PerformedByStaff", fields: [performedByStaffId], references: [id])
  
  // Subject
  targetCandidateId String?
  targetCandidate   Candidate? @relation(fields: [targetCandidateId], references: [id], onDelete: SetNull)
  
  targetProgrammeId String?
  targetProgramme   Programme? @relation(fields: [targetProgrammeId], references: [id], onDelete: SetNull)
  
  // Details
  details           Json?    // Event-specific data
  
  // Timestamp (never updated)
  createdAt         DateTime @default(now())
  
  // DB role: INSERT/SELECT only (no UPDATE/DELETE)
}
```

### Email Log (Delivery Tracking)

```prisma
model EmailLog {
  id                String   @id @default(uuid())
  
  recipient         String   // Email address
  template          String   // "verification_otp", "payment_received", etc.
  subject           String
  
  sentAt            DateTime @default(now())
  failedAt          DateTime?
  failureReason     String?
  
  createdAt         DateTime @default(now())
  
  @@index([recipient, sentAt])
}
```

### Rate Limiting

```prisma
model RateLimitAttempt {
  id                String   @id @default(uuid())
  
  key               String   // Email or IP address
  action            String   // "register", "sign_in", "password_reset"
  
  attemptCount      Int @default(1)
  lastAttemptAt     DateTime @default(now())
  
  windowStart       DateTime // Fixed 1-hour window
  
  @@unique([key, action, windowStart])
}
```

---

## Data Model Summary

**Total Models:** 67  
**Total Enums:** 39  
**Relationships:** ~100+ foreign keys and relations  
**Key Constraints:** Unique, check, partial unique indexes  

**Major Domains:**
- Authentication & Authorization (8 models)
- Users (3 core: Candidate, Staff, CandidateProfile)
- Academic Content (7 models: Programme, Module, Lecture, Slide, Quiz, etc.)
- Learning Progress (4 models: LectureProgress, VideoWatchProgress, Notes, Deadlines)
- Assessment (6 models: Marking, Grading, Rubrics, Results)
- Exams (9 models: Exam, Windows, Registration, Sitting, Questions, Proctoring)
- Certificates (3 models: Certificate, Template, Verification)
- Enrollment (5 models: Intake, Cohort, Enrollment, Guest Checkout, Payments)
- Support & Communication (6 models: Support Desk, Messages, Announcements, Notifications)
- Public Content (5 models: ProgrammeListing, Review, Blog, FAQ, Category)
- Media & Assets (3 models: MediaAsset, VideoUpload, Audit)
- Audit & Monitoring (4 models: AuditEvent, EmailLog, RateLimiting)

This schema represents a complete, production-ready legal education platform with sophisticated progress tracking, assessment management, examinations, and institutional operations.
