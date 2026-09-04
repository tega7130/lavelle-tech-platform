import { renderTemplate } from "@/lib/email-utils";

export interface AdminPasswordResetRequestVariables {
  firstName: string;
  role: string;
  otpCode: string;
  otpExpiryMinutes: number;
  supportEmail: string;
  currentYear: number;
}

export function generateAdminPasswordResetRequestEmail(variables: AdminPasswordResetRequestVariables) {
  const subject = "Reset Your Lavelle Institute Staff Password";

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
    .otp-box { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #667eea; text-align: center; }
    .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #667eea; font-family: 'Courier New', monospace; margin: 15px 0; }
    .expiry-warning { background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107; color: #856404; }
    .security-tips { background: #e8f4f8; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .security-tips h3 { margin-top: 0; color: #0c5460; }
    .security-tip { padding: 8px 0; color: #0c5460; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reset Your Password</h1>
      <p>Lavelle Institute Staff Account</p>
    </div>

    <div class="content">
      <p>Hi {{firstName}},</p>

      <p>You requested to reset your password for your {{role}} account at Lavelle Institute. Use the code below to verify your email and set a new password.</p>

      <div class="otp-box">
        <p><strong>Your verification code is:</strong></p>
        <div class="otp-code">{{otpCode}}</div>
        <p style="margin: 10px 0; color: #666; font-size: 14px;">Enter this code in the password reset form</p>
      </div>

      <div class="expiry-warning">
        <strong>⏰ This code expires in {{otpExpiryMinutes}} minutes</strong>
        <p>If you didn't request this reset, you can safely ignore this email. Your account remains secure with your current password.</p>
      </div>

      <div class="security-tips">
        <h3>🔒 Password Security Tips</h3>
        <div class="security-tip">✓ Use a strong, unique password at least 12 characters long</div>
        <div class="security-tip">✓ Include a mix of uppercase, lowercase, numbers, and symbols</div>
        <div class="security-tip">✓ Avoid using personal information or common words</div>
        <div class="security-tip">✓ Never share your password with anyone</div>
      </div>

      <p><strong>Need help?</strong> If you didn't request this password reset or have questions, please contact us at <strong>{{supportEmail}}</strong>.</p>

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

  const text = `Reset Your Password

Hi {{firstName}},

You requested to reset your password for your {{role}} account at Lavelle Institute.

Your verification code is:

  {{otpCode}}

Enter this code in the password reset form.

⏰ IMPORTANT: This code expires in {{otpExpiryMinutes}} minutes

If you didn't request this reset, you can safely ignore this email. Your account remains secure with your current password.

PASSWORD SECURITY TIPS
✓ Use a strong, unique password at least 12 characters long
✓ Include a mix of uppercase, lowercase, numbers, and symbols
✓ Avoid using personal information or common words
✓ Never share your password with anyone

Questions? Contact {{supportEmail}}.

© {{currentYear}} Lavelle Institute`;

  return {
    subject,
    html,
    text: renderTemplate(text, variables),
  };
}
