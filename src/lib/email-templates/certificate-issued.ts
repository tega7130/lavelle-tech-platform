import { renderTemplate } from "@/lib/email-utils";

export interface CertificateIssuedVariables {
  firstName: string;
  programmeName: string;
  tier: string;
  grade: string;
  certificateId: string;
  issueDate: string;
  certificateDownloadUrl: string;
  certificateVerificationUrl: string;
  supportEmail: string;
  currentYear: number;
}

export function generateCertificateIssuedEmail(variables: CertificateIssuedVariables) {
  const subject = renderTemplate(
    "Certificate Awarded — {{programmeName}}, {{tier}}",
    variables
  );

  const html = renderTemplate(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.95; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .achievement { background: white; padding: 25px; border-radius: 6px; margin: 20px 0; text-align: center; border: 2px solid #11998e; }
    .achievement-icon { font-size: 48px; margin-bottom: 10px; }
    .certificate-details { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { font-weight: 600; color: #666; }
    .detail-value { color: #333; }
    .action-buttons { margin: 20px 0; text-align: center; }
    .primary-btn { display: inline-block; background: #11998e; color: white; padding: 12px 28px; border-radius: 4px; text-decoration: none; margin: 0 10px 10px 0; font-weight: 600; }
    .secondary-btn { display: inline-block; background: #f0f0f0; color: #333; padding: 12px 28px; border-radius: 4px; text-decoration: none; margin: 0 10px 10px 0; font-weight: 600; }
    .verification-info { background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 14px; }
    .verification-info strong { color: #2e7d32; }
    .sharing { background: #f3e5f5; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .sharing h3 { margin-top: 0; color: #6a1b9a; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="achievement-icon">🎓</div>
      <h1>Congratulations!</h1>
      <p>Your Certificate Has Been Awarded</p>
    </div>

    <div class="content">
      <p>Hi {{firstName}},</p>

      <p>We are delighted to inform you that your certificate for the <strong>{{programmeName}}</strong> programme has been officially awarded and is now available for download.</p>

      <div class="achievement">
        <p style="margin: 0; font-size: 18px; color: #11998e; font-weight: 600;">
          {{programmeName}}
        </p>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
          {{tier}} | Grade: <strong>{{grade}}</strong>
        </p>
      </div>

      <div class="certificate-details">
        <div class="detail-row">
          <div class="detail-label">Programme:</div>
          <div class="detail-value">{{programmeName}} ({{tier}})</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Grade Awarded:</div>
          <div class="detail-value"><strong>{{grade}}</strong></div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Issue Date:</div>
          <div class="detail-value">{{issueDate}}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Certificate ID:</div>
          <div class="detail-value"><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">{{certificateId}}</code></div>
        </div>
      </div>

      <div class="action-buttons">
        <a href="{{certificateDownloadUrl}}" class="primary-btn">📥 Download Certificate</a>
        <a href="{{certificateVerificationUrl}}" class="secondary-btn">🔐 Verify Certificate</a>
      </div>

      <div class="verification-info">
        <strong>Certificate Security:</strong> Your certificate includes a unique identifier that allows employers and institutions to verify its authenticity directly from our records. Share the verification link with confidence.
      </div>

      <div class="sharing">
        <h3>Share Your Achievement</h3>
        <p>You can now confidently share this certificate with employers, educational institutions, or on professional networks. Each certificate includes a unique ID for instant verification.</p>
      </div>

      <p>If you have any questions about your certificate or need assistance, please contact us at <strong>{{supportEmail}}</strong>.</p>

      <p style="color: #999; font-size: 13px;">
        Keep your certificate safe. You can download it at any time from your account portal.
      </p>

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

  const text = `Congratulations! Your Certificate Has Been Awarded

Hi {{firstName}},

Your certificate for {{programmeName}} ({{tier}}) has been officially awarded.

Programme: {{programmeName}} ({{tier}})
Grade: {{grade}}
Issue Date: {{issueDate}}
Certificate ID: {{certificateId}}

Download your certificate: {{certificateDownloadUrl}}

Verify your certificate: {{certificateVerificationUrl}}

You can share your certificate with employers and institutions. Each certificate includes a unique ID for verification.

For questions, contact {{supportEmail}}.

© {{currentYear}} Lavelle Institute`;

  return {
    subject,
    html,
    text: renderTemplate(text, variables),
  };
}
