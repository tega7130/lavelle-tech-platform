import { renderTemplate } from '../email-utils';

export interface AccountWelcomeVariables {
  firstName: string;
  exploreProgrammesUrl: string;
  currentYear: number;
}

export function generateAccountWelcomeEmail(variables: AccountWelcomeVariables) {
  const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Lavelle</title>
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
                            <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">Hi {{firstName}},</p>
                            <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 22px; font-weight: 700; line-height: 1.4;">Welcome to Lavelle. Your journey starts here.</h2>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 15px; line-height: 1.6;">You've taken the first step towards building deeper expertise, developing your professional edge, and becoming known for what you do best.</p>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 15px; line-height: 1.6;">Your Lavelle account is now ready, giving you access to explore our programmes and discover the specialisations that align with your ambitions.</p>
                            <h3 style="margin: 20px 0 15px 0; color: #1a1a1a; font-size: 16px; font-weight: 700;">What's next?</h3>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 15px; line-height: 1.6;">Explore our programmes, find your area of interest, and choose the path that feels right for where you want your legal career to go.</p>
                            <p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 15px; line-height: 1.6;">Your next level could be closer than you think.</p>
                            <table cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                                <tr>
                                    <td style="background-color: #1668e3; border-radius: 4px; padding: 0;">
                                        <a href="{{exploreProgrammesUrl}}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 4px; background-color: #1668e3;">Explore Programmes</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 15px; line-height: 1.6;">We're excited to have you with us.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; line-height: 1.5;">The Lavelle Team</p>
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

Welcome to Lavelle. Your journey starts here.

You've taken the first step towards building deeper expertise, developing your professional edge, and becoming known for what you do best.

Your Lavelle account is now ready, giving you access to explore our programmes and discover the specialisations that align with your ambitions.

What's next?

Explore our programmes, find your area of interest, and choose the path that feels right for where you want your legal career to go.

Your next level could be closer than you think.

Explore Programmes: {{exploreProgrammesUrl}}

We're excited to have you with us.

The Lavelle Team

---

© {{currentYear}} Lavelle Institute of Legal Studies. All rights reserved.`;

  return {
    subject: 'Welcome to Lavelle – Your journey starts here',
    html: renderTemplate(htmlTemplate, variables),
    text: renderTemplate(textTemplate, variables),
  };
}
