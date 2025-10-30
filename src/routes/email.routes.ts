import { Router } from "express";
import { smtpService } from "../services/smtp.service";
import { Email } from "../models/email.model";

const router = Router();

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

export { router as emailRoutes };
