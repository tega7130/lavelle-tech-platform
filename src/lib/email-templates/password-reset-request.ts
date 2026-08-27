import { renderTemplate } from '../email-utils';

export interface PasswordResetRequestVariables {
  firstName: string;
  resetPasswordUrl: string;
  supportEmail: string;
  currentYear: number;
}

export function generatePasswordResetRequestEmail(variables: PasswordResetRequestVariables) {
  const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Lavelle Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f5f5f5;">
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 20px;">
                <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding: 40px 30px; background-color: #ffffff; text-align: center; border-bottom: 3px solid #1668e3;">
                            <img src="https://lavelle-tech-platform-5c3rx1wnp-tega-odias-projects.vercel.app/Images/lavelle-logo.png" alt="Lavelle Institute of Legal Studies" width="140" style="display: block; border: 0; outline: none; text-decoration: none; width: 140px; max-width: 140px; height: auto; margin: 0 auto;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">Hi {{firstName}},</p>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 15px; line-height: 1.6;">We received a request to reset the password for your Lavelle account. If this wasn't you, you can safely ignore this email — your password hasn't changed.</p>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 15px; line-height: 1.6;">To reset your password, click the link below:</p>
                            <table cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                                <tr>
                                    <td style="background-color: #1668e3; border-radius: 4px; padding: 0;">
                                        <a href="{{resetPasswordUrl}}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 4px; background-color: #1668e3;">Reset Password</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">This link expires in 1 hour. After resetting, you'll be able to sign in with your new password right away.</p>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">For security reasons, we never share passwords via email. If you have any concerns about your account, contact us at <a href="mailto:{{supportEmail}}" style="color: #1668e3; text-decoration: none;">{{supportEmail}}</a>.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; line-height: 1.5;">Best regards,</p>
                            <p style="margin: 0 0 15px 0; color: #666666; font-size: 14px; line-height: 1.5;">The Lavelle Institute</p>
                            <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.5;">
                                &copy; {{currentYear}} Lavelle Institute of Legal Studies. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

  const textTemplate = `Hi {{firstName}},

We received a request to reset the password for your Lavelle account. If this wasn't you, you can safely ignore this email — your password hasn't changed.

To reset your password, click the link below:

{{resetPasswordUrl}}

This link expires in 1 hour. After resetting, you'll be able to sign in with your new password right away.

For security reasons, we never share passwords via email. If you have any concerns about your account, contact us at {{supportEmail}}.

Best regards,
The Lavelle Institute

---

© {{currentYear}} Lavelle Institute of Legal Studies. All rights reserved.`;

  return {
    subject: 'Reset Your Lavelle Password',
    html: renderTemplate(htmlTemplate, variables),
    text: renderTemplate(textTemplate, variables),
  };
}
