# API Reference — Lavelle Tech Platform

This document lists all API endpoints (Route Handlers) and Server Actions.

---

## Route Handlers (HTTP Endpoints)

### Authentication Activation

**GET /api/staff/activate**

Purpose: Activate staff account and set password (from invitation email link)

Parameters:
- `token` (query) - Staff invitation token

Response:
- Redirects to `/staff/set-password?token=xyz` if token valid
- 400 if token expired/invalid

---

### Payment Webhooks

**POST /api/webhooks/nomba**

Purpose: Nomba payment provider webhook handler

Authentication:
- `X-Nomba-Signature` header with HMAC-SHA256 signature

Request Body:
```json
{
  "transactionId": "txn_abc123",
  "customerId": "enrollmentId",
  "amount": 28000,
  "status": "successful",
  "timestamp": "2026-09-03T10:00:00Z"
}
```

Response: `{ "success": true }`

Behavior:
- Verifies HMAC-SHA256 signature
- Checks `WebhookEvent` table for idempotency (deduplication)
- Creates `Payment` row if successful
- Updates `Enrolment` to ACTIVE
- Issues `IdCard`
- Sends notification email (async)

---

**POST /api/webhooks/paystack**

Similar to Nomba (alternative payment provider).

---

**POST /api/webhooks/cloudinary**

Purpose: Cloudinary video upload completion notification

Request Body:
```json
{
  "event": "streaming_profile_created",
  "public_id": "lavelle/video-123",
  "duration": 3600,
  "secure_url": "https://cloudinary.com/..."
}
```

Response: `{ "success": true }`

Behavior:
- Creates/updates `MediaAsset` row
- Updates `VideoUpload` status to completed

---

### Exam Sittings

**POST /api/sitting/answer**

Purpose: Submit or autosave exam answer during sitting

Authentication: Candidate session required

Request Body:
```json
{
  "sittingId": "sitting-123",
  "questionId": "question-456",
  "selectedOptionId": "option-789",
  "writtenAnswer": "The answer is...",
  "isSubmitting": false
}
```

Response:
```json
{
  "success": true,
  "saved": true
}
```

Behavior:
- Creates/updates `SittingAnswer` row
- Validates sitting is IN_PROGRESS
- If `isSubmitting=true`, marks sitting as SUBMITTED

---

**POST /api/sitting/proctoring**

Purpose: Log proctoring events (tab switch, fullscreen exit, etc.)

Authentication: Candidate session required

Request Body:
```json
{
  "sittingId": "sitting-123",
  "eventType": "tab_blur",
  "severity": "warning"
}
```

Response: `{ "logged": true }`

Behavior:
- Creates `ProctoringEvent` row
- Records timestamp and event type
- Can flag conduct issues for review

---

### Certificates

**GET /api/certificates/[id]/pdf**

Purpose: Generate and serve certificate PDF

Parameters:
- `id` (path) - Certificate ID

Authentication: Public (no auth required)

Response: PDF file (binary)

Behavior:
- Fetches `Certificate` record
- Renders template with candidate name, date, grade
- Generates QR code linking to verification page
- Returns PDF blob

---

### Progress & Learning

**POST /api/progress/draft**

Purpose: Autosave drafting submission

Authentication: Candidate session required

Request Body:
```json
{
  "lectureId": "lecture-123",
  "content": "My draft response...",
  "autoSave": true
}
```

Response: `{ "saved": true, "at": "2026-09-03T10:00:00Z" }`

---

**POST /api/progress/position**

Purpose: Track video playback position

Authentication: Candidate session required

Request Body:
```json
{
  "lectureId": "lecture-123",
  "positionSeconds": 1234
}
```

Response: `{ "saved": true }`

Behavior:
- Updates `VideoWatchProgress.maxPositionSeconds`
- Used for resume playback and completion tracking

---

**POST /api/progress/notes**

Purpose: Save lecture notes

Authentication: Candidate session required

Request Body:
```json
{
  "lectureId": "lecture-123",
  "content": "Important points..."
}
```

Response: `{ "saved": true }`

