import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

// Sends emails through any SMTP server (Gmail app password, Mailtrap, Brevo, ...).
// Not configured yet? Then the email is printed in the backend terminal instead, so you can
// still click the link while developing.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from = process.env.MAIL_FROM ?? 'Messenger AI <no-reply@messenger-ai.local>';
  private readonly transporter: Transporter | null = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT) === 465, // port 465 = TLS from the start
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;

  async send(to: string, subject: string, text: string) {
    if (!this.transporter) {
      this.logger.warn(`SMTP is not set up, so here is the email instead:\n  To: ${to}\n  Subject: ${subject}\n\n${text}\n`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text });
  }
}
