import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { env } from '../config/env';
import { Email } from '../models/email.model';
import { webhookService } from './webhook.service';
import * as fs from 'fs';
import * as path from 'path';

class IMAPService {
  private imap: Imap | null = null;
  private isConnected = false;

  constructor() {
    // Ne pas créer l'instance ici, on la crée à chaque connect()
  }

  private createConnection() {
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
      // Toujours fermer l'ancienne connexion si elle existe
      if (this.imap && this.isConnected) {
        try {
          this.imap.end();
        } catch (e) {
          // Ignorer les erreurs de fermeture
        }
        this.isConnected = false;
      }

      // Créer une nouvelle connexion à chaque fois
      this.createConnection();

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
          console.log('📭 Boîte vide');
          resolve();
          return;
        }

        // Rechercher TOUS les emails (pas seulement les non lus)
        // On récupère tous les emails depuis le début
        this.imap!.search(['ALL'], async (err, results) => {
          if (err) {
            reject(err);
            return;
          }

          if (results.length === 0) {
            console.log('📭 Aucun email trouvé');
            resolve();
            return;
          }

          console.log(`📨 ${results.length} emails trouvés dans la boîte`);

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
          const originalFilename = attachment.filename || `attachment_${Date.now()}`;
          const savedFilename = `${Date.now()}_${originalFilename}`;
          const filepath = path.join(attachmentsDir, savedFilename);

          // Sauvegarder la pièce jointe
          fs.writeFileSync(filepath, attachment.content);

          attachments.push({
            filename: savedFilename, // Utiliser le nom complet avec timestamp
            path: filepath,
            size: attachment.size,
            contentType: attachment.contentType,
          });

          console.log(`   💾 Sauvegardé: ${savedFilename} (${attachment.size} bytes)`);
        }
      }

      // Vérifier si l'email existe déjà (par messageId)
      const messageId = parsed.messageId;
      if (messageId) {
        const existingEmail = await Email.findOne({ 'metadata.messageId': messageId });
        if (existingEmail) {
          console.log(`⏭️  Email déjà présent en base (MessageID: ${messageId})`);
          return;
        }
      } else {
        console.log(`⚠️  Email sans messageId, vérification par sujet/date`);
        // Si pas de messageId, vérifier par sujet + date pour éviter doublons
        const existingEmail = await Email.findOne({
          subject: parsed.subject || '',
          receivedAt: parsed.date || new Date(),
          from: parsed.from?.text || ''
        });
        if (existingEmail) {
          console.log(`⏭️  Email similaire déjà présent en base`);
          return;
        }
      }

      // Sauvegarder en base de données
      const email = new Email({
        from: parsed.from?.text || '',
        to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to[0].value.map((addr) => addr.address || "") : parsed.to.value.map((addr) => addr.address || "")) : [],
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

      // Notifier l'application principale
      await webhookService.notifyEmailReceived(email);
    } catch (error) {
      console.error('❌ Erreur parsing email:', error);
      throw error;
    }
  }

  /**
   * Supprime un email du serveur IMAP
   * Crée sa propre connexion dédiée pour éviter les conflits
   * @param messageId - L'ID du message à supprimer
   */
  async deleteEmailFromServer(messageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🗑️  Suppression email IMAP (MessageID: ${messageId})`);

      // Créer une connexion IMAP dédiée pour la suppression
      const deleteImap = new Imap({
        user: env.IMAP_USER,
        password: env.IMAP_PASSWORD,
        host: env.IMAP_HOST,
        port: env.IMAP_PORT,
        tls: env.IMAP_SECURE,
        tlsOptions: { rejectUnauthorized: false },
      });

      // Timeout de sécurité (30 secondes max)
      const timeout = setTimeout(() => {
        try {
          deleteImap.end();
        } catch (e) {}
        reject(new Error('Timeout lors de la suppression IMAP'));
      }, 30000);

      deleteImap.once('ready', () => {
        console.log('🔌 Connexion IMAP dédiée établie');

        // Ouvrir la boîte de réception
        deleteImap.openBox('INBOX', false, (err: any) => {
          if (err) {
            clearTimeout(timeout);
            console.error('❌ Erreur ouverture INBOX:', err);
            deleteImap.end();
            reject(err);
            return;
          }

          // Rechercher l'email par MESSAGE-ID header
          deleteImap.search([['HEADER', 'MESSAGE-ID', messageId]], (err: any, results: any) => {
            if (err) {
              clearTimeout(timeout);
              console.error('❌ Erreur recherche email:', err);
              deleteImap.end();
              reject(err);
              return;
            }

            if (results.length === 0) {
              clearTimeout(timeout);
              console.log('⚠️  Email non trouvé sur le serveur (déjà supprimé ou messageId incorrect)');
              deleteImap.end();
              resolve();
              return;
            }

            console.log(`📧 Email trouvé (UID: ${results[0]}), suppression...`);

            // Marquer l'email avec le flag \Deleted
            deleteImap.addFlags(results, '\\Deleted', (err: any) => {
              if (err) {
                clearTimeout(timeout);
                console.error('❌ Erreur marquage email:', err);
                deleteImap.end();
                reject(err);
                return;
              }

              console.log('🏴 Flag \\Deleted ajouté, expunge...');

              // Expunge pour supprimer définitivement
              deleteImap.expunge((err: any) => {
                clearTimeout(timeout);

                if (err) {
                  console.error('❌ Erreur expunge:', err);
                  deleteImap.end();
                  reject(err);
                  return;
                }

                console.log('✅ Email supprimé du serveur IMAP');
                deleteImap.end();
                resolve();
              });
            });
          });
        });
      });

      deleteImap.once('error', (err: Error) => {
        clearTimeout(timeout);
        console.error('❌ Erreur connexion IMAP:', err);
        reject(err);
      });

      deleteImap.connect();
    });
  }
}

export const imapService = new IMAPService();
