import { renderTemplate, escapeHtml } from '../email-utils';

export interface SupportReplyVariables {
  firstName: string;
  originalMessage: string;
  replyMessage: string;
  supportEmail: string;
  currentYear: number;
}

export function generateSupportReplyEmail(variables: SupportReplyVariables) {
  const htmlVariables = {
    ...variables,
    originalMessage: escapeHtml(variables.originalMessage).replace(/\n/g, '<br>'),
    replyMessage: escapeHtml(variables.replyMessage).replace(/\n/g, '<br>'),
  };

  const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reply to Your Enquiry</title>
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
                            <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">Thank you for reaching out to Lavelle Institute. Here's a reply to your message:</p>
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 25px 0; background-color: #f0f5ff; border-radius: 6px; border-left: 3px solid #1668e3;">
                                <tr>
                                    <td style="padding: 16px 20px; color: #1a1a1a; font-size: 14px; line-height: 1.6;">{{replyMessage}}</td>
                                </tr>
                            </table>
                            <h4 style="margin: 20px 0 12px 0; color: #1a1a1a; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Your Original Message</h4>
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 25px 0; background-color: #f9f9f9; border-radius: 6px;">
                                <tr>
                                    <td style="padding: 16px 20px; color: #6a6a6a; font-size: 13px; line-height: 1.6; font-style: italic;">{{originalMessage}}</td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">If you have any further questions, just reply to this email and we'll get back to you.</p>
                            <p style="margin: 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">Best regards,<br>The Lavelle Institute</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #666666; font-size: 13px; line-height: 1.5;">Questions? Contact <a href="mailto:{{supportEmail}}" style="color: #1668e3; text-decoration: none;">{{supportEmail}}</a></p>
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

Thank you for reaching out to Lavelle Institute. Here's a reply to your message:

"{{replyMessage}}"

YOUR ORIGINAL MESSAGE
"{{originalMessage}}"

If you have any further questions, just reply to this email and we'll get back to you.

Best regards,
The Lavelle Institute

---

© {{currentYear}} Lavelle Institute of Legal Studies. All rights reserved.`;

  return {
    subject: 'Re: Your enquiry to Lavelle Institute',
    html: renderTemplate(htmlTemplate, htmlVariables),
    text: renderTemplate(textTemplate, variables),
  };
}
