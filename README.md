# 🎮 Tetris Kids

Un jeu Tetris coloré et simple, parfait pour les enfants, avec support PWA pour mobile et tablette.

## 🚀 Déploiement sur Netlify

### Option 1: Déploiement automatique via GitHub (Recommandé)

1. Poussez ce code vers un dépôt GitHub
2. Connectez-vous sur [Netlify](https://netlify.com)
3. Cliquez sur "Add new site" > "Import an existing project"
4. Sélectionnez votre dépôt GitHub
5. Netlify détectera automatiquement Astro via netlify.toml
6. Cliquez sur "Deploy site"

### Option 2: Déploiement via CLI

```bash
# Installer Netlify CLI
npm install -g netlify-cli

# Déployer
netlify deploy --prod
```

### Option 3: Déploiement par glisser-déposer

1. Builder le projet localement: `npm run build`
2. Allez sur [Netlify Drop](https://app.netlify.com/drop)
3. Glissez-déposez le dossier `dist`

## 📱 Installation sur Mobile/Tablette

Une fois déployé sur Netlify:

### Sur iOS (iPhone/iPad):
1. Ouvrez le site dans Safari
2. Appuyez sur le bouton Partager
3. Faites défiler et sélectionnez "Sur l'écran d'accueil"
4. Appuyez sur "Ajouter"

### Sur Android:
1. Ouvrez le site dans Chrome
2. Appuyez sur le menu (⋮)
3. Sélectionnez "Ajouter à l'écran d'accueil"
4. Appuyez sur "Ajouter"

L'application fonctionnera ensuite comme une vraie app native!

## 🎯 Caractéristiques

- ✨ Interface colorée adaptée aux enfants
- 📱 Contrôles tactiles larges et faciles à utiliser
- 🔄 PWA - fonctionne hors ligne une fois installée
- 🎨 Design responsive pour tous les appareils
- 🚀 Zéro configuration nécessaire pour Vercel

## 🛠️ Développement Local

```bash
# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev

# Builder pour la production
npm run build

# Prévisualiser le build de production
npm run preview
```

## 🎮 Comment Jouer

- **⬅️ Gauche / ➡️ Droite**: Déplacer la pièce
- **⬇️ Bas**: Descendre plus vite
- **🔄 Tourner**: Faire pivoter la pièce
- **⏬ Descendre**: Faire tomber la pièce immédiatement

Les contrôles fonctionnent aussi au clavier:
- Flèches directionnelles pour se déplacer
- Flèche haut pour tourner
- Espace pour faire tomber

## 📦 Technologies

- **Astro** - Framework web moderne et rapide
- **Svelte** - Interface utilisateur réactive
- **PWA** - Progressive Web App pour l'installation mobile
- **Netlify** - Hébergement gratuit et rapide

Profitez bien du jeu! 🎉
