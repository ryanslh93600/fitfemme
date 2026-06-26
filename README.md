# 🏃‍♀️ FitFemme — Boutique Sport Femme

Boutique en ligne complète : backend Node.js + base de données SQLite, panier, commandes, et panel admin sécurisé.

> 📌 **État actuel** : le site fonctionne de bout en bout (boutique → panier → commande → admin). Le paiement par carte (Stripe) sera ajouté à l'étape suivante. Pour l'instant, les commandes sont enregistrées en statut "en attente de paiement".

---

## 🧱 Ce qu'il y a dans le projet

```
fitfemme/
├── server/
│   ├── index.js      ← Le serveur principal (toutes les routes)
│   ├── db.js          ← Base de données SQLite (produits, commandes)
│   ├── auth.js         ← Connexion admin sécurisée
│   └── utils.js        ← Fonctions utilitaires
├── public/
│   ├── index.html      ← La boutique (ce que voient les visiteuses)
│   ├── style.css        ← Tous les styles visuels
│   └── app.js            ← Le code qui fait fonctionner le site
├── data/
│   └── fitfemme.db        ← La base de données (créée automatiquement)
├── package.json
└── .env.example
```

**Zéro dépendance à installer !** Le projet utilise uniquement les modules intégrés à Node.js (pas de `npm install` nécessaire).

---

## 🖥️ PARTIE 1 — Tester sur ton ordinateur (en local)

### Étape 1 — Installer Node.js

1. Va sur **[nodejs.org](https://nodejs.org)**
2. Télécharge la version **LTS** (recommandée, bouton vert)
3. Installe-la comme n'importe quel logiciel (suivant, suivant, terminer)
4. Pour vérifier que c'est installé : ouvre l'application **Terminal** (Mac) ou **PowerShell** (Windows), tape :
   ```
   node --version
   ```
   Tu dois voir une version genre `v22.x.x`. Si oui, c'est bon !

### Étape 2 — Récupérer le projet

Télécharge le dossier `fitfemme` complet (je te donne le lien plus bas) et place-le où tu veux sur ton ordinateur (ex: Bureau).

### Étape 3 — Lancer le serveur

1. Ouvre le **Terminal** / **PowerShell**
2. Déplace-toi dans le dossier du projet :
   ```
   cd Bureau/fitfemme
   ```
   (adapte le chemin selon où tu as mis le dossier)
3. Lance le serveur :
   ```
   node server/index.js
   ```
4. Tu dois voir s'afficher :
   ```
   🔑 Mot de passe admin initialisé...
   📦 Produits de démonstration insérés
   🏃‍♀️ FitFemme server running → http://localhost:3000
   ```
5. **Ouvre ton navigateur** et va sur **http://localhost:3000**

🎉 Ta boutique s'affiche ! Le panier, les produits, tout fonctionne en local.

> Pour arrêter le serveur : retourne dans le terminal et fais `Ctrl + C`

### Accéder à l'admin en local
- 7 taps rapides sur les `···` dans le menu (mobile) ou le footer
- Ou va directement sur **http://localhost:3000/#admin**
- Mot de passe par défaut : **`FitFemme2026!`**
- ⚠️ Change-le tout de suite dans Admin → Réglages

---

## 🌍 PARTIE 2 — Mettre en ligne pour de vrai (Render)

Ton ordinateur ne peut pas rester allumé 24h/24 pour que les clientes accèdent au site. Il faut un **hébergeur**. Je recommande **Render** (gratuit pour démarrer, simple).

### Étape 1 — Créer un compte GitHub (pour stocker ton code)

1. Va sur **[github.com](https://github.com)** → Créer un compte (gratuit)
2. Crée un nouveau dépôt ("New repository") → nomme-le `fitfemme`
3. Upload tous les fichiers du projet (bouton "uploading an existing file")

### Étape 2 — Créer un compte Render

1. Va sur **[render.com](https://render.com)** → Créer un compte (tu peux te connecter avec GitHub directement)
2. Clique sur **"New +"** → **"Web Service"**
3. Connecte ton dépôt GitHub `fitfemme`
4. Configure :
   - **Name** : `fitfemme` (ou ce que tu veux)
   - **Region** : Frankfurt (le plus proche de la France)
   - **Build Command** : laisse vide (rien à installer !)
   - **Start Command** : `node server/index.js`
   - **Instance Type** : Free
5. Dans **Environment Variables**, ajoute :
   - `ADMIN_DEFAULT_PWD` = ton mot de passe admin choisi
6. Clique **"Create Web Service"**

⏳ Render va déployer ton site (2-3 minutes). Tu obtiens une URL du type `https://fitfemme.onrender.com`

### ⚠️ Point important sur Render gratuit
Le plan gratuit de Render "endort" le serveur après 15 min sans visite, et il y a un **léger délai** (15-30 sec) au réveil pour la première visiteuse. Pour une vraie boutique professionnelle, passer au plan payant (~7$/mois) évite ça. Pour démarrer/tester, le gratuit suffit.

### ⚠️ Important : la base de données sur Render gratuit
Sur le plan gratuit, le système de fichiers est **réinitialisé à chaque redéploiement** — tes produits/commandes seraient perdus. Pour une boutique en production, il faudra soit :
- Passer à un disque persistant Render (payant, ~1$/mois pour 1GB), **ou**
- Migrer vers une base de données externe (ex: Render PostgreSQL gratuit, ou Turso/LibSQL gratuit)

👉 **Je te recommande d'ajouter un disque persistant dès la mise en ligne définitive** pour ne pas perdre tes commandes. Dis-le moi quand tu seras prêt à passer en production, je t'aiderai à le configurer.

---

## 🔑 Accès admin une fois en ligne

Identique au local :
- `https://ton-site.onrender.com/#admin`
- Ou 7 taps sur les `···`

---

## 🛒 Comment ça marche au quotidien

1. **Tu ajoutes des produits** : Admin → Ajouter → colle l'image + le lien Aliexpress/Temu + ton prix de vente
2. **Une cliente commande** : elle remplit ses infos, valide → la commande apparaît dans Admin → Commandes
3. **Toi tu traites la commande** :
   - Tu cliques sur le lien 🔗 Source de chaque article
   - Tu commandes l'article sur Aliexpress/Temu en mettant **l'adresse de TA cliente** comme adresse de livraison
   - Tu coches la case ✅ une fois commandé
   - Tu mets à jour le statut (Payée → En sourcing → Expédiée → Livrée)

---

## 🚧 Ce qui reste à faire (prochaines étapes)

- [ ] **Stripe** : connecter le vrai paiement par carte bancaire
- [ ] **E-mails automatiques** : confirmation de commande envoyée à la cliente
- [ ] **Disque persistant** : pour ne pas perdre les données au redéploiement
- [ ] **Nom de domaine personnalisé** : `www.fitfemme.fr` au lieu de `.onrender.com`

On avancera sur ces points dès que tu es prêt(e) !
