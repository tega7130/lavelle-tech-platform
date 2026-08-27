import { generateAccountWelcomeEmail, type AccountWelcomeVariables } from './account-welcome';
import { generateEmailVerificationOtpEmail, type EmailVerificationOtpVariables } from './email-verification-otp';
import { generatePasswordResetRequestEmail, type PasswordResetRequestVariables } from './password-reset-request';
import { generateEnrolmentConfirmationEmail, type EnrolmentConfirmationVariables } from './enrolment-confirmation';
import { generatePaymentReceivedEnrolmentEmail, type PaymentReceivedEnrolmentVariables } from './payment-received-enrolment';
import { generateExamRegistrationConfirmedEmail, type ExamRegistrationConfirmedVariables } from './exam-registration-confirmed';
import { generateExamResultsEmail, type ExamResultsVariables } from './exam-results';
import { generateCertificateIssuedEmail, type CertificateIssuedVariables } from './certificate-issued';
import { generateCertificateRevokedEmail, type CertificateRevokedVariables } from './certificate-revoked';
import { generateProfileCompletionReminderEmail, type ProfileCompletionReminderVariables } from './profile-completion-reminder';
import { generateExamScheduledEmail, type ExamScheduledVariables } from './exam-scheduled';
import { generateStaffInvitationEmail, type StaffInvitationVariables } from './staff-invitation';
import { generateAdminPasswordResetRequestEmail, type AdminPasswordResetRequestVariables } from './admin-password-reset-request';
import { generateExamWindowOpenedCandidateEmail, type ExamWindowOpenedCandidateVariables } from './exam-window-opened-candidate';
import { generateExamWindowOpenedStaffEmail, type ExamWindowOpenedStaffVariables } from './exam-window-opened-staff';
import { generateExamSubmissionReceivedAdminEmail, type ExamSubmissionReceivedAdminVariables } from './exam-submission-received-admin';
import { generateReEngagementReminder3dayEmail, type ReEngagementReminder3dayVariables } from './re-engagement-reminder-3day';
import { generateReEngagementReminder7dayEmail, type ReEngagementReminder7dayVariables } from './re-engagement-reminder-7day';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export type EmailTemplateVariables =
  | { template: 'account-welcome'; variables: AccountWelcomeVariables }
  | { template: 'email-verification-otp'; variables: EmailVerificationOtpVariables }
  | { template: 'password-reset-request'; variables: PasswordResetRequestVariables }
  | { template: 'enrolment-confirmation'; variables: EnrolmentConfirmationVariables }
  | { template: 'payment-received-enrolment'; variables: PaymentReceivedEnrolmentVariables }
  | { template: 'exam-registration-confirmed'; variables: ExamRegistrationConfirmedVariables }
  | { template: 'exam-results'; variables: ExamResultsVariables }
  | { template: 'certificate-issued'; variables: CertificateIssuedVariables }
  | { template: 'certificate-revoked'; variables: CertificateRevokedVariables }
  | { template: 'profile-completion-reminder'; variables: ProfileCompletionReminderVariables }
  | { template: 'exam-scheduled'; variables: ExamScheduledVariables }
  | { template: 'staff-invitation'; variables: StaffInvitationVariables }
  | { template: 'admin-password-reset-request'; variables: AdminPasswordResetRequestVariables }
  | { template: 'exam-window-opened-candidate'; variables: ExamWindowOpenedCandidateVariables }
  | { template: 'exam-window-opened-staff'; variables: ExamWindowOpenedStaffVariables }
  | { template: 'exam-submission-received-admin'; variables: ExamSubmissionReceivedAdminVariables }
  | { template: 're-engagement-reminder-3day'; variables: ReEngagementReminder3dayVariables }
  | { template: 're-engagement-reminder-7day'; variables: ReEngagementReminder7dayVariables };

export const emailTemplates = {
  'account-welcome': generateAccountWelcomeEmail,
  'email-verification-otp': generateEmailVerificationOtpEmail,
  'password-reset-request': generatePasswordResetRequestEmail,
  'enrolment-confirmation': generateEnrolmentConfirmationEmail,
  'payment-received-enrolment': generatePaymentReceivedEnrolmentEmail,
  'exam-registration-confirmed': generateExamRegistrationConfirmedEmail,
  'exam-results': generateExamResultsEmail,
  'certificate-issued': generateCertificateIssuedEmail,
  'certificate-revoked': generateCertificateRevokedEmail,
  'profile-completion-reminder': generateProfileCompletionReminderEmail,
  'exam-scheduled': generateExamScheduledEmail,
  'staff-invitation': generateStaffInvitationEmail,
  'admin-password-reset-request': generateAdminPasswordResetRequestEmail,
  'exam-window-opened-candidate': generateExamWindowOpenedCandidateEmail,
  'exam-window-opened-staff': generateExamWindowOpenedStaffEmail,
  'exam-submission-received-admin': generateExamSubmissionReceivedAdminEmail,
  're-engagement-reminder-3day': generateReEngagementReminder3dayEmail,
  're-engagement-reminder-7day': generateReEngagementReminder7dayEmail,
};

export type TemplateName = keyof typeof emailTemplates;

export function getEmailTemplate(templateName: TemplateName) {
  const templateFn = emailTemplates[templateName];
  if (!templateFn) {
    throw new Error(`Email template not found: ${templateName}`);
  }
  return templateFn;
}
