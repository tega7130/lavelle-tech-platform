import { renderTemplate } from "@/lib/email-utils";

export interface ReEngagementReminder7dayVariables {
  firstName: string;
  programmeName: string;
  lastActivityDays: number;
  portalUrl: string;
  supportEmail: string;
  currentYear: number;
}

export function generateReEngagementReminder7dayEmail(variables: ReEngagementReminder7dayVariables) {
  const subject = renderTemplate(
    "Time to Get Back on Track — {{programmeName}} Learning",
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
    .urgent-box { background: #fff3cd; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107; }
    .urgent-box strong { color: #856404; }
    .action-button { display: inline-block; background: #f5576c; color: white; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-weight: 600; margin: 20px 0; font-size: 16px; }
    .impact-box { background: #ffe8e8; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .impact-box h3 { margin-top: 0; color: #c00; }
    .impact-item { padding: 8px 0; color: #c00; }
    .support-box { background: #e8f4f8; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .support-box h3 { margin-top: 0; color: #0c5460; }
    .support-item { padding: 8px 0; color: #0c5460; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Time to Get Back on Track</h1>
      <p>{{programmeName}}</p>
    </div>

    <div class="content">
      <p>Hi {{firstName}},</p>

      <div class="urgent-box">
        <strong>📢 Important Notice</strong>
        <p>It's been {{lastActivityDays}} days since your last activity. Extended periods of inactivity can impact your learning outcomes and exam preparation.</p>
      </div>

      <p>We understand that life gets busy, but consistent engagement is crucial for your success in <strong>{{programmeName}}</strong>.</p>

      <div class="impact-box">
        <h3>Impact of Extended Absence</h3>
        <div class="impact-item">⚠️ You may fall behind on course content</div>
        <div class="impact-item">⚠️ Exam preparation time is limited</div>
        <div class="impact-item">⚠️ Missed assignments or activities</div>
        <div class="impact-item">⚠️ Risk to overall programme completion</div>
      </div>

      <a href="{{portalUrl}}" class="action-button">Resume Your Learning Now</a>

      <div class="support-box">
        <h3>We're Here to Help</h3>
        <p>If something is preventing you from engaging with your studies, don't hesitate to reach out. We can discuss:</p>
        <div class="support-item">✓ Time management strategies</div>
        <div class="support-item">✓ Learning difficulties or barriers</div>
        <div class="support-item">✓ Programme adjustments if needed</div>
        <div class="support-item">✓ Additional resources or support</div>
      </div>

      <p><strong>Contact us today at {{supportEmail}}</strong> if you need help getting back on track. Our support team is ready to assist you.</p>

      <p style="margin-top: 20px; font-style: italic; color: #666;">Remember: You've already invested time and effort into this programme. Don't let a temporary setback derail your progress. You can do this! 💪</p>

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

  const text = `Time to Get Back on Track

Hi {{firstName}},

📢 IMPORTANT NOTICE

It's been {{lastActivityDays}} days since your last activity. Extended periods of inactivity can impact your learning outcomes and exam preparation.

We understand that life gets busy, but consistent engagement is crucial for your success in {{programmeName}}.

IMPACT OF EXTENDED ABSENCE
⚠️ You may fall behind on course content
⚠️ Exam preparation time is limited
⚠️ Missed assignments or activities
⚠️ Risk to overall programme completion

Resume Your Learning Now: {{portalUrl}}

WE'RE HERE TO HELP
If something is preventing you from engaging with your studies, don't hesitate to reach out. We can discuss:
✓ Time management strategies
✓ Learning difficulties or barriers
✓ Programme adjustments if needed
✓ Additional resources or support

CONTACT US TODAY: {{supportEmail}}

Our support team is ready to assist you.

Remember: You've already invested time and effort into this programme. Don't let a temporary setback derail your progress. You can do this! 💪

© {{currentYear}} Lavelle Institute`;

  return {
    subject,
    html,
    text: renderTemplate(text, variables),
  };
}
