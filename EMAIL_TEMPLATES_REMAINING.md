# Email Templates — Implementation Status

## ✅ Completed Templates (3)

1. **account-welcome** - Sent immediately after registration
2. **email-verification-otp** - Sent when OTP requested during registration  
3. **password-reset-request** - Sent when password reset requested

## ⏳ Remaining Templates to Implement (15)

Each template needs to be created in `src/lib/email-templates/` following this structure:

```typescript
import { renderTemplate } from '../email-utils';

export interface TemplateNameVariables {
  // List all variables needed
}

export function generateTemplateNameEmail(variables: TemplateNameVariables) {
  const htmlTemplate = `...html...`;
  const textTemplate = `...text...`;
  
  return {
    subject: 'Subject line here',
    html: renderTemplate(htmlTemplate, variables),
    text: renderTemplate(textTemplate, variables),
  };
}
```

Then add to `src/lib/email-templates/index.ts`:
- Import the function
- Add type to `EmailTemplateVariables` union
- Add to `emailTemplates` object

### Template List

| # | Template Name | File | Variables | Trigger | Priority |
|---|---|---|---|---|---|
| 4 | profile-completion-reminder | `profile-completion-reminder.ts` | firstName, completeProfileUrl, supportEmail, currentYear | 24h after registration if profile incomplete | Medium |
| 5 | enrolment-confirmation | `enrolment-confirmation.ts` | firstName, programmeName, tier, duration, weeklyCommitment, startDate, lectureCount, portalUrl, supportEmail, currentYear | Immediately after payment for enrolment | High |
| 6 | re-engagement-reminder-3day | `re-engagement-reminder-3day.ts` | firstName, programmeName, lastVisitDate, pendingLectureCount, nextDeadlineDate, continueUrl, currentYear | 3 days after last activity | Low |
| 7 | re-engagement-reminder-7day | `re-engagement-reminder-7day.ts` | firstName, programmeName, lastVisitDate, pendingLectureCount, nextDeadlineDate, continueUrl, currentYear | 7 days after last activity | Low |
| 8 | exam-registration-confirmed | `exam-registration-confirmed.ts` | firstName, programmeName, tier, examDate, examDuration, admissionSlipUrl, examRulesUrl, supportEmail, currentYear | Immediately after exam payment | High |
| 9 | exam-scheduled | `exam-scheduled.ts` | firstName, programmeName, examDate, examDuration, reminderDaysBeforeExam, programmeUrl, currentYear | When exam date assigned | Medium |
| 10 | exam-results | `exam-results.ts` | firstName, programmeName, totalMarksObtained, totalMarksAvailable, percentage, passMarkRequired, status, grade, tier, supportEmail, currentYear | When exam marked & results available | High |
| 11 | certificate-issued | `certificate-issued.ts` | firstName, tier, programmeName, certificateId, issuedDate, grade, certificateDownloadUrl, verificationUrl, nextTierName, exploreProgrammesUrl, currentYear | When certificate generated | High |
| 12 | certificate-revoked | `certificate-revoked.ts` | firstName, tier, programmeName, certificateId, revocationDate, revocationReason, appealDeadlineDays, supportEmail, supportPhoneNumber, currentYear | When certificate revoked | High |
| 13 | payment-received-enrolment | `payment-received-enrolment.ts` | firstName, programmeName, amountPaid, paymentDate, transactionId, paymentMethod, tier, programmeAccessUrl, invoiceUrl, supportEmail, currentYear | Immediately after payment success | High |
| 14 | staff-invitation | `staff-invitation.ts` | recipientName, roleName, department, invitationUrl, invitationExpiryDays, roleDescription, managerName, managerEmail, senderName, senderRole, currentYear | When staff invited to join | Medium |
| 15 | admin-password-reset-request | `admin-password-reset-request.ts` | firstName, resetPasswordUrl, securityContactEmail, currentYear | When admin requests password reset | Medium |
| 16 | exam-window-opened-candidate | `exam-window-opened-candidate.ts` | firstName, programmeName, tier, windowStartDate, windowEndDate, registrationDeadline, examFee, registerUrl, nextWindowOpenDate, currentYear | When exam window opens | Medium |
| 17 | exam-window-opened-staff | `exam-window-opened-staff.ts` | staffName, examName, windowStartDate, windowEndDate, examDates, expectedRegistrations, adminDashboardUrl, proctorAssignmentsUrl, preExamRemindersTemplateUrl, registrationsToDate, eligibleCandidates, proctorCoverage, currentYear | When exam window opens | Low |
| 18 | exam-submission-received-admin | `exam-submission-received-admin.ts` | staffName, candidateName, programmeName, examDate, timeSubmitted, examReviewUrl, markingQueueUrl, markingRubricUrl, submissionViewUrl, expectedMarkingTurnaroundDays, currentYear | Immediately after exam submission | Medium |

---

## Implementation Steps

### For Each Template:

1. **Create the template file** in `src/lib/email-templates/`
2. **Copy HTML and plain-text** from approved templates
3. **Define variable interface** with all required variables
4. **Create generator function** that uses `renderTemplate()`
5. **Add to registry** in `src/lib/email-templates/index.ts`
6. **Create integration point** in the appropriate action/service

### Integration Points

Templates need to be triggered from:

- **profile-completion-reminder**: Cron job 24h after `candidate.createdAt`
- **enrolment-confirmation**: `src/lib/enrolment-transaction.ts` after payment confirmation
- **re-engagement-reminder-3day/7day**: Cron job checking `LectureProgress.lastSeenAt`
- **exam-registration-confirmed**: Payment confirmation for exam fees
- **exam-scheduled**: When exam sitting is assigned a date
- **exam-results**: `releaseResults()` or similar marking action
- **certificate-issued**: `issueCertificate()` action
- **certificate-revoked**: `revokeCertificate()` action
- **payment-received-enrolment**: Payment webhook or confirmation
- **staff-invitation**: `inviteStaff()` action
- **admin-password-reset-request**: Password reset request action
- **exam-window-opened-candidate**: When ExamWindow is created
- **exam-window-opened-staff**: When ExamWindow is created
- **exam-submission-received-admin**: When `Sitting.submittedAt` is set

---

## Priority Order for Completion

**High Priority** (core user flows):
1. enrolment-confirmation
2. exam-registration-confirmed
3. exam-results
4. certificate-issued
5. certificate-revoked
6. payment-received-enrolment

**Medium Priority** (important but not critical path):
1. profile-completion-reminder
2. exam-scheduled
3. staff-invitation
4. admin-password-reset-request
5. exam-window-opened-candidate

**Low Priority** (engagement/operational):
1. re-engagement-reminder-3day
2. re-engagement-reminder-7day
3. exam-window-opened-staff
4. exam-submission-received-admin

---

## Testing

Before deploying, test each template:

1. Verify all variables are correctly substituted
2. Check HTML renders properly in email client
3. Verify plain-text version is readable
4. Check links work (if applicable)
5. Verify SMTP logging in `EmailLog` table
6. Test error handling (bad email, SMTP failure)

---

## Notes

- All approved HTML/text from templates has been preserved
- Variable substitution uses `{{variableName}}` syntax
- HTML escaping is automatic via `renderTemplate()`
- Email logs are stored in `EmailLog` table with status, error messages
- SMTP credentials must be in `.env.local` (never committed)
