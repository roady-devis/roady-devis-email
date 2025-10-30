import { imapService } from '../services/imap.service';
import { env } from '../config/env';

class EmailCheckerJob {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  async start() {
    console.log(`🔄 Démarrage du polling IMAP (intervalle: ${env.IMAP_CHECK_INTERVAL_MS}ms)`);

    // Premier check immédiat
    await this.checkEmails();

    // Puis check périodique
    this.intervalId = setInterval(async () => {
      await this.checkEmails();
    }, env.IMAP_CHECK_INTERVAL_MS);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️  Polling IMAP arrêté');
    }
  }

  private async checkEmails() {
    if (this.isRunning) {
      console.log('⏭️  Check précédent en cours, skip...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('🔍 Vérification des nouveaux emails...');

      await imapService.connect();
      await imapService.fetchUnreadEmails();
      imapService.disconnect();

      const duration = Date.now() - startTime;
      console.log(`✅ Check terminé en ${duration}ms`);
    } catch (error) {
      console.error('❌ Erreur lors du check emails:', error);
      imapService.disconnect();
    } finally {
      this.isRunning = false;
    }
  }

  async checkNow() {
    console.log('🔍 Check manuel déclenché');
    await this.checkEmails();
  }
}

export const emailCheckerJob = new EmailCheckerJob();
