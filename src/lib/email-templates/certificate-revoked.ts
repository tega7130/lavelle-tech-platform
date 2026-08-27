import { renderTemplate } from "@/lib/email-utils";
import { EMAIL_CONFIG } from "@/lib/email-config";

export interface CertificateRevokedVariables {
  firstName: string;
  programmeName: string;
  tier: string;
  certificateId: string;
  revocationReason: string;
  appealDeadlineDate: string;
  appealInstructionsUrl: string;
  supportEmail: string;
  securityContactEmail: string;
  currentYear: number;
}

export function generateCertificateRevokedEmail(variables: CertificateRevokedVariables) {
  const subject = renderTemplate(
    "Certificate Status Update — {{programmeName}}",
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
    .header { background: #f8f9fa; padding: 20px; border-radius: 8px 8px 0 0; border-left: 4px solid #dc3545; }
    .header h1 { margin: 0; font-size: 24px; color: #dc3545; }
    .content { background: #fff; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none; }
    .alert-box { background: #fff5f5; border-left: 4px solid #dc3545; padding: 20px; border-radius: 4px; margin: 20px 0; }
    .alert-title { font-weight: 600; color: #dc3545; margin-bottom: 10px; }
    .reason-box { background: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #fd7e14; }
    .reason-label { font-weight: 600; color: #fd7e14; margin-bottom: 8px; }
    .action-box { background: #e8f4f8; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .action-box h3 { margin-top: 0; color: #0c5460; }
    .action-box p { margin: 10px 0; }
    .appeal-button { display: inline-block; background: #0c5460; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: 600; margin: 15px 0; }
    .timeline { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .timeline-item { padding: 15px 0; border-bottom: 1px solid #eee; }
    .timeline-item:last-child { border-bottom: none; }
    .timeline-date { font-weight: 600; color: #0c5460; }
    .timeline-desc { color: #666; margin-top: 5px; }
    .important { background: #ffe0e0; padding: 15px; border-radius: 6px; margin: 20px 0; font-weight: 600; color: #c00; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
    .support-links { background: #f0f0f0; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Certificate Status Update</h1>
    </div>

    <div class="content">
      <p>Dear {{firstName}},</p>

      <p>We are writing to inform you that your certificate for <strong>{{programmeName}} ({{tier}})</strong> has been suspended pending investigation.</p>

      <div class="alert-box">
        <div class="alert-title">What This Means</div>
        <p>Your certificate (ID: <code>{{certificateId}}</code>) is temporarily unavailable while we review the circumstances. This does not automatically mean permanent revocation — you have the right to appeal within the deadline specified below.</p>
      </div>

      <div class="reason-box">
        <div class="reason-label">Reason for Review:</div>
        <p>{{revocationReason}}</p>
      </div>

      <div class="action-box">
        <h3>📋 You Have the Right to Appeal</h3>
        <p>If you believe this decision is incorrect, or if you have evidence that contradicts the reason for review, you may submit an appeal.</p>
        <p><strong>Appeal Deadline:</strong> {{appealDeadlineDate}}</p>
        <p>After this date, you will not be able to submit an appeal.</p>
        <a href="{{appealInstructionsUrl}}" class="appeal-button">Submit an Appeal</a>
      </div>

      <div class="timeline">
        <strong>What Happens Next</strong>
        <div class="timeline-item">
          <div class="timeline-date">Now</div>
          <div class="timeline-desc">You receive this notification and review the reason</div>
        </div>
        <div class="timeline-item">
          <div class="timeline-date">By {{appealDeadlineDate}}</div>
          <div class="timeline-desc">You may submit evidence or an appeal</div>
        </div>
        <div class="timeline-item">
          <div class="timeline-date">After Appeal Review</div>
          <div class="timeline-desc">You will receive a final decision (uphold, reinstate, or modification)</div>
        </div>
      </div>

      <div class="important">
        ⚠️ Important: Do not use this certificate for any professional or educational purposes until the review is complete.
      </div>

      <div class="support-links">
        <strong>Need Help?</strong>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Learn more about the appeal process and submit evidence: <a href="{{appealInstructionsUrl}}">Appeal Instructions</a></li>
          <li>Questions about your certificate status: <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></li>
          <li>Concerns about the fairness of this decision: <a href="mailto:{{securityContactEmail}}">{{securityContactEmail}}</a></li>
        </ul>
      </div>

      <p>We understand this is concerning. Our review process is thorough and fair. If you have questions about any part of this process, please don't hesitate to contact us.</p>

      <div class="footer">
        <p>© {{currentYear}} Lavelle Institute. All rights reserved.</p>
        <p>This is an important automated message. Please review all information carefully.</p>
      </div>
    </div>
  </div>
</body>
</html>`,
    variables
  );

  const text = `Certificate Status Update

Dear {{firstName}},

We are writing to inform you that your certificate for {{programmeName}} ({{tier}}) has been suspended pending investigation.

Certificate ID: {{certificateId}}

REASON FOR REVIEW:
{{revocationReason}}

YOU HAVE THE RIGHT TO APPEAL

If you believe this decision is incorrect or have evidence that contradicts the reason, you may submit an appeal.

Appeal Deadline: {{appealDeadlineDate}}

Submit Your Appeal: {{appealInstructionsUrl}}

WHAT HAPPENS NEXT:
1. You receive this notification and review the reason
2. By {{appealDeadlineDate}} — You may submit evidence or an appeal
3. After appeal review — You will receive a final decision

IMPORTANT: Do not use this certificate for any professional or educational purposes until the review is complete.

NEED HELP?
- Appeal Process & Submit Evidence: {{appealInstructionsUrl}}
- Questions About Your Certificate: {{supportEmail}}
- Concerns About This Decision: {{securityContactEmail}}

© {{currentYear}} Lavelle Institute`;

  return {
    subject,
    html,
    text: renderTemplate(text, variables),
  };
}
