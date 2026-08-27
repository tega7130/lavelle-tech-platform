import { renderTemplate } from '../email-utils';

export interface ExamRegistrationConfirmedVariables {
  firstName: string;
  programmeName: string;
  tier: string;
  examDate: string;
  examDuration: string;
  admissionSlipUrl: string;
  examRulesUrl: string;
  supportEmail: string;
  currentYear: number;
}

export function generateExamRegistrationConfirmedEmail(variables: ExamRegistrationConfirmedVariables) {
  const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exam Registration Confirmed</title>
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
                            <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; font-weight: 600; line-height: 1.6;">You're registered. Your <strong>certifying examination</strong> for <strong>{{programmeName}}</strong> is confirmed.</p>
                            <h3 style="margin: 20px 0 15px 0; color: #1a1a1a; font-size: 15px; font-weight: 700;">Exam Details:</h3>
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 25px 0;">
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Programme:</strong> {{programmeName}} ({{tier}})</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Date:</strong> {{examDate}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Format:</strong> Online</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Duration:</strong> {{examDuration}}</td>
                                </tr>
                            </table>
                            <h3 style="margin: 20px 0 15px 0; color: #1a1a1a; font-size: 15px; font-weight: 700;">Before exam day:</h3>
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 25px 0;">
                                <tr>
                                    <td style="padding: 12px 0; vertical-align: top;">
                                        <span style="display: inline-block; width: 24px; color: #1668e3; font-weight: 700; font-size: 14px;">1.</span>
                                        <span style="display: inline-block; vertical-align: top; width: calc(100% - 32px); color: #4a4a4a; font-size: 14px; line-height: 1.6;"><a href="{{admissionSlipUrl}}" style="color: #1668e3; text-decoration: none; font-weight: 600;">Download your admission slip</a> from the candidate portal</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 0; vertical-align: top;">
                                        <span style="display: inline-block; width: 24px; color: #1668e3; font-weight: 700; font-size: 14px;">2.</span>
                                        <span style="display: inline-block; vertical-align: top; width: calc(100% - 32px); color: #4a4a4a; font-size: 14px; line-height: 1.6;"><a href="{{examRulesUrl}}" style="color: #1668e3; text-decoration: none; font-weight: 600;">Review the exam rules</a> — no phones, notes, etc.</span>
                                    </td>
                                </tr>
                            </table>
                            <h3 style="margin: 20px 0 15px 0; color: #1a1a1a; font-size: 15px; font-weight: 700;">Can't make it?</h3>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">If you need to reschedule due to genuine reasons, contact <a href="mailto:{{supportEmail}}" style="color: #1668e3; text-decoration: none;">{{supportEmail}}</a> at least 5 days before your exam. Rescheduling fees may apply.</p>
                            <h3 style="margin: 20px 0 15px 0; color: #1a1a1a; font-size: 15px; font-weight: 700;">Final thought:</h3>
                            <p style="margin: 0 0 15px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">You've completed weeks of study, scenarios, quizzes, and feedback. You know this material. Trust your preparation and show the examiner what you've learned.</p>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">We're confident in you.</p>
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

You're registered. Your certifying examination for {{programmeName}} is confirmed.

EXAM DETAILS
Programme: {{programmeName}} ({{tier}})
Date: {{examDate}}
Format: Online
Duration: {{examDuration}}

BEFORE EXAM DAY

1. Download your admission slip from the candidate portal: {{admissionSlipUrl}}

2. Review the exam rules — no phones, notes, etc.: {{examRulesUrl}}

CAN'T MAKE IT?

If you need to reschedule due to genuine reasons, contact {{supportEmail}} at least 5 days before your exam. Rescheduling fees may apply.

FINAL THOUGHT

You've completed weeks of study, scenarios, quizzes, and feedback. You know this material. Trust your preparation and show the examiner what you've learned.

We're confident in you.

Best regards,
The Lavelle Institute

---

© {{currentYear}} Lavelle Institute of Legal Studies. All rights reserved.`;

  return {
    subject: 'Exam Registration Confirmed — {{programmeName}}, {{examDate}}',
    html: renderTemplate(htmlTemplate, variables),
    text: renderTemplate(textTemplate, variables),
  };
}
