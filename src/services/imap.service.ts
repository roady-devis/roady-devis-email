import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { env } from '../config/env';
import { Email } from '../models/email.model';
import * as fs from 'fs';
import * as path from 'path';

class IMAPService {
  private imap: Imap | null = null;
  private isConnected = false;

  constructor() {
    this.imap = new Imap({
      user: env.IMAP_USER,
      password: env.IMAP_PASSWORD,
      host: env.IMAP_HOST,
      port: env.IMAP_PORT,
      tls: env.IMAP_SECURE,
      tlsOptions: { rejectUnauthorized: false },
      keepalive: {
        interval: 10000,
        idleInterval: 300000,
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.imap) return;

    this.imap.once('ready', () => {
      console.log('✅ IMAP connecté');
      this.isConnected = true;
    });

    this.imap.once('error', (err: Error) => {
      console.error('❌ Erreur IMAP:', err);
      this.isConnected = false;
    });

    this.imap.once('end', () => {
      console.log('🔌 IMAP déconnecté');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      if (!this.imap) {
        reject(new Error('IMAP non initialisé'));
        return;
      }

      this.imap.once('ready', () => resolve());
      this.imap.once('error', (err: Error) => reject(err));
      this.imap.connect();
    });
  }

  disconnect() {
    if (this.imap && this.isConnected) {
      this.imap.end();
    }
  }

  async fetchUnreadEmails(): Promise<void> {
    if (!this.imap || !this.isConnected) {
      throw new Error('IMAP non connecté');
    }

    return new Promise((resolve, reject) => {
      this.imap!.openBox(env.IMAP_MAILBOX, false, async (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`📬 Boîte ouverte: ${box.messages.total} messages, ${box.messages.new} nouveaux`);

        if (box.messages.total === 0) {
          resolve();
          return;
        }

        // Rechercher les emails non lus
        this.imap!.search(['UNSEEN'], async (err, results) => {
          if (err) {
            reject(err);
            return;
          }

          if (results.length === 0) {
            console.log('📭 Aucun email non lu');
            resolve();
            return;
          }

          console.log(`📨 ${results.length} emails non lus trouvés`);

          try {
            await this.processMessages(results);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    });
  }

  private async processMessages(messageIds: number[]): Promise<void> {
    if (!this.imap) return;

    const fetch = this.imap.fetch(messageIds, {
      bodies: '',
      markSeen: true,
    });

    const promises: Promise<void>[] = [];

    fetch.on('message', (msg) => {
      const promise = new Promise<void>((resolve, reject) => {
        let buffer = '';

        msg.on('body', (stream) => {
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
        });

        msg.once('end', async () => {
          try {
            await this.parseAndSaveEmail(buffer);
            resolve();
          } catch (error) {
            console.error('❌ Erreur traitement email:', error);
            reject(error);
          }
        });
      });

      promises.push(promise);
    });

    fetch.once('error', (err) => {
      console.error('❌ Erreur fetch IMAP:', err);
    });

    fetch.once('end', () => {
      console.log('✅ Fetch terminé');
    });

    await Promise.all(promises);
  }

  private async parseAndSaveEmail(rawEmail: string): Promise<void> {
    try {
      const parsed: ParsedMail = await simpleParser(rawEmail);

      console.log(`📧 Email reçu de: ${parsed.from?.text || 'inconnu'}`);
      console.log(`   Sujet: ${parsed.subject || 'sans sujet'}`);

      // Créer le dossier attachments si nécessaire
      const attachmentsDir = path.join(process.cwd(), env.ATTACHMENTS_PATH);
      if (!fs.existsSync(attachmentsDir)) {
        fs.mkdirSync(attachmentsDir, { recursive: true });
      }

      // Traiter les pièces jointes
      const attachments = [];
      if (parsed.attachments && parsed.attachments.length > 0) {
        console.log(`   📎 ${parsed.attachments.length} pièce(s) jointe(s)`);

        for (const attachment of parsed.attachments) {
          const filename = attachment.filename || `attachment_${Date.now()}`;
          const filepath = path.join(attachmentsDir, `${Date.now()}_${filename}`);

          // Sauvegarder la pièce jointe
          fs.writeFileSync(filepath, attachment.content);

          attachments.push({
            filename: filename,
            path: filepath,
            size: attachment.size,
            contentType: attachment.contentType,
          });

          console.log(`   💾 Sauvegardé: ${filename} (${attachment.size} bytes)`);
        }
      }

      // Sauvegarder en base de données
      const email = new Email({
        from: parsed.from?.text || '',
        to: parsed.to?.value.map((addr) => addr.address || '') || [],
        subject: parsed.subject || '',
        body: parsed.text || '',
        bodyHtml: parsed.html || undefined,
        receivedAt: parsed.date || new Date(),
        attachments,
        processed: false,
        metadata: {
          messageId: parsed.messageId,
          inReplyTo: parsed.inReplyTo,
          references: parsed.references,
        },
      });

      await email.save();
      console.log(`✅ Email sauvegardé en base de données (ID: ${email._id})`);
    } catch (error) {
      console.error('❌ Erreur parsing email:', error);
      throw error;
    }
  }
}

export const imapService = new IMAPService();
