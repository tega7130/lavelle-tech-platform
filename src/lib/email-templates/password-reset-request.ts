import { renderTemplate } from '../email-utils';

export interface PasswordResetRequestVariables {
  firstName: string;
  otpCode: string;
  otpExpiryMinutes: number;
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
                            <img src="${process.env.NEXTAUTH_URL}/images/lavelle-logo.png" alt="Lavelle Institute of Legal Studies" width="140" style="display: block; border: 0; outline: none; text-decoration: none; width: 140px; max-width: 140px; height: auto; margin: 0 auto;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">Hi {{firstName}},</p>
                            <p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 15px; line-height: 1.6;">We received a request to reset the password for your Lavelle account. If this wasn't you, you can safely ignore this email — your password hasn't changed.</p>
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 30px 0; background-color: #f0f4f8; border-radius: 6px; border: 1px solid #e5e5e5;">
                                <tr>
                                    <td style="padding: 20px; text-align: center;">
                                        <p style="margin: 0 0 10px 0; color: #666666; font-size: 13px; line-height: 1.4; text-transform: uppercase; letter-spacing: 1px;">Your password reset code</p>
                                        <p style="margin: 0; color: #1668e3; font-size: 32px; font-weight: 700; letter-spacing: 4px; font-family: 'Courier New', monospace;">{{otpCode}}</p>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">Enter this code on the password reset page to continue, then choose a new password.</p>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">This code expires in {{otpExpiryMinutes}} minutes. After resetting, you'll be signed out of any other devices and can sign in with your new password right away.</p>
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

Your password reset code:

{{otpCode}}

Enter this code on the password reset page to continue, then choose a new password.

This code expires in {{otpExpiryMinutes}} minutes. After resetting, you'll be signed out of any other devices and can sign in with your new password right away.

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
