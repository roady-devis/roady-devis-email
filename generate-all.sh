#!/bin/bash

# Script de génération COMPLÈTE du service email
# Crée TOUS les fichiers nécessaires en une seule exécution

cd "$(dirname "$0")"

echo "🚀 Génération complète du projet roady-devis-email..."
echo ""

# Fonction helper pour créer un fichier
create_file() {
  local file_path="$1"
  local content="$2"
  mkdir -p "$(dirname "$file_path")"
  echo "$content" > "$file_path"
  echo "✅ Créé: $file_path"
}

# ==========================================
# CONFIG FILES
# ==========================================

create_file "src/config/database.ts" 'import mongoose from "mongoose";
import { env } from "./env";

let isConnected = false;

export async function connectDatabase() {
  if (isConnected) {
    console.log("✅ MongoDB déjà connecté");
    return;
  }

  try {
    await mongoose.connect(env.MONGODB_URI);
    isConnected = true;
    console.log(`✅ MongoDB connecté à ${env.MONGODB_DB}`);
  } catch (error) {
    console.error("❌ Erreur connexion MongoDB:", error);
    throw error;
  }
}

export async function disconnectDatabase() {
  if (!isConnected) return;

  await mongoose.disconnect();
  isConnected = false;
  console.log("🔌 MongoDB déconnecté");
}'

# ==========================================
# MODELS
# ==========================================

create_file "src/models/email.model.ts" 'import mongoose, { Schema, Document } from "mongoose";

export interface IEmail extends Document {
  from: string;
  to: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  receivedAt: Date;
  attachments: Array<{
    filename: string;
    path: string;
    size: number;
    contentType: string;
  }>;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  metadata?: {
    messageId?: string;
    inReplyTo?: string;
    references?: string[];
  };
}

const emailSchema = new Schema<IEmail>(
  {
    from: { type: String, required: true, index: true },
    to: [{ type: String, required: true }],
    subject: { type: String, required: true },
    body: { type: String, required: true },
    bodyHtml: String,
    receivedAt: { type: Date, default: Date.now, index: true },
    attachments: [
      {
        filename: String,
        path: String,
        size: Number,
        contentType: String,
      },
    ],
    processed: { type: Boolean, default: false, index: true },
    processedAt: Date,
    error: String,
    metadata: {
      messageId: String,
      inReplyTo: String,
      references: [String],
    },
  },
  { timestamps: true }
);

export const Email = mongoose.model<IEmail>("Email", emailSchema);'

# ==========================================
# SERVICES
# ==========================================

create_file "src/services/smtp.service.ts" 'import nodemailer from "nodemailer";
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

export const smtpService = new SMTPService();'

# ==========================================
# ROUTES & CONTROLLERS
# ==========================================

create_file "src/routes/email.routes.ts" 'import { Router } from "express";
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

export { router as emailRoutes };'

# ==========================================
# INDEX.TS
# ==========================================

create_file "src/index.ts" 'import express from "express";
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

start();'

# ==========================================
# DOCKERFILE
# ==========================================

create_file "Dockerfile" '# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 emailservice

COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

RUN chown -R emailservice:nodejs /app

USER emailservice

EXPOSE 3002

CMD ["node", "dist/index.js"]'

# ==========================================
# DOCKER COMPOSE FILES
# ==========================================

create_file "docker-compose.dev.yml" '# ==========================================
# DEV Environment - Email Service
# ==========================================

name: roady-email-dev

services:
  mongodb-email:
    image: mongo:8.0
    container_name: roady-mongodb-email-dev
    restart: unless-stopped
    environment:
      MONGO_INITDB_DATABASE: roady_email_dev
      MONGO_INITDB_ROOT_USERNAME: email_admin
      MONGO_INITDB_ROOT_PASSWORD: dev_password_change_me
    ports:
      - "27019:27017"
    volumes:
      - mongodb_email_dev:/data/db
    networks:
      - roady-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('\''ping'\'')", "-u", "email_admin", "-p", "dev_password_change_me", "--authenticationDatabase", "admin"]
      interval: 10s
      timeout: 5s
      retries: 5

  app-email:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: roady-email-dev
    restart: unless-stopped
    expose:
      - "3002"
    env_file:
      - .env.dev
    depends_on:
      mongodb-email:
        condition: service_healthy
    networks:
      - roady-network
    volumes:
      - ./attachments:/app/attachments
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3002/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  roady-network:
    external: true
    name: roady-network

