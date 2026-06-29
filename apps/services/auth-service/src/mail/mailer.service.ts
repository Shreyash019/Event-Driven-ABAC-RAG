import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Transporter, createTransport } from 'nodemailer';
import type { MailConfig } from '../config/configuration';

/**
 * SMTP mailer. In dev this points at Mailpit (no auth/TLS); swap the SMTP settings for a
 * real provider in production. Email addresses are PII — never logged (GUARDRAILS §6.1);
 * we log only a redacted event.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly config: MailConfig;
  private readonly transporter: Transporter;

  constructor(config: ConfigService) {
    this.config = config.getOrThrow<MailConfig>('mail');
    this.transporter = createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: false, // Mailpit / STARTTLS-less dev SMTP
    });
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.from,
      to,
      subject: 'Reset your ARAC password',
      text:
        `Reset your password using the link below:\n\n${resetUrl}\n\n` +
        `If you didn't request this, you can ignore this email. The link expires shortly.`,
      html:
        `<p>Reset your password using the link below:</p>` +
        `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
        `<p>If you didn't request this, you can ignore this email. The link expires shortly.</p>`,
    });
    this.logger.log('audit password_reset.email_sent to=<redacted>');
  }
}
