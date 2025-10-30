# Roady Devis - Email Service

Microservice de gestion des emails (IMAP/SMTP) pour Roady Devis.

## Architecture

- **Backend**: Express.js + TypeScript
- **Base de données**: MongoDB 8.0
- **IMAP**: Récupération automatique des emails
- **SMTP**: Envoi d'emails

## Fonctionnalités

- Récupération automatique des emails via IMAP
- Gestion des pièces jointes (PDF)
- Suppression d'emails du serveur IMAP
- Webhook vers l'application principale lors de réception d'email
- API REST pour accéder aux emails et pièces jointes

## Prérequis

- Node.js 20+
- Docker & Docker Compose
- npm

## Développement Local

### 1. Lancer MongoDB

```bash
docker compose -f docker-compose.local.yml up -d
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Lancer le service

```bash
npm run dev
```

Le service sera accessible sur http://localhost:3002

## API Endpoints

### GET /health
Healthcheck du service

### GET /api/email/received
Liste des emails reçus

### GET /api/email/:id
Détails d'un email

### GET /api/email/:id/attachment/:filename
Télécharger une pièce jointe

### DELETE /api/email/:id
Supprimer un email (DB + serveur IMAP)

### POST /api/inbox/check
Forcer la vérification des nouveaux emails

## Configuration

Le service vérifie automatiquement les nouveaux emails toutes les 60 secondes (configurable via `CHECK_INTERVAL_MS`).

Lors de la réception d'un email avec pièce jointe, un webhook est envoyé à l'application principale (`MAIN_APP_URL/api/webhooks/email-received`).

## Déploiement

Le déploiement sur l'environnement DEV se fait automatiquement via GitHub Actions lors d'un push sur la branche `develop`.

## Microservices

Ce microservice fait partie de l'architecture Roady Devis :

- **roady-devis**: Application principale Next.js
- **roady-devis-email** (ce repo): Service email (IMAP/SMTP)
- **roady-devis-infra**: Infrastructure nginx

## Scripts Disponibles

```bash
npm run dev          # Lancer en mode développement
npm run build        # Build de production
npm run start        # Lancer en mode production
npm run lint         # Vérifier le code
```

## Technologies

- **Backend**: Express.js, TypeScript
- **Database**: MongoDB 8.0, Mongoose
- **Email**: node-imap, nodemailer
- **Deployment**: Docker, GitHub Actions

## Licence

Propriétaire - Roady Sollies
