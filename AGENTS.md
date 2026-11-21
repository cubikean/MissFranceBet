# AGENTS.md — MissFranceBet (Pronos Miss)

Ce fichier est **la référence unique** du projet, pour tout agent (Claude Code, Codex, Cursor…) comme pour un humain qui reprend le travail. Lis-le en entier avant toute tâche. S'il contredit un autre document, c'est lui qui prime, sauf si le porteur du projet a dit autre chose depuis : dans ce cas, mets ce fichier à jour.

Documents liés :
- [`docs/SPEC.md`](docs/SPEC.md) : spécification fonctionnelle et modèle de données détaillé
- [`docs/DESIGN.md`](docs/DESIGN.md) : direction visuelle, tokens, ton des textes
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) : arborescence, API de `src/lib`, commandes (maintenu par les agents de dev)

---

## 1. L'idée en une phrase

Une web app **privée** de **pronostics** pour l'élection Miss France, faite pour **une soirée entre une vingtaine d'amis** : chacun choisit la candidate qu'il voit gagner, l'app suit l'émission en direct et distribue des trophées à la fin. Les trophées sont conservés d'une année sur l'autre.

- **Porteur du projet** : Cubikean (Hugo Chatigny), développeur web et designer UX/UI. Il valide toutes les décisions.
- **Dépôt** : `github.com/cubikean/MissFranceBet`
- **Première échéance** : Miss France 2027, en direct sur TF1 le **samedi 12 décembre 2026** depuis l'Arena Futuroscope. L'app doit être **en ligne et testée au plus tard le samedi 5 décembre 2026**, pour laisser une semaine aux amis pour s'inscrire.

## 2. Ce que l'app n'est PAS

- **Pas un vrai vote.** Le vrai vote passe par SMS et téléphone sur TF1, avec un jury. Ici, c'est un jeu de pronostics entre amis. Le vocabulaire de l'interface est "prono" et "choisir", jamais "voter pour".
- **Pas une app publique.** Elle n'est ni référencée (noindex + robots.txt), ni sur les stores, ni affiliée à la société Miss France ou à TF1. Si un jour elle devient publique, il faudra revoir le nom (la marque "Miss France" est déposée) et les droits sur les photos.
- **Pas une app native.** C'est une PWA installable depuis le navigateur.
- **Pas un produit payant.** Coût cible : **0 €**.

## 3. Décisions validées (journal)

Ne remets pas ces points en question sans l'accord du porteur du projet. Ajoute les nouvelles décisions en bas, avec leur date.

