import { renderTemplate } from "@/lib/email-utils";

export interface ReEngagementReminder3dayVariables {
  firstName: string;
  programmeName: string;
  lastActivityDays: number;
  portalUrl: string;
  supportEmail: string;
  currentYear: number;
}

export function generateReEngagementReminder3dayEmail(variables: ReEngagementReminder3dayVariables) {
  const subject = renderTemplate(
    "We Miss You! — Come Back to {{programmeName}}",
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
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .message-box { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #667eea; }
    .action-button { display: inline-block; background: #667eea; color: white; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .benefit-box { background: #e8f4f8; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .benefit-box h3 { margin-top: 0; color: #0c5460; }
    .benefit-item { padding: 8px 0; color: #0c5460; }
    .progress-box { background: #f0f8ff; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #0c5460; }
    .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>👋 We Miss You!</h1>
      <p>{{programmeName}}</p>
    </div>

    <div class="content">
      <p>Hi {{firstName}},</p>

      <p>It's been {{lastActivityDays}} days since you last visited <strong>{{programmeName}}</strong>. We'd love to see you back on track with your learning!</p>

      <div class="message-box">
        <p>Your progress is important to us. Consistent engagement helps you:</p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Master the material more effectively</li>
          <li>Build momentum in your learning</li>
          <li>Stay on schedule for exam preparation</li>
        </ul>
      </div>

      <a href="{{portalUrl}}" class="action-button">Continue Your Learning</a>

      <div class="benefit-box">
        <h3>What You Can Do Now</h3>
        <div class="benefit-item">✓ Review recent lectures and materials</div>
        <div class="benefit-item">✓ Complete pending module assessments</div>
        <div class="benefit-item">✓ Practice exam questions</div>
        <div class="benefit-item">✓ Check your progress dashboard</div>
      </div>

      <div class="progress-box">
        <strong>💪 You're Making Progress!</strong>
        <p>Don't lose momentum — even 15 minutes today can keep you moving forward. Every lecture watched, every question answered brings you closer to success.</p>
      </div>

      <p>If you're facing challenges or need support, reach out to us at <strong>{{supportEmail}}</strong>. We're here to help!</p>

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

  const text = `We Miss You!

Hi {{firstName}},

It's been {{lastActivityDays}} days since you last visited {{programmeName}}. We'd love to see you back on track with your learning!

Your progress is important to us. Consistent engagement helps you:
• Master the material more effectively
• Build momentum in your learning
• Stay on schedule for exam preparation

Continue Your Learning: {{portalUrl}}

WHAT YOU CAN DO NOW
✓ Review recent lectures and materials
✓ Complete pending module assessments
✓ Practice exam questions
✓ Check your progress dashboard

💪 You're Making Progress!
Don't lose momentum — even 15 minutes today can keep you moving forward. Every lecture watched, every question answered brings you closer to success.

Need support? Contact {{supportEmail}}.

© {{currentYear}} Lavelle Institute`;

  return {
    subject,
    html,
    text: renderTemplate(text, variables),
  };
}
