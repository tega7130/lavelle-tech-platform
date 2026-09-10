import { renderTemplate } from '../email-utils';

export interface ProgrammeComingSoonLiveVariables {
  programmeName: string;
  programmeUrl: string;
  unsubscribeUrl: string;
  currentYear: number;
}

export function generateProgrammeComingSoonLiveEmail(variables: ProgrammeComingSoonLiveVariables) {
  const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{programmeName}} is now open for enrolment</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f5f5f5;">
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 20px;">
                <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding: 40px 30px; background-color: #ffffff; text-align: center; border-bottom: 3px solid #1668e3;">
                            <img src="${process.env.NEXTAUTH_URL}/Images/lavelle-logo.png" alt="Lavelle Institute of Legal Studies" width="140" style="display: block; border: 0; outline: none; text-decoration: none; width: 140px; max-width: 140px; height: auto; margin: 0 auto;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; font-weight: 600; line-height: 1.6;">The programme you were waiting for is now live.</p>
                            <p style="margin: 0 0 25px 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;"><strong>{{programmeName}}</strong> is open for enrolment.</p>
                            <table cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                                <tr>
                                    <td style="background-color: #1668e3; border-radius: 4px; padding: 0;">
                                        <a href="{{programmeUrl}}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 4px; background-color: #1668e3;">View Programme</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">Enrolment is first-come, first-served — take a look while it's fresh.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; line-height: 1.5;">Best regards,</p>
                            <p style="margin: 0 0 15px 0; color: #666666; font-size: 14px; font-weight: 600; line-height: 1.5;">The Lavelle Institute</p>
                            <p style="margin: 0 0 15px 0; color: #999999; font-size: 12px; line-height: 1.5;">
                                <a href="{{unsubscribeUrl}}" style="color: #999999; text-decoration: underline;">Unsubscribe from this notification</a>
                            </p>
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

  const textTemplate = `The programme you were waiting for is now live.

{{programmeName}} is open for enrolment.

View Programme: {{programmeUrl}}

Enrolment is first-come, first-served — take a look while it's fresh.

Best regards,
The Lavelle Institute

---

Unsubscribe from this notification: {{unsubscribeUrl}}

© {{currentYear}} Lavelle Institute of Legal Studies. All rights reserved.`;

  return {
    subject: '{{programmeName}} is now open for enrolment',
    html: renderTemplate(htmlTemplate, variables),
    text: renderTemplate(textTemplate, variables),
  };
}