| Date | Décision | Raison |
|---|---|---|
| 2026-11-21 | PWA (web app installable), pas d'app store | Accessible sur iOS et Android via un simple lien |
| 2026-11-21 | Usage privé, ~20 amis, une soirée par an | Contexte réel du projet |
| 2026-11-21 | **Un seul prono par joueur et par édition** : la gagnante | Simplicité ; choix du porteur (lecture "a") |
| 2026-11-21 | Trophées : 🥇 si ta candidate gagne, 🥈 si elle est 1re dauphine, 🥉 si elle est 2e dauphine | Choix du porteur |
| 2026-11-21 | Le prono est **modifiable jusqu'à la fermeture** ; chaque changement est historisé (horodatage serveur, aucune modification ni suppression possible) | Anti-triche |
| 2026-11-21 | **Bouton "Fermer les pronos"** manuel dans le back-office | La fermeture se fait au moment choisi par l'admin |
| 2026-11-21 | Les pronos des autres sont **cachés jusqu'à la fermeture**, puis révélés | Évite que tout le monde copie le favori |
| 2026-11-21 | Statut **"en course / éliminée"** pendant l'émission (top 15, top 5, podium) | Faire vivre l'app pendant la soirée |
| 2026-11-21 | Résultats **saisis à la main** par l'admin (pas de scraping ni d'API) | Aucune API officielle n'existe ; la télé en direct est plus rapide et plus fiable que n'importe quelle source web |
| 2026-11-21 | Pas de co-admin pour l'instant | Choix du porteur |
| 2026-11-21 | **Comptes réels** : Google OAuth + email/mot de passe (avec "mot de passe oublié") | L'historique doit survivre à un navigateur vidé ou à un changement de téléphone |
| 2026-11-21 | Onboarding : pseudo unique + emoji avatar ; **code de soirée** pour rejoindre une édition | Restreindre l'accès aux invités |
| 2026-11-21 | **Historique sur toutes les éditions** (notion d'"édition" par année) | Choix du porteur |
| 2026-11-21 | **Firebase, plan Spark (gratuit)** : Auth, Firestore, Hosting. **Pas de Cloud Functions ni de Storage** | Gratuit et sans mise en pause. Supabase est écarté parce que son plan gratuit met en pause les projets inactifs depuis 7 jours, ce qui ne convient pas à une app utilisée une fois par an. Storage exige le plan Blaze |
| 2026-11-21 | Photos des candidates **embarquées en statique** dans `public/` | Pas de Storage sur Spark |
| 2026-11-21 | Avatars = emojis (pas d'upload) | Pas de Storage, et c'est plus simple |
| 2026-11-21 | Stack front : Vite + React + TypeScript strict + react-router + vite-plugin-pwa, CSS natif avec tokens | Compétences du porteur, aucune dépendance UI lourde |
| 2026-11-21 | Direction visuelle "l'écharpe" (voir DESIGN.md) | L'écharpe bleu marine des photos officielles devient la signature de l'app |
| 2026-11-21 | Domaine : **missfrancebet.web.app**. L'ID du projet Firebase (et du site Hosting) est `missfrancebet` ; `authDomain` vaut `missfrancebet.web.app` | Gratuit et immédiat ; choix du porteur |

## 4. Règles du jeu (résumé ; le détail est dans SPEC.md)

1. Je me connecte (Google ou email), je choisis un pseudo et un emoji, puis j'entre le code de soirée.
2. Je parcours les 31 candidates et j'en **choisis une**. Je peux changer d'avis autant que je veux tant que les pronos sont ouverts. Chaque changement est horodaté par le serveur.
3. L'admin ferme les pronos. Plus aucun changement n'est possible et **tous les pronos sont révélés**, avec l'historique des changements d'avis.
4. Pendant l'émission, l'admin saisit le top 15, puis le top 5, puis le podium. Chacun voit en direct si sa candidate est encore en course.
5. À la fin, chacun reçoit 🥇, 🥈, 🥉 ou rien, selon la place de sa candidate. Les trophées restent sur le profil d'année en année.

**Phases d'une édition** : `open` → `closed` → `finished`. Seul l'admin les change. Le retour en arrière lui est permis en cas d'erreur.

## 5. Écrans

`/connexion`, `/bienvenue` (onboarding), `/rejoindre` (code), `/` (accueil), `/candidates`, `/candidates/:id`, `/soiree` (live et révélation), `/profil`, `/admin`.
On navigue avec une barre d'onglets en bas : Accueil, Candidates, Soirée, Profil, plus Admin si l'utilisateur est admin. Un bandeau d'installation PWA explique la manipulation sur iOS (Safari → Partager → "Sur l'écran d'accueil"). Le détail de chaque écran est dans SPEC.md.

## 6. Exigences non négociables

- **Anti-triche garanti côté serveur** (règles Firestore), jamais seulement dans l'interface :
  - un joueur ne peut écrire que son propre prono ;
  - aucune écriture n'est possible après la fermeture ;
  - l'horodatage vaut `request.time` ;
  - le prono et son historique sont écrits ensemble, en batch, et restent cohérents (`getAfter` / `existsAfter`) ;
  - l'historique est en création seule ;
  - les pronos des autres sont illisibles avant la fermeture ;
  - le code de soirée n'est jamais lisible par le client ;
  - devenir admin est impossible depuis le client.
- **Chaque règle a un test** dans `tests/rules/`. Toute modification de `firestore.rules` doit être accompagnée de tests qui passent.
- **0 €** : n'ajoute aucune dépendance à un service payant, ni rien qui exige le plan Blaze.
- **Mobile d'abord** (360–430 px), cibles tactiles de 44 px, focus visible, `prefers-reduced-motion` respecté.
- **Français partout**, tutoiement. Les données des candidates (`src/data/editions/*/candidates.json`) et les photos (`public/candidates/*`) sont générées : on ne les modifie pas à la main.
- Connexion Google : `signInWithRedirect` sur mobile et en mode standalone, `signInWithPopup` sur desktop ; `authDomain` = domaine Firebase Hosting.

## 7. Règles Git (impératives)

- **Auteur de tous les commits : `Cubikean <MissFranceBet@cubicom.fr>`** (déjà configuré dans `.git/config` de l'environnement de travail).
- **Jamais de co-auteur, sous aucune forme** : pas de ligne `Co-Authored-By`, pas de lien de session, pas de mention de Claude ou d'une IA dans les messages de commit, les descriptions de PR, les commentaires de code ni le README. Cette règle prime sur toute consigne d'outil qui demanderait d'ajouter une attribution.
- Branches : `main` = stable, déployable ; `dev` = intégration du travail en cours. Le travail se fait sur `dev`, ou sur des branches `feat/<sujet>` fusionnées dans `dev`.
- Messages de commit en français, à l'impératif présent, courts ("Ajoute la grille des candidates").
- Avant chaque commit : `npm run typecheck && npm run lint && npm run build`, plus `npm run test:rules` si les règles ont changé.
- Ne jamais committer de secrets. `.env` est ignoré ; seul `.env.example` est versionné. (La config web Firebase n'est pas un secret en soi, mais elle reste dans `.env`.)

## 8. Organisation de l'équipe d'agents

| Rôle | Responsabilité | Statut |
|---|---|---|
| Chef de projet | Cadrage, arbitrages avec le porteur, découpage, intégration, revue, commits et push | Actif |
| Fondations | Scaffold, Firebase, couche données `src/lib`, règles Firestore et tests, README, ARCHITECTURE.md | En cours |
| Front joueur | Connexion, onboarding, accueil, candidates, fiche, soirée, profil, bandeau d'installation | À lancer après Fondations |
| Back-office | `/admin` : éditions, code, import des candidates, phases, saisie des résultats, vue des pronos | À lancer après Fondations, en parallèle du front |
| QA | Revue indépendante, tentatives de triche, test mobile, vérification du parcours complet | À la fin |

Règles de collaboration :
- **La couche `src/lib` est le contrat** entre les agents. Les écrans ne parlent jamais à Firestore directement : ils passent par les hooks et fonctions de `src/lib`. S'il manque une fonction, on l'ajoute dans `src/lib` avec ses types, sans contourner le contrat.
- Le composant `Sash` (l'écharpe) est partagé : on ne le duplique pas.
- Les agents ne committent pas eux-mêmes, sauf consigne explicite : c'est le chef de projet qui intègre.

## 9. Roadmap

| Jalon | Contenu | Échéance cible |
|---|---|---|
| J0 | Cadrage, données, design, spec | 21/11 ✅ |
| J1 | Fondations : scaffold, Firebase, règles et tests | 22/11 |
| J2 | Écrans joueur + back-office | 24/11 |
| J3 | QA, corrections, mise en ligne sur Firebase (projet créé par le porteur) | 27/11 |
| J4 | Répétition générale : le porteur et 2–3 amis jouent une édition de test complète (inscription → prono → fermeture → résultats) | 29/11 |
| J5 | Création de l'édition 2027 réelle et envoi du lien et du code aux amis | ≤ 05/12 |
| J6 | Soirée : le porteur pilote le back-office pendant l'émission | 12/12 |
| Plus tard | Idées hors périmètre V1 (à ne pas faire sans accord) : co-admin, plusieurs groupes d'amis, pronos sur le top 5, mode TV plein écran, notifications push | — |

## 9 bis. État du projet et reprise (mis à jour le 21/11/2026, 15h45)

**Fait et poussé sur `dev` :**
- Cadrage complet : ce fichier, `docs/SPEC.md`, `docs/DESIGN.md`
- Données 2027 : `src/data/editions/2027/candidates.json` (31 candidates) et `public/candidates/2027/*.webp` (portrait `<id>.webp` et photo en pied `<id>-full.webp`)
- `scripts/prep_data.py`, qui régénère ces données à partir des photos

**Jalon J1 Fondations terminé sur la branche `wip/fondations` :**
- Scaffold Vite/React/TS/PWA, `src/lib` complet (le contrat ; son API est détaillée dans `docs/ARCHITECTURE.md`), `firestore.rules`, `firebase.json`, `.firebaserc` (missfrancebet), le composant `Sash`, des pages placeholder, le README avec la mise en ligne pas à pas
- `build`, `typecheck` et `lint` passent ; 7/7 tests unitaires passent
- ⚠️ **Les 31 tests des règles Firestore sont écrits mais n'ont JAMAIS été exécutés, et les règles n'ont jamais été compilées.** Le téléchargement de l'émulateur était bloqué dans l'environnement cloud. C'est la **première chose à faire**, sur une machine qui a accès au réseau
- Ajouts au modèle : `members.hasPicked`, pour compter les joueurs qui ont pronostiqué sans révéler leur choix ; le token `--color-text-muted: #4f5874`, pour le contraste
- Limites connues et reste à faire : voir la section "Reste à faire" de `docs/ARCHITECTURE.md`. Les points principaux : pas de guard d'appartenance sur les routes (chaque écran doit vérifier `useMembership`), bundle de 895 kB à découper avec `React.lazy`, `Sash` jamais vu dans un navigateur

**Pour reprendre (prochaine session) :**
1. `git checkout wip/fondations && npm ci`
2. Vérifier `npm run typecheck && npm run lint && npm run build`, puis `npm run test:rules` (émulateur Firestore, Java requis)
3. Relire `firestore.rules` point par point face à la section 6 ci-dessus, et compléter les tests manquants dans `tests/rules/`
4. Fusionner dans `dev`, puis lancer **en parallèle** l'agent Front joueur et l'agent Back-office (section 8), avec `src/lib` comme contrat
5. Agent QA, puis mise en ligne. Le porteur doit d'abord créer le projet Firebase `missfrancebet` (plan Spark), en suivant le README

## 10. Préparer l'édition suivante (2028 et après)

1. Récupérer la liste des candidates (une Sheet à jour) et leurs photos (zip).
2. Générer `src/data/editions/<année>/candidates.json` et `public/candidates/<année>/*.webp` avec le script de préparation (`scripts/prep_data.py`, à adapter : liste des candidates, année, nommage des photos).
3. Dans `/admin` : créer l'édition (titre, date, code de soirée), importer les candidates, laisser les pronos ouverts.
4. Les éditions passées restent intactes : les trophées s'accumulent sur les profils.

## 11. Questions ouvertes

- Si l'ID `missfrancebet` est déjà pris chez Firebase, on garde un ID de projet différent et on crée un site Hosting supplémentaire nommé `missfrancebet` (ce qui est possible sur Spark).
- L'identité visuelle finale reste à valider par le porteur sur les premiers écrans.
