import { renderTemplate } from "@/lib/email-utils";

export interface ExamWindowOpenedStaffVariables {
  staffFirstName: string;
  programmeName: string;
  tier: string;
  role: string;
  examDate: string;
  windowOpenDate: string;
  windowCloseDate: string;
  registrationDeadline: string;
  examDuration: string;
  adminUrl: string;
  supportEmail: string;
  currentYear: number;
}

export function generateExamWindowOpenedStaffEmail(variables: ExamWindowOpenedStaffVariables) {
  const subject = renderTemplate(
    "Exam Window Opened — {{programmeName}}, {{examDate}}",
    variables
  );

  const html = renderTemplate(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #11998e; }
    .detail-row { padding: 10px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
    .detail-row:last-child { border-bottom: none; }
    .action-button { display: inline-block; background: #11998e; color: white; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-weight: 600; margin: 15px 0; }
    .responsibilities { background: #e8f5e9; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .responsibilities h3 { margin-top: 0; color: #2e7d32; }
    .resp-item { padding: 8px 0; color: #2e7d32; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📢 Exam Window Opened</h1>
      <p>{{programmeName}} — {{examDate}}</p>
    </div>

    <div class="content">
      <p>Hi {{staffFirstName}},</p>

      <p>As a <strong>{{role}}</strong>, you're notified that the exam window for <strong>{{programmeName}} ({{tier}})</strong> has opened. Candidates can now register for the examination.</p>

      <div class="info-box">
        <div class="detail-row">
          <div><strong>Exam Date:</strong></div>
          <div>{{examDate}}</div>
        </div>
        <div class="detail-row">
          <div><strong>Duration:</strong></div>
          <div>{{examDuration}}</div>
        </div>
        <div class="detail-row">
          <div><strong>Window Opens:</strong></div>
          <div>{{windowOpenDate}}</div>
        </div>
        <div class="detail-row">
          <div><strong>Registration Closes:</strong></div>
          <div>{{registrationDeadline}}</div>
        </div>
        <div class="detail-row">
          <div><strong>Candidate Registration:</strong></div>
          <div>{{windowCloseDate}}</div>
        </div>
      </div>

      <a href="{{adminUrl}}" class="action-button">View Admin Dashboard</a>

      <div class="responsibilities">
        <h3>Your Responsibilities</h3>
        {{#if role == 'FACULTY'}}
        <div class="resp-item">✓ Monitor candidate submissions during exam period</div>
        <div class="resp-item">✓ Be available for invigilating if assigned</div>
        <div class="resp-item">✓ Report any technical issues to administration</div>
        {{else if role == 'ACADEMIC_ADMINISTRATOR'}}
        <div class="resp-item">✓ Monitor exam progress and registration</div>
        <div class="resp-item">✓ Coordinate with faculty and invigilators</div>
        <div class="resp-item">✓ Ensure exam quality and compliance</div>
        {{else if role == 'REGISTRAR'}}
        <div class="resp-item">✓ Monitor candidate registrations</div>
        <div class="resp-item">✓ Verify candidate eligibility</div>
        <div class="resp-item">✓ Manage candidate records and documentation</div>
        {{else}}
        <div class="resp-item">✓ Perform your assigned exam-related duties</div>
        <div class="resp-item">✓ Report any issues to administration</div>
        <div class="resp-item">✓ Ensure candidate support throughout the exam period</div>
        {{/if}}
      </div>

      <p>Key dates to remember:</p>
      <ul>
        <li><strong>Registration Deadline:</strong> {{registrationDeadline}}</li>
        <li><strong>Exam Date:</strong> {{examDate}}</li>
        <li><strong>Window Closes:</strong> {{windowCloseDate}}</li>
      </ul>

      <p>For questions about your responsibilities or to report issues, please contact us at <strong>{{supportEmail}}</strong>.</p>

      <div class="footer">
        <p>© {{currentYear}} Lavelle Institute. All rights reserved.</p>
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`,
    variables
  );

  const text = `Exam Window Opened

Hi {{staffFirstName}},

As a {{role}}, you're notified that the exam window for {{programmeName}} ({{tier}}) has opened.

EXAM DETAILS
Exam Date: {{examDate}}
Duration: {{examDuration}}
Window Opens: {{windowOpenDate}}
Registration Closes: {{registrationDeadline}}
Candidate Registration: {{windowCloseDate}}

View Admin Dashboard: {{adminUrl}}

YOUR RESPONSIBILITIES
✓ Perform your assigned exam-related duties
✓ Report any issues to administration
✓ Ensure candidate support throughout the exam period

KEY DATES
• Registration Deadline: {{registrationDeadline}}
• Exam Date: {{examDate}}
• Window Closes: {{windowCloseDate}}

Questions? Contact {{supportEmail}}.

© {{currentYear}} Lavelle Institute`;

  return {
    subject,
    html,
    text: renderTemplate(text, variables),
  };
}