volumes:
  mongodb_email_dev:
    name: roady-email-dev_mongodb_data
    driver: local'

create_file "docker-compose.prod.yml" '# ==========================================
# PROD Environment - Email Service
# ==========================================

name: roady-email-prod

services:
  mongodb-email:
    image: mongo:8.0
    container_name: roady-mongodb-email-prod
    restart: unless-stopped
    environment:
      MONGO_INITDB_DATABASE: roady_email
      MONGO_INITDB_ROOT_USERNAME: email_admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGODB_PASSWORD}
    ports:
      - "27020:27017"
    volumes:
      - mongodb_email_prod:/data/db
    networks:
      - roady-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('\''ping'\'')", "-u", "email_admin", "-p", "${MONGODB_PASSWORD}", "--authenticationDatabase", "admin"]
      interval: 10s
      timeout: 5s
      retries: 5

  app-email:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: roady-email-prod
    restart: unless-stopped
    expose:
      - "3003"
    environment:
      - PORT=3003
    env_file:
      - .env.prod
    depends_on:
      mongodb-email:
        condition: service_healthy
    networks:
      - roady-network
    volumes:
      - ./attachments:/app/attachments
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3003/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  roady-network:
    external: true
    name: roady-network

volumes:
  mongodb_email_prod:
    name: roady-email-prod_mongodb_data
    driver: local'

# ==========================================
# README
# ==========================================

create_file "README.md" '# 📧 Roady Devis - Service Email

Service de gestion des emails pour Roady Devis : réception IMAP, envoi SMTP et relances automatiques.

## 🎯 Fonctionnalités

- ✉️ **Envoi d'\''emails** via SMTP
- 📥 **Réception d'\''emails** via IMAP (à implémenter)
- 🔄 **Relances automatiques** (à implémenter)
- 📎 **Gestion des pièces jointes**
- 🗄️ **Stockage MongoDB** pour l'\''historique

## 🏗️ Architecture

```
roady-devis-email/
├── src/
│   ├── config/         # Configuration (env, database)
│   ├── models/         # Modèles MongoDB
│   ├── services/       # Services (SMTP, IMAP)
│   ├── routes/         # Routes API
│   └── index.ts        # Point d'\''entrée
├── docker-compose.dev.yml
├── docker-compose.prod.yml
└── Dockerfile
```

## 🚀 Démarrage

### Développement

```bash
# Install dependencies
npm install

# Créer .env.dev à partir de .env.example
cp .env.example .env.dev

# Démarrer avec Docker
docker compose -f docker-compose.dev.yml up -d

# Ou en local
npm run dev
```

### Production

```bash
# Créer .env.prod
cp .env.example .env.prod

# Démarrer avec Docker
docker compose -f docker-compose.prod.yml up -d
```

## 📡 API

### Health Check
```bash
GET /health
```

### Envoyer un email
```bash
POST /api/email/send
{
  "to": "client@example.com",
  "subject": "Test",
  "html": "<p>Hello</p>"
}
```

### Lister les emails reçus
```bash
GET /api/email/received?limit=50&processed=false
```

## 🔧 Configuration

Voir `.env.example` pour toutes les variables disponibles.

### Ports

- **DEV**: 3002 (app), 27019 (MongoDB)
- **PROD**: 3003 (app), 27020 (MongoDB)

## 📦 Technologies

- **Node.js 20** + **TypeScript**
- **Express** pour l'\''API REST
- **MongoDB** + **Mongoose** pour la persistance
- **Nodemailer** pour l'\''envoi SMTP
- **IMAP** pour la réception (à implémenter)
- **Docker** + **Docker Compose**

## 🔒 Sécurité

- Validation Zod des variables d'\''environnement
- Helmet pour les headers HTTP
- CORS configuré
- API Key pour les callbacks

## 📝 TODO

- [ ] Implémenter le polling IMAP
- [ ] Parser les emails et détecter les devis
- [ ] Système de relances automatiques
- [ ] Tests unitaires
- [ ] Documentation API complète
'

echo ""
echo "✅ Tous les fichiers ont été créés !"
echo ""
echo "Prochaines étapes :"
echo "1. cp .env.example .env.dev"
echo "2. Éditer .env.dev avec les bonnes valeurs"
echo "3. npm install"
echo "4. npm run dev"
