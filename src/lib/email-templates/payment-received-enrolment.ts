import { renderTemplate } from '../email-utils';

export interface PaymentReceivedEnrolmentVariables {
  firstName: string;
  programmeName: string;
  amountPaid: string;
  paymentDate: string;
  transactionId: string;
  paymentMethod: string;
  tier: string;
  programmeAccessUrl: string;
  invoiceUrl: string;
  supportEmail: string;
  currentYear: number;
}

export function generatePaymentReceivedEnrolmentEmail(variables: PaymentReceivedEnrolmentVariables) {
  const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Received</title>
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
                            <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; font-weight: 600; line-height: 1.6;">Thank you for your payment. Your transaction has been processed successfully.</p>
                            <h3 style="margin: 20px 0 15px 0; color: #1a1a1a; font-size: 15px; font-weight: 700;">Payment Confirmation:</h3>
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 25px 0;">
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Programme:</strong> {{programmeName}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Amount paid:</strong> ₦{{amountPaid}} NGN</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Payment date:</strong> {{paymentDate}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Transaction ID:</strong> {{transactionId}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Method:</strong> {{paymentMethod}}</td>
                                </tr>
                            </table>
                            <h3 style="margin: 20px 0 15px 0; color: #1a1a1a; font-size: 15px; font-weight: 700;">What's next:</h3>
                            <p style="margin: 0 0 15px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">Your enrolment in <strong>{{programmeName}}</strong> ({{tier}}) is now active. You have immediate access to:</p>
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 25px 0;">
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">✓ Full programme syllabus and schedule</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">✓ Week 1 materials (lectures, resources)</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">✓ Your study dashboard and deadlines</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">✓ Faculty contact and support</td>
                                </tr>
                            </table>
                            <table cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                                <tr>
                                    <td style="background-color: #1668e3; border-radius: 4px; padding: 0;">
                                        <a href="{{programmeAccessUrl}}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 4px; background-color: #1668e3;">Access Your Programme Now</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">Your <a href="{{invoiceUrl}}" style="color: #1668e3; text-decoration: none;">invoice</a> has been emailed separately. Keep it for your records (many firms reimburse professional development).</p>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Questions?</strong> Reply to this email or contact <a href="mailto:{{supportEmail}}" style="color: #1668e3; text-decoration: none;">{{supportEmail}}</a>.</p>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 15px; line-height: 1.6;">Welcome aboard.</p>
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

Thank you for your payment. Your transaction has been processed successfully.

PAYMENT CONFIRMATION
Programme: {{programmeName}}
Amount paid: ₦{{amountPaid}} NGN
Payment date: {{paymentDate}}
Transaction ID: {{transactionId}}
Method: {{paymentMethod}}

WHAT'S NEXT

Your enrolment in {{programmeName}} ({{tier}}) is now active. You have immediate access to:

✓ Full programme syllabus and schedule
✓ Week 1 materials (lectures, resources)
✓ Your study dashboard and deadlines
✓ Faculty contact and support

Access Your Programme Now: {{programmeAccessUrl}}

Your invoice has been emailed separately. Keep it for your records (many firms reimburse professional development): {{invoiceUrl}}

Questions? Reply to this email or contact {{supportEmail}}.

Welcome aboard.

Best regards,
The Lavelle Institute

---

© {{currentYear}} Lavelle Institute of Legal Studies. All rights reserved.`;

  return {
    subject: 'Payment Received — {{programmeName}} Enrolment',
    html: renderTemplate(htmlTemplate, variables),
    text: renderTemplate(textTemplate, variables),
  };
}
