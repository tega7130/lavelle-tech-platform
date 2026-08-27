import { renderTemplate } from '../email-utils';

export interface EnrolmentConfirmationVariables {
  firstName: string;
  programmeName: string;
  tier: string;
  duration: string;
  weeklyCommitment: string;
  startDate: string;
  lectureCount: number;
  portalUrl: string;
  supportEmail: string;
  currentYear: number;
}

export function generateEnrolmentConfirmationEmail(variables: EnrolmentConfirmationVariables) {
  const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Congratulations — You're Now Enrolled</title>
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
                            <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; font-weight: 600; line-height: 1.6;">You're in! Your enrolment in <strong>{{programmeName}}</strong> ({{tier}}) is confirmed and active.</p>
                            <h3 style="margin: 25px 0 15px 0; color: #1a1a1a; font-size: 15px; font-weight: 700;">Your learning journey begins now:</h3>
                            <h4 style="margin: 20px 0 12px 0; color: #1a1a1a; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Programme Details</h4>
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 20px 0;">
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Duration:</strong> {{duration}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Commitment:</strong> {{weeklyCommitment}} per week</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Start date:</strong> {{startDate}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Access:</strong> 24/7 via your Lavelle portal</td>
                                </tr>
                            </table>
                            <h4 style="margin: 20px 0 12px 0; color: #1a1a1a; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">What's Included</h4>
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 25px 0;">
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">✓ {{lectureCount}} recorded lectures with narration</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">✓ Applied scenarios and drafting exercises</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">✓ Quiz assessments</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">✓ Certificate upon passing</td>
                                </tr>
                            </table>
                            <h3 style="margin: 25px 0 15px 0; color: #1a1a1a; font-size: 15px; font-weight: 700;">Ready to start?</h3>
                            <table cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                                <tr>
                                    <td style="background-color: #1668e3; border-radius: 4px; padding: 0;">
                                        <a href="{{portalUrl}}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 4px; background-color: #1668e3;">Access Your Programme</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 15px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">Log in to your portal to:</p>
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 25px 0;">
                                <tr>
                                    <td style="padding: 6px 0 6px 20px; color: #4a4a4a; font-size: 14px; line-height: 1.6; border-left: 3px solid #1668e3;">Review the full syllabus, week by week</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0 6px 20px; color: #4a4a4a; font-size: 14px; line-height: 1.6; border-left: 3px solid #1668e3;">Meet your faculty</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0 6px 20px; color: #4a4a4a; font-size: 14px; line-height: 1.6; border-left: 3px solid #1668e3;">Set up your study calendar</td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Questions?</strong> Reply to this email or contact <a href="mailto:{{supportEmail}}" style="color: #1668e3; text-decoration: none;">{{supportEmail}}</a>. Our team is here to support you.</p>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 15px; line-height: 1.6;">We're excited to have you in this cohort. Let's build your expertise.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; line-height: 1.5;">Best regards,</p>
                            <p style="margin: 0 0 15px 0; color: #666666; font-size: 14px; font-weight: 600; line-height: 1.5;">The Lavelle Institute</p>
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

You're in! Your enrolment in {{programmeName}} ({{tier}}) is confirmed and active.

Your learning journey begins now:

PROGRAMME DETAILS
Duration: {{duration}}
Commitment: {{weeklyCommitment}} per week
Start date: {{startDate}}
Access: 24/7 via your Lavelle portal

WHAT'S INCLUDED
✓ {{lectureCount}} recorded lectures with narration
✓ Applied scenarios and drafting exercises
✓ Quiz assessments
✓ Certificate upon passing

Ready to start?

Access Your Programme: {{portalUrl}}

Log in to your portal to:
- Review the full syllabus, week by week
- Meet your faculty
- Set up your study calendar

Questions? Reply to this email or contact {{supportEmail}}. Our team is here to support you.

We're excited to have you in this cohort. Let's build your expertise.

Best regards,
The Lavelle Institute

---

© {{currentYear}} Lavelle Institute of Legal Studies. All rights reserved.`;

  return {
    subject: 'Congratulations — You\'re Now Enrolled in {{programmeName}}',
    html: renderTemplate(htmlTemplate, variables),
    text: renderTemplate(textTemplate, variables),
  };
}