Behavior:
- Creates/updates `LectureNote` row

---

### Uploads

**POST /api/uploads/sign**

Purpose: Generate presigned URL for direct file upload to Cloudinary

Authentication: Staff session required

Request Body:
```json
{
  "purpose": "blog",
  "fileName": "course-video.mp4"
}
```

Response:
```json
{
  "uploadUrl": "https://upload.cloudinary.com/...",
  "publicId": "lavelle/...",
  "uploadToken": "..."
}
```

Behavior:
- Verifies staff permission (based on `purpose`)
- Generates Cloudinary presigned upload token
- Returns direct upload endpoint

---

**POST /api/uploads/cloudinary**

Purpose: Cloudinary upload endpoint (receives directly from client)

Request: File multipart

Response: `{ "mediaId": "...", "publicUrl": "..." }`

---

### Admissions & Exam Papers

**GET /api/exam-registrations/[id]/admission-slip**

Purpose: Generate admission slip PDF

Parameters:
- `id` (path) - Exam registration ID

Authentication: Candidate session required

Response: PDF file

Behavior:
- Fetches exam window, sitting details
- Generates PDF with:
  - Candidate name & ID
  - Exam title and date
  - Sitting instructions
  - QR code for verification
  - Invigilator signature line

---

### Development/Testing

**POST /api/test/test-all-emails**

Purpose: Send all email templates for testing (dev only)

Authentication: Bearer token (dev credentials)

Response: `{ "sent": 12, "templates": [...] }`

---

### Cron Jobs (Scheduled Tasks)

**POST /api/cron/send-scheduled**

Purpose: Delivery sweep for scheduled announcements

Authentication: Bearer token (CRON_SECRET)

Behavior:
- Finds all announcements in SCHEDULED state past scheduledFor time
- Sends via all configured channels (in-app, email, WhatsApp, SMS)
- Creates `AnnouncementDelivery` records
- Updates announcement state to SENT
- Runs: Every minute (Vercel Cron)

Response: `{ "sent": 5 }`

---

**POST /api/cron/expire-sittings**

Purpose: Mark overdue exam sittings as EXPIRED

Authentication: Bearer token (CRON_SECRET)

Behavior:
- Finds all sittings still IN_PROGRESS past window end time
- Updates state to EXPIRED
- Records audit event
- Runs: Every hour (Vercel Cron)

Response: `{ "expired": 2 }`

---

## Server Actions

Server Actions are form handlers (not REST endpoints). Called via `async function` invocation.

### Candidate Authentication

**registerCandidate(formData)**
- Register new candidate
- Input validation via Zod
- Creates Candidate + sends OTP
- Returns: `{ ok: boolean, error?: string }`

**verifyEmailOtp(otp)**
- Verify email OTP
- Creates session on success
- Returns: `{ ok: boolean, redirectTo?: string }`

**signInCandidate(email, password)**
- Candidate sign-in
- Returns: `{ ok: boolean, redirectTo?: string }`

**signOutCandidate()**
- Revoke candidate session
- Returns: `{ ok: true }`

**resendVerificationEmail(email)**
- Send new OTP email
- Returns: `{ ok: boolean }`

**requestPasswordReset(email)**
- Initiate password reset
- Sends OTP via email
- Returns: `{ ok: boolean }`

**verifyPasswordResetOtp(otp)**
- Verify reset OTP
- Returns: `{ ok: boolean }`

**resetPassword(newPassword)**
- Set new password
- Revokes all sessions
- Returns: `{ ok: boolean }`

**updateCandidateProfile(profile)**
- Update profile (professional status, contact info)
- Returns: `{ ok: boolean, error?: string }`

---

### Staff Authentication

**staffSignIn(email, password)**
- Staff sign-in
- Returns: `{ ok: boolean, redirectTo?: string }`

**staffSignInViaOtp(email)**
- Request OTP for sign-in
- Returns: `{ ok: boolean }`

**verifyStaffLoginOtp(otp)**
- Verify and sign in via OTP
- Returns: `{ ok: boolean, redirectTo?: string }`

