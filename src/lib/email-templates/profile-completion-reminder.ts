import { renderTemplate } from "@/lib/email-utils";

export interface ProfileCompletionReminderVariables {
  firstName: string;
  profileCompletionUrl: string;
  supportEmail: string;
  currentYear: number;
}

export function generateProfileCompletionReminderEmail(variables: ProfileCompletionReminderVariables) {
  const subject = "Complete Your Profile — Lavelle Institute";

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
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #667eea; }
    .info-box strong { color: #667eea; }
    .checklist { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .checklist-item { padding: 10px 0; border-bottom: 1px solid #eee; display: flex; align-items: center; }
    .checklist-item:last-child { border-bottom: none; }
    .checkbox { width: 24px; height: 24px; border: 2px solid #ddd; border-radius: 4px; margin-right: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .action-button { display: inline-block; background: #667eea; color: white; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .benefit-box { background: #e8f4f8; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .benefit-box h3 { margin-top: 0; color: #0c5460; }
    .benefit-item { padding: 8px 0; color: #0c5460; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Hi {{firstName}}</h1>
      <p>Complete Your Profile</p>
    </div>

    <div class="content">
      <p>Welcome to Lavelle Institute! We noticed that your profile isn't quite complete yet.</p>

      <div class="info-box">
        <p>Completing your profile helps us provide you with a more personalized learning experience and ensures your records are up-to-date.</p>
      </div>

      <p><strong>What's Missing?</strong></p>
      <div class="checklist">
        <div class="checklist-item">
          <div class="checkbox">☐</div>
          <div>Profile photo</div>
        </div>
        <div class="checklist-item">
          <div class="checkbox">☐</div>
          <div>Contact information</div>
        </div>
        <div class="checklist-item">
          <div class="checkbox">☐</div>
          <div>Professional background</div>
        </div>
        <div class="checklist-item">
          <div class="checkbox">☐</div>
          <div>Learning goals</div>
        </div>
      </div>

      <a href="{{profileCompletionUrl}}" class="action-button">Complete Your Profile Now</a>

      <div class="benefit-box">
        <h3>Why Complete Your Profile?</h3>
        <div class="benefit-item">✓ Better personalized learning recommendations</div>
        <div class="benefit-item">✓ Access to full platform features</div>
        <div class="benefit-item">✓ Accurate record-keeping and certificate issuance</div>
        <div class="benefit-item">✓ Network with other professionals</div>
      </div>

      <p>If you have any questions or need assistance, please contact us at <strong>{{supportEmail}}</strong>.</p>

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

  const text = `Complete Your Profile

Hi {{firstName}},

Welcome to Lavelle Institute! We noticed that your profile isn't quite complete yet.

WHAT'S MISSING?
☐ Profile photo
☐ Contact information
☐ Professional background
☐ Learning goals

WHY COMPLETE YOUR PROFILE?
• Better personalized learning recommendations
• Access to full platform features
• Accurate record-keeping and certificate issuance
• Network with other professionals

Complete Your Profile: {{profileCompletionUrl}}

Questions? Contact {{supportEmail}}.

© {{currentYear}} Lavelle Institute`;

  return {
    subject,
    html,
    text: renderTemplate(text, variables),
  };
}
