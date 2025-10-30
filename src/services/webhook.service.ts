import axios from 'axios';
import { env } from '../config/env';
import { IEmail } from '../models/email.model';

class WebhookService {
  /**
   * Notifie l'application principale qu'un nouvel email a été reçu
   */
  async notifyEmailReceived(email: IEmail): Promise<void> {
    try {
      const payload = {
        emailId: email._id.toString(),
        from: email.from,
        to: email.to,
        subject: email.subject || '',
        receivedAt: email.receivedAt,
        hasAttachments: email.attachments.length > 0,
        attachments: email.attachments.map((att) => ({
          filename: att.filename,
          size: att.size,
          contentType: att.contentType,
          downloadUrl: `/api/email/${email._id}/attachment/${att.filename}`,
        })),
      };

      console.log(`📤 Notification vers l'app principale: ${env.MAIN_APP_URL}/api/webhooks/email-received`);

      const response = await axios.post(
        `${env.MAIN_APP_URL}/api/webhooks/email-received`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': env.MAIN_APP_API_KEY || env.API_SECRET_KEY,
          },
          timeout: 10000, // 10 secondes timeout
        }
      );

      console.log(`✅ Notification envoyée avec succès (status: ${response.status})`);
    } catch (error: any) {
      console.error(`❌ Erreur lors de la notification:`, error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, error.response.data);
      }
      // On ne throw pas l'erreur pour ne pas bloquer le traitement de l'email
    }
  }
}

export const webhookService = new WebhookService();
