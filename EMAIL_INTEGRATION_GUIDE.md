# Email Integration Guide — Wiring Up Email Triggers

This guide shows exactly where and how to integrate each email template with its business action.

## ✅ Already Implemented

### 1. account-welcome
**File**: `src/app/actions/candidate-auth.ts` (line ~198)
**Trigger**: After successful registration
**Status**: ✅ DONE

```typescript
await sendTransactionalEmailByTemplate(
  'account-welcome',
  result.candidate.email,
  {
    firstName: getFirstName(result.candidate.firstName),
    exploreProgrammesUrl: `${process.env.NEXTAUTH_URL}/programmes`,
    currentYear: new Date().getFullYear(),
  }
);
```

---

## 🔧 Ready to Integrate (5 templates created)

### 2. enrolment-confirmation
**File**: Enrolment transaction/payment confirmation logic
**Trigger**: After successful payment for programme enrolment
**Location**: Likely in `src/lib/enrolment-transaction.ts` or payment webhook handler
**Variables needed**:
```typescript
{
  firstName: getFirstName(candidate.firstName),
  programmeName: programme.title,
  tier: programme.tier, // e.g., "Foundation"
  duration: `${programme.weeks} weeks`,
  weeklyCommitment: programme.weeklyHoursLabel, // e.g., "5-7 hours"
  startDate: cohort?.startDate?.toLocaleDateString() || 'TBD',
  lectureCount: modules.reduce((sum, m) => sum + m.lectures.length, 0),
  portalUrl: `${process.env.NEXTAUTH_URL}/portal/programmes/${programme.id}`,
  supportEmail: EMAIL_CONFIG.supportEmail,
  currentYear: new Date().getFullYear(),
}
```

**Integration pattern**:
```typescript
// After enrolment status changes to ACTIVE and payment is confirmed
await sendTransactionalEmailByTemplate(
  'enrolment-confirmation',
  candidate.email,
  { /* variables above */ }
);
```

---

### 3. payment-received-enrolment
**File**: Payment webhook handler or confirmation logic
**Trigger**: Immediately after payment success
**Location**: `src/lib/payment-provider.ts` or webhook route
**Variables needed**:
```typescript
{
  firstName: getFirstName(candidate.firstName),
  programmeName: programme.title,
  amountPaid: (payment.amountMinor / 100).toFixed(2),
  paymentDate: payment.confirmedAt?.toLocaleDateString() || new Date().toLocaleDateString(),
  transactionId: payment.internalReference,
  paymentMethod: payment.provider, // "paystack", "flutterwave", "bank_transfer"
  tier: programme.tier,
  programmeAccessUrl: `${process.env.NEXTAUTH_URL}/portal/programmes/${programme.id}`,
  invoiceUrl: `${process.env.NEXTAUTH_URL}/invoices/${payment.id}`, // Generate invoice URL
  supportEmail: EMAIL_CONFIG.supportEmail,
  currentYear: new Date().getFullYear(),
}
```

**Integration pattern**:
```typescript
// After payment.status becomes CONFIRMED
await sendTransactionalEmailByTemplate(
  'payment-received-enrolment',
  candidate.email,
  { /* variables above */ }
);
```

---

### 4. exam-registration-confirmed
**File**: Exam payment webhook or registration confirmation
**Trigger**: After successful exam fee payment
**Location**: Likely in exam registration or payment handler
**Variables needed**:
```typescript
{
  firstName: getFirstName(candidate.firstName),
  programmeName: programme.title,
  tier: programme.tier,
  examDate: sitting.startedAt?.toLocaleDateString() || window.startDate?.toLocaleDateString() || 'TBD',
  examDuration: `${exam.durationMinutes} minutes`,
  admissionSlipUrl: `${process.env.NEXTAUTH_URL}/exams/${examRegistration.id}/admission-slip`,
  examRulesUrl: `${process.env.NEXTAUTH_URL}/exams/rules`, // Or exam-specific rules
  supportEmail: EMAIL_CONFIG.supportEmail,
  currentYear: new Date().getFullYear(),
}
```

**Integration pattern**:
```typescript
// After exam registration payment is confirmed
await sendTransactionalEmailByTemplate(
  'exam-registration-confirmed',
  candidate.email,
  { /* variables above */ }
);
```

---

## 📋 Remaining Templates (10 to implement)

These templates are created but need integration. Create them following the same pattern:

### High Priority (next batch)

