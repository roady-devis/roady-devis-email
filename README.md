# 📧 Roady Devis - Service Email

Service de gestion des emails pour Roady Devis : réception IMAP, envoi SMTP et relances automatiques.

## 🎯 Fonctionnalités

- ✉️ **Envoi d'emails** via SMTP
- 📥 **Réception d'emails** via IMAP (à implémenter)
- 🔄 **Relances automatiques** (à implémenter)
- 📎 **Gestion des pièces jointes**
- 🗄️ **Stockage MongoDB** pour l'historique

## 🏗️ Architecture

```
roady-devis-email/
├── src/
│   ├── config/         # Configuration (env, database)
│   ├── models/         # Modèles MongoDB
│   ├── services/       # Services (SMTP, IMAP)
│   ├── routes/         # Routes API
│   └── index.ts        # Point d'entrée
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
- **Express** pour l'API REST
- **MongoDB** + **Mongoose** pour la persistance
- **Nodemailer** pour l'envoi SMTP
- **IMAP** pour la réception (à implémenter)
- **Docker** + **Docker Compose**

## 🔒 Sécurité

- Validation Zod des variables d'environnement
- Helmet pour les headers HTTP
- CORS configuré
- API Key pour les callbacks

## 📝 TODO

- [ ] Implémenter le polling IMAP
- [ ] Parser les emails et détecter les devis
- [ ] Système de relances automatiques
- [ ] Tests unitaires
- [ ] Documentation API complète

