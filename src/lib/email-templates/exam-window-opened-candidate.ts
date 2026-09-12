import { renderTemplate } from "@/lib/email-utils";

export interface ExamWindowOpenedCandidateVariables {
  firstName: string;
  programmeName: string;
  tier: string;
  examDate: string;
  windowOpenDate: string;
  windowCloseDate: string;
  examDuration: string;
  registrationUrl: string;
  admissionSlipUrl: string;
  examRulesUrl: string;
  supportEmail: string;
  currentYear: number;
}

export function generateExamWindowOpenedCandidateEmail(variables: ExamWindowOpenedCandidateVariables) {
  const subject = renderTemplate(
    "Exam Window Is Open — {{programmeName}} Registration Available Now",
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
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .exam-box { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f5576c; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #666; }
    .value { color: #333; text-align: right; }
    .action-buttons { margin: 20px 0; }
    .primary-btn { display: inline-block; background: #f5576c; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: 600; margin-right: 10px; }
    .secondary-btn { display: inline-block; background: #f0f0f0; color: #333; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: 600; }
    .urgent-box { background: #ffe0e0; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f5576c; color: #c00; font-weight: 600; }
    .checklist { background: #f0f8ff; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .checklist h3 { margin-top: 0; color: #0c5460; }
    .check-item { padding: 8px 0; color: #0c5460; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 Exam Window Is Open!</h1>
      <p>{{programmeName}} — {{tier}}</p>
    </div>

    <div class="content">
      <p>Hi {{firstName}},</p>

      <p>Great news! The examination window for <strong>{{programmeName}} ({{tier}})</strong> is now open. You can register for the exam starting today.</p>

      <div class="exam-box">
        <div class="detail-row">
          <div class="label">Exam Date:</div>
          <div class="value"><strong>{{examDate}}</strong></div>
        </div>
        <div class="detail-row">
          <div class="label">Duration:</div>
          <div class="value">{{examDuration}}</div>
        </div>
        <div class="detail-row">
          <div class="label">Window Open:</div>
          <div class="value">{{windowOpenDate}}</div>
        </div>
        <div class="detail-row">
          <div class="label">Registration Closes:</div>
          <div class="value"><strong>{{windowCloseDate}}</strong></div>
        </div>
      </div>

      <div class="urgent-box">
        ⏰ Register Before {{windowCloseDate}} — After this date, registration will close
      </div>

      <div class="action-buttons">
        <a href="{{registrationUrl}}" class="primary-btn">📝 Register for Exam</a>
        <a href="{{examRulesUrl}}" class="secondary-btn">📋 View Rules</a>
      </div>

      <div class="checklist">
        <h3>Before You Register</h3>
        <div class="check-item">☐ Review exam rules and format</div>
        <div class="check-item">☐ Ensure you meet all eligibility requirements</div>
        <div class="check-item">☐ Check your internet connection speed (required for the exam)</div>
        <div class="check-item">☐ Find a quiet location for the exam</div>
        <div class="check-item">☐ Have valid identification ready for exam day</div>
        <div class="check-item">☐ Register early to guarantee your spot</div>
      </div>

      <p>If you have any questions about registering or need technical support, please contact us at <strong>{{supportEmail}}</strong>.</p>

      <p style="color: #999; margin-top: 20px;">Don't miss this opportunity — register today!</p>

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

  const text = `Exam Window Is Open!

Hi {{firstName}},

Great news! The examination window for {{programmeName}} ({{tier}}) is now open. You can register for the exam starting today.

EXAM DETAILS
Exam Date: {{examDate}}
Duration: {{examDuration}}
Window Open: {{windowOpenDate}}
Registration Closes: {{windowCloseDate}}

⏰ IMPORTANT: Register Before {{windowCloseDate}}

Register for Exam: {{registrationUrl}}
View Exam Rules: {{examRulesUrl}}

BEFORE YOU REGISTER
☐ Review exam rules and format
☐ Ensure you meet all eligibility requirements
☐ Check your internet connection speed
☐ Find a quiet location for the exam
☐ Have valid identification ready
☐ Register early to guarantee your spot

Questions? Contact {{supportEmail}}.

© {{currentYear}} Lavelle Institute`;

  return {
    subject,
    html,
    text: renderTemplate(text, variables),
  };
}
