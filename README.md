# Pronos Miss

Web app privée (PWA) de pronostics Miss France entre amis : chacun choisit la candidate qu'il voit gagner, peut changer d'avis jusqu'à la fermeture, puis tout le monde découvre les pronos des autres et suit l'émission en direct. Les trophées 🥇🥈🥉 restent sur le profil d'une édition à l'autre.

Stack : Vite, React, TypeScript, react-router, Firebase (Auth, Firestore, Hosting) sur le plan gratuit Spark. Aucune Cloud Function. Spécification : `docs/SPEC.md`. Design : `docs/DESIGN.md`. Architecture : `docs/ARCHITECTURE.md`.

Adresse : https://missfrancebet.web.app

## Installation

Node 22+ et Java 21+ (Java sert aux émulateurs Firebase).

```bash
npm install
cp .env.example .env.local
```

## Variables d'environnement

Dans `.env.local` (jamais commité) :

| Variable | Valeur |
|---|---|
| `VITE_FIREBASE_API_KEY` | clé web du projet |
| `VITE_FIREBASE_AUTH_DOMAIN` | `missfrancebet.web.app` (le domaine d'hébergement, pas `firebaseapp.com`, sinon la connexion Google casse sur Safari iOS) |
| `VITE_FIREBASE_PROJECT_ID` | `missfrancebet` |
| `VITE_FIREBASE_STORAGE_BUCKET` | facultatif |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | facultatif |
| `VITE_FIREBASE_APP_ID` | id de l'app web |
| `VITE_USE_EMULATORS` | `true` pour utiliser les émulateurs locaux |

Ces valeurs ne sont pas secrètes (elles finissent dans le bundle). La sécurité repose sur `firestore.rules`.

## Lancer en local avec les émulateurs

```bash
# terminal 1 : émulateurs Auth (9099), Firestore (8080), interface (http://127.0.0.1:4000)
npm run emulators

# terminal 2 : l'app, branchée sur les émulateurs
VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-pronos-miss npm run dev
```

Pour te rendre admin en local : dans l'interface des émulateurs (onglet Firestore), crée le document `admins/<ton uid>` (l'uid est visible dans l'onglet Authentication).

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de dev |
| `npm run build` | vérification TypeScript + build de production dans `dist/` |
| `npm run preview` | sert le build |
| `npm run typecheck` | TypeScript seul |
| `npm run lint` | ESLint |
| `npm run test:unit` | tests des fonctions pures (`candidateStatus`, `trophyFor`) |
| `npm run test:rules` | tests des règles Firestore (démarre l'émulateur tout seul) |
| `npm run icons` | régénère les icônes PNG depuis `public/icons/*.svg` |

Le premier `npm run emulators` ou `npm run test:rules` télécharge l'émulateur Firestore (un .jar depuis storage.googleapis.com) : il faut un accès réseau à ce domaine.

## Mise en ligne (pas à pas)

Tout est gratuit sur le plan Spark. Compte Google nécessaire.

1. **Créer le projet.** Va sur https://console.firebase.google.com, « Créer un projet ». Nom : `missfrancebet`. Vérifie que l'**ID du projet** affiché est bien `missfrancebet` (clique sur l'ID pour le modifier si besoin). Google Analytics : inutile, désactive-le. Le projet est sur le plan Spark par défaut : ne passe pas au plan Blaze.
   - *Si l'ID `missfrancebet` est déjà pris :* crée le projet avec un autre ID (ex. `missfrancebet-2027`), puis dans Hosting crée un site supplémentaire nommé `missfrancebet` (voir l'étape 6). L'app sera quand même sur `missfrancebet.web.app`.
2. **Ajouter une app web.** Dans la vue d'ensemble du projet, clique sur l'icône `</>`, nomme-la « Pronos Miss », ne coche pas Hosting ici. Firebase affiche un objet `firebaseConfig` : recopie ses valeurs dans `.env.local` (`apiKey` → `VITE_FIREBASE_API_KEY`, etc.). Pour `VITE_FIREBASE_AUTH_DOMAIN`, mets `missfrancebet.web.app` et pas la valeur proposée.
3. **Activer la connexion.** Menu Build > Authentication > Commencer. Onglet « Mode de connexion » : active **Google** (choisis un email d'assistance) et **Adresse e-mail/Mot de passe** (sans le lien par email). Dans Authentication > Paramètres > Domaines autorisés, vérifie que `missfrancebet.web.app` est dans la liste ; ajoute-le sinon. Facultatif : Authentication > Modèles, passe la langue des emails en français.
4. **Créer la base Firestore.** Build > Firestore Database > Créer une base de données. Édition Standard, emplacement **europe-west** (par ex. `europe-west9` Paris ou `europe-west1` Belgique ; ce choix est définitif), démarre en **mode production**. Les vraies règles seront envoyées à l'étape suivante.
5. **Installer la CLI et se connecter.**
   ```bash
   npx firebase login
   npx firebase use missfrancebet      # ou l'ID réel du projet si missfrancebet était pris
   ```
6. **(Seulement si l'ID était pris)** Crée le site et relie-le :
   ```bash
   npx firebase hosting:sites:create missfrancebet
   npx firebase target:apply hosting app missfrancebet
   ```
   puis dans `firebase.json`, ajoute `"target": "app"` dans l'objet `hosting`. Mets à jour `.firebaserc` (`default` = l'ID réel) et `VITE_FIREBASE_PROJECT_ID` dans `.env.local`. Ajoute `missfrancebet.web.app` aux domaines autorisés (étape 3).
7. **Construire et déployer.**
   ```bash
   npm run build
   npx firebase deploy
   ```
   Cela envoie les règles Firestore, les index et le site. L'app est en ligne sur https://missfrancebet.web.app.
8. **Te rendre admin.** Ouvre l'app, connecte-toi et choisis ton pseudo. Dans la console : Authentication > Utilisateurs, copie ton **UID**. Puis Firestore > « Commencer une collection » : ID de collection `admins`, ID du document = ton UID, aucun champ (ou un champ quelconque). Recharge l'app : l'onglet Admin apparaît.
9. **Préparer la soirée.** Dans l'onglet Admin : crée l'édition (id `2027`, date de l'émission, code de soirée), importe les candidates, puis partage l'adresse et le code à tes amis.

Pour les mises à jour suivantes : `npm run build && npx firebase deploy`.
