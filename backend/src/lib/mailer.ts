import nodemailer, { type Transporter } from 'nodemailer';
import { config, isTest } from '../config';

/**
 * Outgoing email. With SMTP_URL configured (e.g. a free Brevo/SendGrid relay)
 * mail is actually delivered; otherwise messages are logged to stdout so the
 * whole flow stays testable in dev — the same degradation pattern as FCM.
 */
let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter === undefined) {
    transporter = config.SMTP_URL ? nodemailer.createTransport(config.SMTP_URL) : null;
    if (!transporter && !isTest) {
      console.warn('[mailer] SMTP_URL not set — outgoing mail runs in log-only mode.');
    }
  }
  return transporter;
}

export async function sendPasswordResetOtp(to: string, otp: string): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    if (!isTest) {
      console.log(`[mailer] (log-only) → ${to}: your Ripple password reset code is ${otp}`);
    }
    return;
  }

  await transport.sendMail({
    from: config.EMAIL_FROM,
    to,
    subject: `${otp} is your Ripple password reset code`,
    text: [
      'Hi,',
      '',
      `Your Ripple password reset code is: ${otp}`,
      '',
      'Enter it in the app to choose a new password. The code expires in 10 minutes.',
      "Didn't request this? You can safely ignore this email — your password stays unchanged.",
      '',
      '— Ripple',
    ].join('\n'),
  });
}
