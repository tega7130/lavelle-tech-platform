import { renderTemplate } from "@/lib/email-utils";
import { EMAIL_CONFIG } from "@/lib/email-config";

export interface ExamResultsVariables {
  firstName: string;
  programmeName: string;
  tier: string;
  examDate: string;
  marksObtained: number;
  marksTotal: number;
  percentage: number;
  grade: string;
  outcome: "PASS" | "FAIL" | "REFER";
  resultsPortalUrl: string;
  supportEmail: string;
  currentYear: number;
}

export function generateExamResultsEmail(variables: ExamResultsVariables) {
  const subject = renderTemplate(
    "{{outcome}} — {{programmeName}} Exam Results",
    variables
  );

  const passMessage =
    variables.outcome === "PASS"
      ? "Congratulations! You have passed this examination."
      : variables.outcome === "REFER"
        ? "You have been referred. You may resit this examination."
        : "Unfortunately, you have not achieved the required mark. You may resit if eligible.";

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
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .results-box { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #667eea; }
    .score { font-size: 32px; font-weight: bold; color: #667eea; }
    .label { color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .outcome { padding: 10px 15px; border-radius: 4px; margin: 15px 0; font-weight: 600; }
    .outcome.pass { background: #d4edda; color: #155724; }
    .outcome.refer { background: #fff3cd; color: #856404; }
    .outcome.fail { background: #f8d7da; color: #721c24; }
    .action-button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; margin: 20px 0; font-weight: 600; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
    .next-steps { background: #e8f4f8; padding: 15px; border-radius: 6px; margin: 15px 0; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    td { padding: 8px; border-bottom: 1px solid #eee; }
    .label-col { font-weight: 600; width: 40%; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Exam Results Released</h1>
      <p>{{programmeName}} — {{tier}}</p>
    </div>

    <div class="content">
      <p>Hi {{firstName}},</p>

      <p>Your examination results have been released and are now available in your portal.</p>

      <div class="results-box">
        <div class="label">Your Score</div>
        <div class="score">{{percentage}}%</div>
        <p style="margin: 10px 0; color: #666;">
          {{marksObtained}} out of {{marksTotal}} marks | Grade: <strong>{{grade}}</strong>
        </p>
      </div>

      <div class="outcome ${variables.outcome.toLowerCase()}">
        ${passMessage}
      </div>

      <table>
        <tr>
          <td class="label-col">Exam Date:</td>
          <td>{{examDate}}</td>
        </tr>
        <tr>
          <td class="label-col">Programme:</td>
          <td>{{programmeName}} ({{tier}})</td>
        </tr>
        <tr>
          <td class="label-col">Your Grade:</td>
          <td><strong>{{grade}}</strong></td>
        </tr>
      </table>

      <div class="next-steps">
        <strong>What's Next?</strong>
        <p>
          {{#if outcome == 'PASS'}}
          Your results have been processed. Check your portal for certificate issuance and next steps.
          {{else if outcome == 'REFER'}}
          You are eligible for a resit. ${`${variables.outcome === "REFER" ? "Contact our support team for resit booking instructions." : ""}`}
          {{else}}
          You may be eligible for a resit depending on the exam's attempt policy. Contact support for details.
          {{/if}}
        </p>
      </div>

      <a href="{{resultsPortalUrl}}" class="action-button">View Full Results</a>

      <p>If you have any questions about your results, please contact us at <strong>{{supportEmail}}</strong>.</p>

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

  const text = `Exam Results Released

Hi {{firstName}},

Your examination results for {{programmeName}} ({{tier}}) have been released.

Your Score: {{percentage}}% ({{marksObtained}}/{{marksTotal}} marks)
Grade: {{grade}}

${passMessage}

Exam Date: {{examDate}}
Programme: {{programmeName}} ({{tier}})

View your full results here: {{resultsPortalUrl}}

If you have questions, contact {{supportEmail}}.

© {{currentYear}} Lavelle Institute`;

  return {
    subject,
    html,
    text: renderTemplate(text, variables),
  };
}