**setStaffPassword(token, password)**
- Set password during account activation
- Returns: `{ ok: boolean }`

**signOutStaff()**
- Revoke staff session
- Returns: `{ ok: true }`

**requestStaffPasswordReset(email)**
- Initiate staff password reset
- Returns: `{ ok: boolean }`

**verifyStaffPasswordResetOtp(otp)**
- Verify reset OTP
- Returns: `{ ok: boolean }`

**resetStaffPassword(newPassword)**
- Set new staff password
- Returns: `{ ok: boolean }`

**resendStaffInvitation(staffId)**
- Re-send activation email
- Returns: `{ ok: boolean }`

---

### Programme Management

**createProgramme(input)**
- Create new programme
- Input: `{ code, title, tier, categoryId }`
- Requires: `MANAGE_PROGRAMMES` permission
- Returns: `{ ok: boolean, programmeId?: string }`

**updateProgramme(id, input)**
- Update programme details
- Requires: `MANAGE_PROGRAMMES` permission
- Returns: `{ ok: boolean }`

**duplicateProgramme(id)**
- Clone programme (all content)
- Requires: `MANAGE_PROGRAMMES` permission
- Returns: `{ ok: boolean, newId?: string }`

**publishProgramme(id)**
- Publish programme (validates completeness)
- Requires: `MANAGE_PROGRAMMES` permission
- Returns: `{ ok: boolean, errors?: string[] }`

**archiveProgramme(id)**
- Archive programme (no new enrollments)
- Requires: `MANAGE_PROGRAMMES` permission
- Returns: `{ ok: boolean }`

---

### Learning & Submission

**completeStep(lectureId)**
- Mark step as complete in lecture
- Updates `LectureProgress`
- Returns: `{ ok: boolean, progress?: number }`

**submitDrafting(lectureId, content)**
- Submit drafting exercise
- Creates `DraftingSubmission` with state=SUBMITTED
- Returns: `{ ok: boolean }`

**submitQuizAttempt(quizId, answers)**
- Submit quiz answers
- Marks, scores, and records attempt
- Returns: `{ ok: boolean, score: number, passed: boolean }`

**recordVideoProgress(lectureId, position)**
- Track video playback
- Returns: `{ ok: boolean }`

---

### Exams

**createExam(input)**
- Create new exam
- Requires: `MANAGE_EXAMS` permission
- Returns: `{ ok: boolean, examId?: string }`

**createExamQuestion(examId, input)**
- Add question to exam
- Input: `{ type, text, marks, options[], correctOptionId }`
- Returns: `{ ok: boolean, questionId?: string }`

**updateExamQuestion(id, input)**
- Update exam question
- Returns: `{ ok: boolean }`

**publishExam(examId)**
- Publish exam (validates completeness)
- Validates: ≥5 questions, ≥50 total marks, all approved
- Returns: `{ ok: boolean, errors?: string[] }`

**closeExam(examId)**
- Close exam (no new registrations)
- Returns: `{ ok: boolean }`

**registerForExam(examId, windowId)**
- Candidate registers for exam
- Checks: payment complete, prerequisites met, capacity available
- Returns: `{ ok: boolean, registrationId?: string }`

**startSitting(registrationId)**
- Start exam sitting
- Updates state to IN_PROGRESS
- Returns: `{ ok: boolean, sittingId?: string }`

**submitSitting(sittingId)**
- Submit exam (candidate finished)
- Updates state to SUBMITTED
- Returns: `{ ok: boolean }`

---

### Marking & Grading

**submitMarkingDraft(lectureId, markableId, feedback, score)**
- Save draft marking
- Returns: `{ ok: boolean }`

**returnMark(markId)**
- Return mark to candidate (request resubmission)
- Updates Mark.state to RETURNED
- Notifies candidate
- Returns: `{ ok: boolean }`

**moderateMark(markId, newScore, feedback)**
- Moderate/override faculty mark
- Requires: `MODERATE_GRADES` permission
- Returns: `{ ok: boolean }`

---

### Certificates

