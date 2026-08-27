import { renderTemplate } from "@/lib/email-utils";

export interface ExamSubmissionReceivedAdminVariables {
  adminFirstName: string;
  candidateName: string;
  candidateNumber: string;
  programmeName: string;
  tier: string;
  submissionTime: string;
  examDuration: string;
  totalSubmissions: number;
  totalExpected: number;
  markingUrl: string;
  supportEmail: string;
  currentYear: number;
}

export function generateExamSubmissionReceivedAdminEmail(variables: ExamSubmissionReceivedAdminVariables) {
  const submissionPercentage = Math.round((variables.totalSubmissions / variables.totalExpected) * 100);
  const subject = renderTemplate(
    "Exam Submission Received — {{candidateName}}, {{programmeName}}",
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
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .submission-box { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #667eea; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #666; }
    .value { color: #333; text-align: right; }
    .progress-box { background: #f0f0f0; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .progress-label { font-weight: 600; margin-bottom: 10px; }
    .progress-bar { background: #e0e0e0; height: 20px; border-radius: 10px; overflow: hidden; }
    .progress-fill { background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); height: 100%; width: {{submissionPercentage}}%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; }
    .action-button { display: inline-block; background: #667eea; color: white; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-weight: 600; margin: 15px 0; }
    .stats-box { background: #e8f4f8; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .stats-box h3 { margin-top: 0; color: #0c5460; }
    .stat-item { padding: 8px 0; color: #0c5460; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Exam Submission Received</h1>
      <p>{{programmeName}} — {{tier}}</p>
    </div>

    <div class="content">
      <p>Hi {{adminFirstName}},</p>

      <p>A candidate has submitted their examination for <strong>{{programmeName}} ({{tier}})</strong>.</p>

      <div class="submission-box">
        <div class="detail-row">
          <div class="label">Candidate:</div>
          <div class="value">{{candidateName}}</div>
        </div>
        <div class="detail-row">
          <div class="label">Candidate Number:</div>
          <div class="value">{{candidateNumber}}</div>
        </div>
        <div class="detail-row">
          <div class="label">Programme:</div>
          <div class="value">{{programmeName}} ({{tier}})</div>
        </div>
        <div class="detail-row">
          <div class="label">Exam Duration:</div>
          <div class="value">{{examDuration}}</div>
        </div>
        <div class="detail-row">
          <div class="label">Submission Time:</div>
          <div class="value"><strong>{{submissionTime}}</strong></div>
        </div>
      </div>

      <div class="progress-box">
        <div class="progress-label">Exam Submission Progress</div>
        <div class="progress-bar">
          <div class="progress-fill">{{totalSubmissions}}/{{totalExpected}}</div>
        </div>
        <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
          {{totalSubmissions}} of {{totalExpected}} candidates submitted ({{submissionPercentage}}%)
        </p>
      </div>

      <a href="{{markingUrl}}" class="action-button">📊 View Submission Details</a>

      <div class="stats-box">
        <h3>Admin Actions Available</h3>
        <div class="stat-item">✓ Review submission and answers</div>
        <div class="stat-item">✓ View marked/unmarked questions</div>
        <div class="stat-item">✓ Assign to invigilators for review if needed</div>
        <div class="stat-item">✓ Monitor marking progress across all submissions</div>
      </div>

      <p>For questions about submissions or marking, please contact us at <strong>{{supportEmail}}</strong>.</p>

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

  const text = `Exam Submission Received

Hi {{adminFirstName}},

A candidate has submitted their examination for {{programmeName}} ({{tier}}).

SUBMISSION DETAILS
Candidate: {{candidateName}}
Candidate Number: {{candidateNumber}}
Programme: {{programmeName}} ({{tier}})
Exam Duration: {{examDuration}}
Submission Time: {{submissionTime}}

PROGRESS
{{totalSubmissions}} of {{totalExpected}} candidates submitted

View Submission Details: {{markingUrl}}

ADMIN ACTIONS AVAILABLE
✓ Review submission and answers
✓ View marked/unmarked questions
✓ Assign to invigilators for review if needed
✓ Monitor marking progress across all submissions

Questions? Contact {{supportEmail}}.

© {{currentYear}} Lavelle Institute`;

  return {
    subject,
    html,
    text: renderTemplate(text, variables),
  };
}
