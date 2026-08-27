import { sendTransactionalEmailByTemplate } from "@/lib/send-transactional-email";
import { type TemplateName } from "@/lib/email-templates";
import { triggerJobImmediate } from "@/lib/scheduler";
import { EMAIL_CONFIG } from "@/lib/email-config";

/**
 * Test all 18 email templates
 * POST with body: { "action": "send-all" | "send-single" | "trigger-jobs", "templateName": "...", "testEmail": "..." }
 */

const testEmail = "praise1564@gmail.com"; // Change to your test email

const templateTestData: Record<TemplateName, Record<string, any>> = {
  "account-welcome": {
    firstName: "John",
    explorationUrl: "http://localhost:3000/portal/programmes",
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "email-verification-otp": {
    firstName: "John",
    otp: "123456",
    expiryMinutes: 48,
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "password-reset-request": {
    firstName: "John",
    resetPasswordUrl: "http://localhost:3000/reset-password?token=xyz",
    expiryMinutes: 30,
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "enrolment-confirmation": {
    firstName: "John",
    programmeName: "Advanced Legal Practice",
    tier: "ADVANCED_PRACTITIONER",
    startDate: new Date().toLocaleDateString(),
    duration: "12 weeks",
    portalUrl: "http://localhost:3000/portal/programmes/123",
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "payment-received-enrolment": {
    firstName: "John",
    programmeName: "Advanced Legal Practice",
    amount: "₦50,000",
    transactionId: "TXN123456",
    portalUrl: "http://localhost:3000/portal/payments",
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "exam-registration-confirmed": {
    firstName: "John",
    programmeName: "Advanced Legal Practice",
    examDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    examTime: "09:00 AM",
    examDuration: "180 minutes",
    admissionSlipUrl: "http://localhost:3000/exams/123/admission-slip",
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "exam-results": {
    firstName: "John",
    programmeName: "Advanced Legal Practice",
    tier: "ADVANCED_PRACTITIONER",
    examDate: new Date().toLocaleDateString(),
    grade: "A",
    score: 85,
    status: "PASSED",
    resultsUrl: "http://localhost:3000/portal/results/123",
    markingTurnaroundDays: 10,
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "certificate-issued": {
    firstName: "John",
    certificateId: "CERT-2026-001",
    programmeName: "Advanced Legal Practice",
    issueDate: new Date().toLocaleDateString(),
    downloadUrl: "http://localhost:3000/certificates/CERT-2026-001/download",
    verificationUrl: "http://localhost:3000/certificates/CERT-2026-001/verify",
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "certificate-revoked": {
    firstName: "John",
    certificateId: "CERT-2026-001",
    programmeName: "Advanced Legal Practice",
    reason: "Exam integrity violation",
    appealDeadlineDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    appealUrl: "http://localhost:3000/appeals/new",
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "profile-completion-reminder": {
    firstName: "John",
    profileCompletionUrl: "http://localhost:3000/portal/profile",
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "exam-scheduled": {
    firstName: "John",
    programmeName: "Advanced Legal Practice",
    tier: "ADVANCED_PRACTITIONER",
    examDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    examTime: "09:00 AM",
    examDuration: "180 minutes",
    windowOpenDate: new Date().toLocaleDateString(),
    windowCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    registrationDeadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    registrationUrl: "http://localhost:3000/portal/exams",
    examRulesUrl: "http://localhost:3000/exams/rules",
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "staff-invitation": {
    staffFirstName: "Jane",
    role: "Examiner",
    setPasswordUrl: "http://localhost:3000/staff/set-password?token=xyz",
    expiryHours: 24,
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "admin-password-reset-request": {
    firstName: "Jane",
    role: "Examiner",
    resetPasswordUrl: "http://localhost:3000/staff/set-password?token=xyz",
    expiryMinutes: 30,
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "exam-window-opened-candidate": {
    firstName: "John",
    programmeName: "Advanced Legal Practice",
    tier: "ADVANCED_PRACTITIONER",
    examDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    windowOpenDate: new Date().toLocaleDateString(),
    windowCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    examDuration: "180 minutes",
    registrationUrl: "http://localhost:3000/portal/exams",
    admissionSlipUrl: "http://localhost:3000/exams/123/admission-slip",
    examRulesUrl: "http://localhost:3000/exams/rules",
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "exam-window-opened-staff": {
    staffFirstName: "Jane",
    programmeName: "Advanced Legal Practice",
    tier: "ADVANCED_PRACTITIONER",
    role: "Examiner",
    examDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    windowOpenDate: new Date().toLocaleDateString(),
    windowCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    registrationDeadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    examDuration: "180 minutes",
    adminUrl: "http://localhost:3000/admin/exam-builder",
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "exam-submission-received-admin": {
    adminFirstName: "Admin",
    programmeName: "Advanced Legal Practice",
    tier: "ADVANCED_PRACTITIONER",
    submissionCount: 45,
    totalCandidates: 50,
    windowCloseDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    adminUrl: "http://localhost:3000/admin/submissions",
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "re-engagement-reminder-3day": {
    firstName: "John",
    programmeName: "Advanced Legal Practice",
    lastActivityDays: 3,
    portalUrl: "http://localhost:3000/portal/programmes/123",
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
  "re-engagement-reminder-7day": {
    firstName: "John",
    programmeName: "Advanced Legal Practice",
    lastActivityDays: 7,
    portalUrl: "http://localhost:3000/portal/programmes/123",
    supportEmail: EMAIL_CONFIG.supportEmail,
    currentYear: 2026,
  },
};

export async function POST(request: Request) {
  const body = await request.json();
  const { action, templateName, testEmailOverride } = body;
  const testAddr = testEmailOverride || testEmail;

  try {
    if (action === "send-all") {
      // Send all 18 templates
      const results = [];
      for (const [template, data] of Object.entries(templateTestData)) {
        try {
          const result = await sendTransactionalEmailByTemplate(
            template as TemplateName,
            testAddr,
            data
          );
          results.push({
            template,
            sent: result.success,
            error: result.error || null,
          });
        } catch (error) {
          results.push({
            template,
            sent: false,
            error: String(error),
          });
        }
      }
      return Response.json({
        action: "send-all",
        totalTemplates: Object.keys(templateTestData).length,
        results,
        testEmail: testAddr,
      });
    }

    if (action === "send-single") {
      // Send a single template
      if (!templateName || !templateTestData[templateName as TemplateName]) {
        return Response.json(
          { error: `Unknown template: ${templateName}` },
          { status: 400 }
        );
      }
      const result = await sendTransactionalEmailByTemplate(
        templateName as TemplateName,
        testAddr,
        templateTestData[templateName as TemplateName]
      );
      return Response.json({
        action: "send-single",
        template: templateName,
        sent: result.success,
        error: result.error || null,
        testEmail: testAddr,
      });
    }

    if (action === "trigger-jobs") {
      // Trigger all 5 cron jobs
      const jobs = [
        "profile-completion-reminder",
        "re-engagement-reminder-3day",
        "re-engagement-reminder-7day",
        "exam-window-opened-candidate",
        "exam-window-opened-staff",
      ];

      const results = [];
      for (const jobName of jobs) {
        try {
          await triggerJobImmediate(jobName);
          results.push({ job: jobName, triggered: true });
        } catch (error) {
          results.push({ job: jobName, triggered: false, error: String(error) });
        }
      }
      return Response.json({
        action: "trigger-jobs",
        results,
      });
    }

    if (action === "list") {
      // List all templates
      return Response.json({
        templates: Object.keys(templateTestData),
        count: Object.keys(templateTestData).length,
      });
    }

    return Response.json(
      { error: "Unknown action. Use: send-all, send-single, trigger-jobs, list" },
      { status: 400 }
    );
  } catch (error) {
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
