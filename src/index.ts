import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import { emailRoutes } from "./routes/email.routes";
import { smtpService } from "./services/smtp.service";

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("combined"));

// Routes
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "roady-devis-email",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/email", emailRoutes);

// Démarrage
async function start() {
  try {
    // Connexion MongoDB
    await connectDatabase();

    // Vérification SMTP
    await smtpService.verifyConnection();

    // Démarrage serveur
    app.listen(env.PORT, env.HOST, () => {
      console.log(`🚀 Service Email démarré sur ${env.HOST}:${env.PORT}`);
      console.log(`📧 SMTP: ${env.SMTP_HOST}:${env.SMTP_PORT}`);
      console.log(`📥 IMAP: ${env.IMAP_HOST}:${env.IMAP_PORT}`);
    });
  } catch (error) {
    console.error("❌ Erreur démarrage:", error);
    process.exit(1);
  }
}

start();
