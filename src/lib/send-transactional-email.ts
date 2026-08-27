import { sendEmail } from './email-service';
import { getEmailTemplate, type TemplateName } from './email-templates';

export async function sendTransactionalEmailByTemplate(
  templateName: TemplateName,
  recipient: string,
  templateVariables: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const templateFn = getEmailTemplate(templateName);
    const { subject, html, text } = templateFn(templateVariables);

    return sendEmail(templateName, {
      to: recipient,
      subject,
      html,
      text,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    console.error(
      `Failed to generate and send ${templateName} email to ${recipient}:`,
      error
    );

    return {
      success: false,
      error: errorMessage,
    };
  }
}
