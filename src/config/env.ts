import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3002'),
  HOST: z.string().default('0.0.0.0'),

  // MongoDB
  MONGODB_URI: z.string(),
  MONGODB_USER: z.string(),
  MONGODB_PASSWORD: z.string(),
  MONGODB_DB: z.string(),

  // SMTP
  SMTP_HOST: z.string(),
  SMTP_PORT: z.string().transform(Number),
  SMTP_SECURE: z.string().transform((val) => val === 'true'),
  SMTP_USER: z.string(),
  SMTP_PASSWORD: z.string(),

  // IMAP
  IMAP_HOST: z.string(),
  IMAP_PORT: z.string().transform(Number),
  IMAP_SECURE: z.string().transform((val) => val === 'true'),
  IMAP_USER: z.string(),
  IMAP_PASSWORD: z.string(),
  IMAP_CHECK_INTERVAL_MS: z.string().transform(Number).default('60000'),
  IMAP_MAILBOX: z.string().default('INBOX'),

  // Main App
  MAIN_APP_URL: z.string().url(),
  MAIN_APP_API_KEY: z.string().optional(),

  // Security
  API_SECRET_KEY: z.string(),

  // Logs
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Attachments
  ATTACHMENTS_PATH: z.string().default('./attachments'),
  MAX_ATTACHMENT_SIZE_MB: z.string().transform(Number).default('10'),

  // Reminders
  REMINDER_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  REMINDER_CRON: z.string().default('0 9 * * *'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