#### 5. exam-results
**File**: Exam marking/results release
**Trigger**: When `releaseResults()` or similar action releases results
**Variables**: Subject, marks, grade, pass/fail status, certificate info
**Location**: `src/lib/exam-sitting-actions.ts` or results release endpoint

#### 6. certificate-issued
**File**: Certificate generation/issuance
**Trigger**: When `issueCertificate()` creates a certificate
**Variables**: Certificate ID, tier, grade, download URL, verification URL
**Location**: `src/lib/certificate-actions.ts`

#### 7. certificate-revoked
**File**: Certificate revocation
**Trigger**: When `revokeCertificate()` revokes a certificate
**Variables**: Certificate ID, revocation reason, appeal deadline
**Location**: `src/lib/certificate-actions.ts`

### Medium Priority

#### 8. profile-completion-reminder
**Trigger**: 24 hours after registration if profile not completed
**Type**: Cron job/scheduled task
**Logic**: Query candidates with `createdAt` 24h ago and `profile.completedAt IS NULL`

#### 9. exam-scheduled
**Trigger**: When exam date is scheduled for a candidate
**Location**: Exam scheduling endpoint

#### 10. staff-invitation
**Trigger**: When staff member is invited
**Location**: `src/lib/staff-auth-actions.ts` or invite endpoint

#### 11. admin-password-reset-request
**Trigger**: When staff requests password reset
**Location**: `src/lib/staff-auth.ts` password reset action

#### 12. exam-window-opened-candidate
**Trigger**: When exam window opens
**Type**: Cron job or manual trigger
**Logic**: Send to all eligible candidates for that exam/programme

#### 13. exam-window-opened-staff
**Trigger**: When exam window opens
**Type**: Manual or scheduled
**Logic**: Send to relevant staff (faculty, admin, coordinators)

### Low Priority

#### 14. re-engagement-reminder-3day
**Trigger**: 3 days after last activity
**Type**: Cron job
**Logic**: Query `LectureProgress.lastSeenAt < now() - 3 days` where programme not completed

#### 15. re-engagement-reminder-7day
**Trigger**: 7 days after last activity (if no engagement with 3-day email)
**Type**: Cron job
**Logic**: Similar to 3-day, but check `lastSeenAt < now() - 7 days`

#### 16. exam-submission-received-admin
**Trigger**: When candidate submits exam
**Location**: Exam submission handler
**Variables**: Candidate name, exam details, submission time, review/marking URLs

---

## Integration Pattern Template

For each email trigger, follow this pattern:

```typescript
import { sendTransactionalEmailByTemplate } from '@/lib/send-transactional-email';
import { getFirstName } from '@/lib/email-utils';
import { EMAIL_CONFIG } from '@/lib/email-config';

// After the business action (payment, enrolment, etc.) completes:
await sendTransactionalEmailByTemplate(
  'template-name',
  recipient.email,
  {
    firstName: getFirstName(recipient.firstName),
    // ... other variables
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: new Date().getFullYear(),
  }
);
```

---

## Error Handling Pattern

All `sendTransactionalEmailByTemplate` calls return `{ success: boolean; error?: string }`.

**Do NOT block the business action on email failure.** Email should be fire-and-forget with logging:

```typescript
const emailResult = await sendTransactionalEmailByTemplate(
  'template-name',
  recipient.email,
  { /* variables */ }
);

if (!emailResult.success) {
  console.error(`Failed to send email to ${recipient.email}:`, emailResult.error);
  // Email failures should NOT block the transaction
  // Log to Sentry or your error tracking system
}
```

---

## Testing Each Integration

1. **Create test data** matching the trigger condition
2. **Verify email sent** in `EmailLog` table
3. **Check recipient** receives email
4. **Validate variables** are correct in email body
5. **Test error cases** (bad email, SMTP failure, etc.)

---

## Checklist for Integrating a Template

- [ ] Template file created in `src/lib/email-templates/`
- [ ] Template added to registry in `src/lib/email-templates/index.ts`
- [ ] Integration point identified (which action/file)
- [ ] Variables prepared from database/current data
- [ ] sendTransactionalEmailByTemplate call added
- [ ] Error handling in place (log but don't block)
- [ ] Test data created to trigger the action
- [ ] Email received and verified correct
- [ ] EmailLog table shows successful entry
- [ ] Error cases tested (bad email, SMTP failure)

---

## Notes

- All timestamps should use `.toLocaleDateString()` or `.toISOString()`
- All names should use `getFirstName()` for personalization
- All support emails should come from `EMAIL_CONFIG.supportEmail`
- Emails should not block business operations—log failures and continue
- All variables must match the template's interface exactly
