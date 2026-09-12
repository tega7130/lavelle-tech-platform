import nodemailer from 'nodemailer';
import { prisma } from './prisma';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface EmailLogRecord {
  template: string;
  recipient: string;
  subject: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function initializeTransporter() {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpEnc = (process.env.SMTP_ENC || 'tls') as 'tls' | 'ssl';
  const senderEmail = process.env.SENDER_EMAIL;
  const senderName = process.env.SENDER_NAME || 'Lavelle';

  if (!smtpHost || !smtpUser || !smtpPass || !senderEmail) {
    throw new Error(
      'SMTP configuration incomplete. Check SMTP_HOST, SMTP_USER, SMTP_PASS, and SENDER_EMAIL environment variables.'
    );
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpEnc === 'ssl',
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  return transporter;
}

async function logEmailSend(record: EmailLogRecord) {
  try {
    await prisma.emailLog.create({
      data: {
        template: record.template,
        recipient: record.recipient,
        subject: record.subject,
        status: record.status,
        errorMessage: record.errorMessage || null,
        sentAt: record.status === 'sent' ? new Date() : null,
      },
    });
  } catch (error) {
    console.error('Failed to log email send:', error);
  }
}

export async function sendEmail(
  template: string,
  payload: EmailPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const tp = initializeTransporter();
    const senderEmail = process.env.SENDER_EMAIL;
    const senderName = process.env.SENDER_NAME || 'Lavelle';

    const info = await tp.sendMail({
      from: `${senderName} <${senderEmail}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    await logEmailSend({
      template,
      recipient: payload.to,
      subject: payload.subject,
      status: 'sent',
    });

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    await logEmailSend({
      template,
      recipient: payload.to,
      subject: payload.subject,
      status: 'failed',
      errorMessage,
    });

    console.error(`Failed to send ${template} email to ${payload.to}:`, error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function sendTransactionalEmail(
  template: string,
  recipient: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmail(template, {
    to: recipient,
    subject,
    html,
    text,
  });
}
