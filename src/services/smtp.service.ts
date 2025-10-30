import nodemailer from "nodemailer";
import { env } from "../config/env";

class SMTPService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });
  }

  async sendEmail(options: {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: Array<{
      filename: string;
      path?: string;
      content?: Buffer;
    }>;
  }) {
    try {
      const info = await this.transporter.sendMail({
        from: `"Roady Devis" <${env.SMTP_USER}>`,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      });

      console.log("📧 Email envoyé:", info.messageId);
      return info;
    } catch (error) {
      console.error("❌ Erreur envoi email:", error);
      throw error;
    }
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log("✅ Connexion SMTP OK");
      return true;
    } catch (error) {
      console.error("❌ Erreur connexion SMTP:", error);
      return false;
    }
  }
}

export const smtpService = new SMTPService();