**issueCertificate(enrolmentId, pathway)**
- Issue certificate to candidate
- Requires: `ISSUE_CERTIFICATES` permission
- Returns: `{ ok: boolean, certificateNumber?: string }`

**revokeCertificate(certificateId, reason)**
- Revoke certificate
- Creates superseded certificate record
- Requires: `REVOKE_CERTIFICATES` permission
- Returns: `{ ok: boolean }`

---

### Payments

**initiatePayment(enrolmentId)**
- Start payment flow
- Returns: `{ ok: boolean, redirectUrl?: string }`

**confirmPaymentManually(enrolmentId, paymentId)**
- Confirm offline payment (admin action)
- Returns: `{ ok: boolean }`

**recordOfflinePayment(enrolmentId, amount, mode, notes)**
- Record manual payment (bank transfer, cash, POS, cheque)
- Requires: `CONFIRM_PAYMENTS` permission
- Returns: `{ ok: boolean }`

**markEnrolmentRefunded(enrolmentId, reason)**
- Refund and cancel enrollment
- Returns: `{ ok: boolean }`

---

### Support Desk

**submitSupportRequest(category, message, contactInfo)**
- Create support ticket (candidate or anonymous)
- Returns: `{ ok: boolean, ticketNumber?: string }`

**assignSupportRequest(ticketId, staffId)**
- Assign ticket to staff
- Requires: `RESPOND_SUPPORT` permission
- Returns: `{ ok: boolean }`

**resolveSupportRequest(ticketId, notes)**
- Mark ticket resolved
- Requires: two-staff approval (not yet enforced)
- Returns: `{ ok: boolean }`

**replySupportMessage(ticketId, message)**
- Reply to support ticket
- Returns: `{ ok: boolean }`

---

### Admin & Staff

**inviteStaff(email, role, permissions)**
- Invite staff member
- Requires: `MANAGE_STAFF` permission
- Sends activation email
- Returns: `{ ok: boolean }`

**suspendCandidate(candidateId, reason)**
- Suspend candidate account
- Revokes sessions, blocks access
- Requires: `SUSPEND_CANDIDATES` permission
- Returns: `{ ok: boolean }`

**suspendStaff(staffId, reason)**
- Suspend staff account
- Requires: `MANAGE_STAFF` permission
- Returns: `{ ok: boolean }`

**reactivateCandidate(candidateId)**
- Reactivate suspended candidate
- Requires: `SUSPEND_CANDIDATES` permission
- Returns: `{ ok: boolean }`

**liftSuspension(staffId)**
- Reactivate suspended staff
- Requires: `MANAGE_STAFF` permission
- Returns: `{ ok: boolean }`

---

### Announcements

**createAnnouncement(title, body, channels, targetAudience)**
- Create announcement
- Requires: `MANAGE_ANNOUNCEMENTS` permission
- Returns: `{ ok: boolean, announcementId?: string }`

**scheduleAnnouncement(announcementId, scheduledFor)**
- Schedule announcement for future delivery
- Returns: `{ ok: boolean }`

**sendAnnouncement(announcementId)**
- Send announcement immediately
- Returns: `{ ok: boolean }`

**withdrawAnnouncement(announcementId)**
- Cancel scheduled announcement
- Returns: `{ ok: boolean }`

---

## Error Handling

All endpoints return standard error responses:

```json
{
  "ok": false,
  "error": "User not found"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad request (validation failure)
- `401` - Unauthorized (auth required)
- `403` - Forbidden (permission denied)
- `404` - Not found
- `409` - Conflict (e.g., email already registered)
- `500` - Server error

---

## Rate Limiting

All endpoints subject to rate limiting:
- Sign-up: 5 per email per hour
- Sign-in: 10 per email per hour
- Password reset: 5 per email per hour

Returns `429 Too Many Requests` when exceeded.

---

## Response Format

All responses are JSON (except PDF endpoints).

Success:
```json
{ "ok": true, "data": {...} }
```

Error:
```json
{ "ok": false, "error": "Human-readable error message" }
```
