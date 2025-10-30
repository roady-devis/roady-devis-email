import { Router } from "express";
import { smtpService } from "../services/smtp.service";
import { Email } from "../models/email.model";
import { emailCheckerJob } from "../jobs/email-checker.job";
import { apiKeyAuth } from "../middleware/auth.middleware";
import { imapService } from "../services/imap.service";
import path from "path";
import fs from "fs";

const router = Router();

// Appliquer l'authentification à toutes les routes
router.use(apiKeyAuth);

// Envoyer un email
router.post("/send", async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({
        error: "Champs requis: to, subject, et (text ou html)",
      });
    }

    const info = await smtpService.sendEmail({ to, subject, text, html });

    res.json({
      success: true,
      messageId: info.messageId,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Lister les emails reçus
router.get("/received", async (req, res) => {
  try {
    const { limit = 50, processed } = req.query;

    const filter: any = {};
    if (processed !== undefined) {
      filter.processed = processed === "true";
    }

    const emails = await Email.find(filter)
      .sort({ receivedAt: -1 })
      .limit(Number(limit));

    res.json({
      count: emails.length,
      emails,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir un email spécifique
router.get("/:id", async (req, res) => {
  try {
    const email = await Email.findById(req.params.id);

    if (!email) {
      return res.status(404).json({ error: "Email non trouvé" });
    }

    res.json(email);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Déclencher manuellement le check des emails
router.post("/check-now", async (req, res) => {
  try {
    await emailCheckerJob.checkNow();
    res.json({
      success: true,
      message: "Check des emails déclenché",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Télécharger une pièce jointe
router.get("/:id/attachment/:filename", async (req, res) => {
  try {
    const email = await Email.findById(req.params.id);

    if (!email) {
      return res.status(404).json({ error: "Email non trouvé" });
    }

    const attachment = email.attachments.find(
      (att) => att.filename === req.params.filename
    );

    if (!attachment) {
      return res.status(404).json({ error: "Pièce jointe non trouvée" });
    }

    // Vérifier que le fichier existe
    if (!fs.existsSync(attachment.path)) {
      return res.status(404).json({ error: "Fichier introuvable sur le disque" });
    }

    // Envoyer le fichier
    res.download(attachment.path, attachment.filename);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Marquer un email comme traité
router.patch("/:id/processed", async (req, res) => {
  try {
    const { processed, error } = req.body;

    const email = await Email.findByIdAndUpdate(
      req.params.id,
      {
        processed: processed !== undefined ? processed : true,
        processedAt: new Date(),
        error: error || undefined,
      },
      { new: true }
    );

    if (!email) {
      return res.status(404).json({ error: "Email non trouvé" });
    }

    res.json(email);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un email (de la base ET du serveur)
router.delete("/:id", async (req, res) => {
  try {
    const email = await Email.findById(req.params.id);

    if (!email) {
      return res.status(404).json({ error: "Email non trouvé" });
    }

    // 1. Supprimer du serveur IMAP si messageId disponible
    if (email.metadata?.messageId) {
      try {
        console.log(`🗑️  Suppression de l'email du serveur IMAP...`);
        await imapService.deleteEmailFromServer(email.metadata.messageId);
      } catch (imapError: any) {
        console.error('⚠️  Erreur suppression IMAP (email supprimé de la DB quand même):', imapError.message);
      }
    }

    // 2. Supprimer les pièces jointes du disque
    if (email.attachments && email.attachments.length > 0) {
      for (const attachment of email.attachments) {
        if (fs.existsSync(attachment.path)) {
          try {
            fs.unlinkSync(attachment.path);
            console.log(`🗑️  Pièce jointe supprimée: ${attachment.filename}`);
          } catch (fsError) {
            console.error(`⚠️  Impossible de supprimer: ${attachment.filename}`);
          }
        }
      }
    }

    // 3. Supprimer de la base de données
    await Email.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Email supprimé avec succès (DB + serveur + pièces jointes)",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as emailRoutes };
