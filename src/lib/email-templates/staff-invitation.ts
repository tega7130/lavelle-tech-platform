import { renderTemplate } from "@/lib/email-utils";
import { EMAIL_CONFIG } from "@/lib/email-config";

export interface StaffInvitationVariables {
  staffFirstName: string;
  staffLastName: string;
  role: string;
  roleDescription: string;
  setPasswordUrl: string;
  supportEmail: string;
  currentYear: number;
}

export function generateStaffInvitationEmail(variables: StaffInvitationVariables) {
  const subject = renderTemplate(
    "You're Invited to Join Lavelle Institute — {{role}}",
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
    .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.95; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .role-box { background: white; padding: 25px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #11998e; }
    .role-title { font-size: 20px; font-weight: 600; color: #11998e; margin-bottom: 10px; }
    .role-desc { color: #666; font-size: 15px; line-height: 1.6; }
    .action-box { background: #e8f5e9; padding: 20px; border-radius: 6px; margin: 20px 0; text-align: center; }
    .action-button { display: inline-block; background: #11998e; color: white; padding: 14px 32px; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 16px; }
    .next-steps { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .step { padding: 15px 0; border-bottom: 1px solid #eee; }
    .step:last-child { border-bottom: none; }
    .step-number { display: inline-block; background: #11998e; color: white; width: 30px; height: 30px; border-radius: 50%; text-align: center; line-height: 30px; margin-right: 12px; font-weight: 600; }
    .step-text { display: inline-block; color: #333; }
    .welcome-box { background: #f0f8ff; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #0c5460; }
    .welcome-box p { margin: 0; color: #0c5460; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Lavelle Institute</h1>
      <p>You're invited to join us as {{role}}</p>
    </div>

    <div class="content">
      <p>Dear {{staffFirstName}} {{staffLastName}},</p>

      <p>We're excited to invite you to join the Lavelle Institute team as a <strong>{{role}}</strong>. Your expertise and contribution will be invaluable to our mission of delivering quality education.</p>

      <div class="role-box">
        <div class="role-title">Your Role: {{role}}</div>
        <div class="role-desc">
          {{roleDescription}}
        </div>
      </div>

      <div class="action-box">
        <p style="margin-top: 0; color: #11998e; font-weight: 600;">Get Started</p>
        <p>Set your password and access the platform:</p>
        <a href="{{setPasswordUrl}}" class="action-button">Set Password & Sign In</a>
      </div>

      <div class="next-steps">
        <p style="margin-top: 0; font-weight: 600; color: #333;">What's Next?</p>
        <div class="step">
          <span class="step-number">1</span>
          <span class="step-text"><strong>Click the button above</strong> to set your password</span>
        </div>
        <div class="step">
          <span class="step-number">2</span>
          <span class="step-text"><strong>Verify your email</strong> using the link sent to this address</span>
        </div>
        <div class="step">
          <span class="step-number">3</span>
          <span class="step-text"><strong>Sign in</strong> to the Lavelle Institute staff portal</span>
        </div>
        <div class="step">
          <span class="step-number">4</span>
          <span class="step-text"><strong>Complete your profile</strong> and familiarize yourself with the platform</span>
        </div>
      </div>

      <div class="welcome-box">
        <p><strong>Having trouble?</strong> If you experience any issues setting up your account, please reach out to our support team at <strong>{{supportEmail}}</strong>. We're here to help!</p>
      </div>

      <p>We look forward to working with you and believe you'll make a significant impact on our organization. If you have any questions about your role or the platform, don't hesitate to get in touch.</p>

      <p style="color: #999; margin-top: 30px; margin-bottom: 0;">This is an automated invitation. Your account has been created and is ready to use once you set your password.</p>

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

  const text = `Welcome to Lavelle Institute

Dear {{staffFirstName}} {{staffLastName}},

We're excited to invite you to join the Lavelle Institute team as a {{role}}.

YOUR ROLE: {{role}}

{{roleDescription}}

GET STARTED
Set your password and access the platform:
{{setPasswordUrl}}

WHAT'S NEXT?
1. Click the button above to set your password
2. Verify your email using the link sent to this address
3. Sign in to the Lavelle Institute staff portal
4. Complete your profile and familiarize yourself with the platform

HAVING TROUBLE?
If you experience any issues setting up your account, please contact {{supportEmail}}.

We look forward to working with you!

© {{currentYear}} Lavelle Institute`;

  return {
    subject,
    html,
    text: renderTemplate(text, variables),
  };
}
