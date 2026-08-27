import { renderTemplate } from "@/lib/email-utils";

export interface ExamScheduledVariables {
  firstName: string;
  programmeName: string;
  tier: string;
  examDate: string;
  examTime: string;
  examDuration: string;
  windowOpenDate: string;
  windowCloseDate: string;
  registrationDeadline: string;
  registrationUrl: string;
  examRulesUrl: string;
  supportEmail: string;
  currentYear: number;
}

export function generateExamScheduledEmail(variables: ExamScheduledVariables) {
  const subject = renderTemplate(
    "Exam Scheduled — {{programmeName}}, {{examDate}}",
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
    .exam-box { background: white; padding: 25px; border-radius: 6px; margin: 20px 0; border: 2px solid #f5576c; }
    .exam-title { font-size: 18px; font-weight: 600; color: #f5576c; margin-bottom: 15px; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #666; }
    .value { color: #333; text-align: right; }
    .deadline-box { background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107; }
    .deadline-box strong { color: #856404; }
    .action-button { display: inline-block; background: #f5576c; color: white; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-weight: 600; margin: 15px 0; }
    .secondary-btn { display: inline-block; background: #f0f0f0; color: #333; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-weight: 600; margin: 15px 10px 15px 0; }
    .prep-checklist { background: #f0f8ff; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .prep-checklist h3 { margin-top: 0; color: #0c5460; }
    .prep-item { padding: 8px 0; color: #0c5460; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Exam Scheduled</h1>
      <p>{{programmeName}} — {{tier}}</p>
    </div>

    <div class="content">
      <p>Hi {{firstName}},</p>

      <p>Great news! The examination for <strong>{{programmeName}} ({{tier}})</strong> has been scheduled. Here are the details:</p>

      <div class="exam-box">
        <div class="exam-title">📅 Examination Details</div>
        <div class="detail-row">
          <div class="label">Exam Date:</div>
          <div class="value"><strong>{{examDate}}</strong></div>
        </div>
        <div class="detail-row">
          <div class="label">Exam Time:</div>
          <div class="value">{{examTime}}</div>
        </div>
        <div class="detail-row">
          <div class="label">Duration:</div>
          <div class="value">{{examDuration}}</div>
        </div>
        <div class="detail-row">
          <div class="label">Programme:</div>
          <div class="value">{{programmeName}} ({{tier}})</div>
        </div>
      </div>

      <div class="exam-box" style="border-color: #28a745;">
        <div class="exam-title" style="color: #28a745;">📝 Registration Window</div>
        <div class="detail-row">
          <div class="label">Window Opens:</div>
          <div class="value">{{windowOpenDate}}</div>
        </div>
        <div class="detail-row">
          <div class="label">Window Closes:</div>
          <div class="value">{{windowCloseDate}}</div>
        </div>
      </div>

      <div class="deadline-box">
        <strong>⏰ Important Deadline:</strong>
        <p>Registration closes on <strong>{{registrationDeadline}}</strong>. Register early to secure your spot!</p>
      </div>

      <a href="{{registrationUrl}}" class="action-button">Register for Exam</a>
      <a href="{{examRulesUrl}}" class="secondary-btn">📋 View Exam Rules</a>

      <div class="prep-checklist">
        <h3>📚 Preparation Checklist</h3>
        <div class="prep-item">☐ Review all course materials and lecture notes</div>
        <div class="prep-item">☐ Complete practice questions and mock exams</div>
        <div class="prep-item">☐ Understand the exam format and rules</div>
        <div class="prep-item">☐ Plan your study schedule</div>
        <div class="prep-item">☐ Register for the exam (before the deadline)</div>
        <div class="prep-item">☐ Ensure you have necessary identification for exam day</div>
      </div>

      <p>If you have any questions about the exam or registration, please contact us at <strong>{{supportEmail}}</strong>.</p>

      <p style="color: #999; font-size: 13px;">
        Mark your calendar and prepare well. We're confident you'll do great!
      </p>

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

  const text = `Exam Scheduled

Hi {{firstName}},

Great news! The examination for {{programmeName}} ({{tier}}) has been scheduled.

EXAMINATION DETAILS
Exam Date: {{examDate}}
Exam Time: {{examTime}}
Duration: {{examDuration}}
Programme: {{programmeName}} ({{tier}})

REGISTRATION WINDOW
Opens: {{windowOpenDate}}
Closes: {{windowCloseDate}}

IMPORTANT DEADLINE: Registration closes on {{registrationDeadline}}

Register for Exam: {{registrationUrl}}
View Exam Rules: {{examRulesUrl}}

PREPARATION CHECKLIST
☐ Review all course materials and lecture notes
☐ Complete practice questions and mock exams
☐ Understand the exam format and rules
☐ Plan your study schedule
☐ Register for the exam (before the deadline)
☐ Ensure you have necessary identification for exam day

Questions? Contact {{supportEmail}}.

© {{currentYear}} Lavelle Institute`;

  return {
    subject,
    html,
    text: renderTemplate(text, variables),
  };
}
