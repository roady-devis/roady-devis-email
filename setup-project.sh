#!/bin/bash

# Script de génération complète du projet roady-devis-email
# Ce script crée tous les fichiers nécessaires pour le service email

cd "$(dirname "$0")"

echo "🚀 Génération du projet roady-devis-email..."

# Créer tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "types": ["node"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Créer .eslintrc.json
cat > .eslintrc.json << 'EOF'
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "plugins": ["@typescript-eslint"],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off"
  },
  "env": {
    "node": true,
    "es2022": true
  }
}
EOF

# Créer .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
package-lock.json
yarn.lock

# Build
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local
.env.dev
.env.prod

# Logs
logs/
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Temp
tmp/
temp/
attachments/
EOF

# Créer .dockerignore
cat > .dockerignore << 'EOF'
node_modules
npm-debug.log
dist
.git
.env
.env.*
*.md
.gitignore
.dockerignore
logs
tmp
EOF

echo "✅ Fichiers de configuration créés"
echo "📦 Projet configuré avec succès!"
echo ""
echo "Prochaines étapes :"
echo "1. chmod +x setup-project.sh && ./setup-project.sh"
echo "2. Les fichiers source TypeScript seront créés manuellement"
echo "3. npm install"
echo "4. Créer les fichiers .env.dev et .env.prod"
