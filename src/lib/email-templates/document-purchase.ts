import { renderTemplate } from '../email-utils';

export interface DocumentPurchaseVariables {
  firstName: string;
  documentName: string;
  amount: string;
  purchaseDate: string;
  transactionId: string;
  candidatePortalUrl: string;
  currentYear: number;
}

export function generateDocumentPurchaseEmail(variables: DocumentPurchaseVariables) {
  const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Purchase Confirmed</title>
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
                            <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; font-weight: 600; line-height: 1.6;">Thank you for your purchase. Your transaction has been processed successfully.</p>
                            <h3 style="margin: 20px 0 15px 0; color: #1a1a1a; font-size: 15px; font-weight: 700;">Purchase Confirmation:</h3>
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 25px 0;">
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Document:</strong> {{documentName}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Price:</strong> ₦{{amount}} NGN</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Purchase date:</strong> {{purchaseDate}}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Transaction ID:</strong> {{transactionId}}</td>
                                </tr>
                            </table>
                            <h3 style="margin: 20px 0 15px 0; color: #1a1a1a; font-size: 15px; font-weight: 700;">What's next:</h3>
                            <p style="margin: 0 0 15px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">Your document is ready to download. Access it anytime from your Lavelle portal under "Document Library":</p>
                            <table cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                                <tr>
                                    <td style="background-color: #1668e3; border-radius: 4px; padding: 0;">
                                        <a href="{{candidatePortalUrl}}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 4px; background-color: #1668e3;">Visit Candidate Portal</a>
                                    </td>
                                </tr>
                            </table>
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 25px 0;">
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">✓ Save a copy to your device for offline access</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">✓ Documents can be downloaded multiple times</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">✓ Check your email regularly for updates on related resources</td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;"><strong>Questions?</strong> Contact <a href="mailto:candidates@learnlavelle.com" style="color: #1668e3; text-decoration: none;">candidates@learnlavelle.com</a>. Our team is here to help.</p>
                            <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 15px; line-height: 1.6;">Your investment in professional development is secure. Enjoy your document.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; line-height: 1.5;">Best regards,</p>
                            <p style="margin: 0 0 15px 0; color: #666666; font-size: 14px; font-weight: 600; line-height: 1.5;">The Lavelle Institute</p>
                            <p style="margin: 0 0 10px 0; color: #999999; font-size: 12px; line-height: 1.5;">
                                This is an automated email. Please do not reply to this message.
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

  const textTemplate = `Hi {{firstName}},

Thank you for your purchase. Your transaction has been processed successfully.

PURCHASE CONFIRMATION

Document: {{documentName}}
Price: ₦{{amount}} NGN
Purchase date: {{purchaseDate}}
Transaction ID: {{transactionId}}

WHAT'S NEXT

Your document is ready to download. Access it anytime from your Lavelle portal under "Document Library":

Visit Candidate Portal: {{candidatePortalUrl}}

Tips:
✓ Save a copy to your device for offline access
✓ Documents can be downloaded multiple times
✓ Check your email regularly for updates on related resources

QUESTIONS?

Contact candidates@learnlavelle.com if you have any questions. Our team is here to help.

Your investment in professional development is secure. Enjoy your document.

Best regards,
The Lavelle Institute

---

This is an automated email. Please do not reply to this message.

© {{currentYear}} Lavelle Institute of Legal Studies. All rights reserved.`;

  return {
    subject: 'Document Purchase Confirmed — {{documentName}}',
    html: renderTemplate(htmlTemplate, variables),
    text: renderTemplate(textTemplate, variables),
  };
}
