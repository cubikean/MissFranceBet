# AGENTS.md — MissFranceBet (Pronos Miss)

Ce fichier est **la référence unique** du projet, pour tout agent (Claude Code, Codex, Cursor…) comme pour un humain qui reprend le travail. Lis-le en entier avant toute tâche. S'il contredit un autre document, c'est lui qui prime, sauf si le porteur du projet a dit autre chose depuis : dans ce cas, mets ce fichier à jour.

Documents liés :
- [`docs/SPEC.md`](docs/SPEC.md) : spécification fonctionnelle et modèle de données détaillé
- [`docs/DESIGN.md`](docs/DESIGN.md) : direction visuelle, tokens, ton des textes
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) : arborescence, API de `src/lib`, commandes (maintenu par les agents de dev)

---

## 1. L'idée en une phrase

Une web app **privée** de **pronostics** pour l'élection Miss France, entre amis : chaque groupe crée sa **party** pour l'édition de l'année et invite ses amis avec un code, chacun choisit la candidate qu'il voit gagner, l'app suit l'émission en direct et distribue des trophées à la fin. Les trophées sont conservés d'une année sur l'autre. L'app doit **fonctionner sans le porteur du projet** les années suivantes.

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
| 2026-11-21 | Usage privé, ~20 amis, une soirée par an | Contexte réel du projet (élargi : plusieurs parties possibles, voir plus bas) |
| 2026-11-21 | **Un seul prono par joueur et par édition** : la gagnante | Simplicité ; choix du porteur (lecture "a"). Devenu : un prono par joueur et **par party** |
| 2026-11-21 | Trophées : 🥇 si ta candidate gagne, 🥈 si elle est 1re dauphine, 🥉 si elle est 2e dauphine | Choix du porteur |
| 2026-11-21 | Le prono est **modifiable jusqu'à la fermeture** ; chaque changement est historisé (horodatage serveur, aucune modification ni suppression possible) | Anti-triche |
| 2026-11-21 | **Bouton "Fermer les pronos"** manuel dans le back-office | La fermeture se fait au moment choisi par l'admin (de la party) |
| 2026-11-21 | Les pronos des autres sont **cachés jusqu'à la fermeture**, puis révélés | Évite que tout le monde copie le favori |
| 2026-11-21 | Statut **"en course / éliminée"** pendant l'émission (top 15, top 5, podium) | Faire vivre l'app pendant la soirée |
| 2026-11-21 | Résultats **saisis à la main** par l'admin de la party (pas de scraping ni d'API) | Aucune API officielle n'existe ; la télé en direct est plus rapide et plus fiable que n'importe quelle source web |
| 2026-11-21 | Pas de co-admin pour l'instant | Choix du porteur (une party = un admin, son créateur) |
| 2026-11-21 | **Comptes réels** : Google OAuth + email/mot de passe (avec "mot de passe oublié") | L'historique doit survivre à un navigateur vidé ou à un changement de téléphone |
| 2026-11-21 | Onboarding : pseudo unique + emoji avatar ; **code de soirée** pour rejoindre une édition | Restreindre l'accès aux invités. **Remplacé** : code d'invitation par party (voir plus bas) |
| 2026-11-21 | **Historique sur toutes les éditions** (notion d'"édition" par année) | Choix du porteur |
| 2026-11-21 | **Firebase, plan Spark (gratuit)** : Auth, Firestore, Hosting. **Pas de Cloud Functions ni de Storage** | Gratuit et sans mise en pause. Supabase est écarté parce que son plan gratuit met en pause les projets inactifs depuis 7 jours, ce qui ne convient pas à une app utilisée une fois par an. Storage exige le plan Blaze |
| 2026-11-21 | Photos des candidates **embarquées en statique** dans `public/` | Pas de Storage sur Spark |
| 2026-11-21 | Avatars = emojis (pas d'upload) | Pas de Storage, et c'est plus simple |
| 2026-11-21 | Stack front : Vite + React + TypeScript strict + react-router + vite-plugin-pwa, CSS natif avec tokens | Compétences du porteur, aucune dépendance UI lourde |
| 2026-11-21 | Direction visuelle "l'écharpe" (voir DESIGN.md) | L'écharpe bleu marine des photos officielles devient la signature de l'app |
| 2026-11-21 | Domaine : **missfrancebet.web.app**. L'ID du projet Firebase (et du site Hosting) est `missfrancebet` ; `authDomain` vaut `missfrancebet.web.app` | Gratuit et immédiat ; choix du porteur |
| 2026-11-21 | Le code de soirée n'est **stocké nulle part côté membres** : preuve temporaire `joinProofs/{uid}` vérifiée par les règles puis supprimée | Le code ne sert qu'à rejoindre ; choix du porteur |
| 2026-11-21 | **Parties** : chaque joueur peut créer une party pour l'édition en cours ; **son créateur en est l'admin** ; un **code unique** de 6 caractères est généré ; les autres rejoignent avec ce code. Un joueur peut être dans plusieurs parties (un prono par party) | L'app doit vivre sans le porteur les années suivantes ; choix du porteur |
| 2026-11-21 | **Super admin** (`admins/{uid}`, le porteur) : voit et gère toutes les parties. Il n'est **pas nécessaire** au fonctionnement | Garder la main sans être indispensable |
| 2026-11-21 | **Résultats saisis par l'admin de chaque party** (chaque party a ses propres résultats) | Autonomie totale ; tous regardent la même émission |
| 2026-11-21 | **Éditions et candidates embarquées dans l'app** (`src/data/editions/<année>/edition.json` + `candidates.json`), plus dans Firestore ; plus d'import admin | Photos de qualité, 0 € ; la seule tâche annuelle est de générer les données et déployer |
| 2026-11-21 | Le **code d'une party est visible de tous ses membres** (pour inviter), jamais listable par les autres | Comme un lien d'invitation de groupe ; choix du porteur |
| 2026-11-21 | **Réouverture des pronos permise mais journalisée** : chaque changement de phase est écrit dans un journal immuable visible des membres | L'admin joue aussi : la transparence remplace l'interdiction ; choix du porteur |
| 2026-11-21 | **Avant la fermeture, personne ne voit les pronos des autres**, ni l'admin de la party ni le super admin | L'admin de la party est aussi joueur |
| 2026-11-21 | Un membre peut **quitter** la party quand il veut, après une popup de confirmation ; son prono reste (il le retrouve s'il revient). L'admin doit d'abord transmettre son rôle | Choix du porteur |
| 2026-11-21 | L'admin peut **transmettre son rôle** à un autre membre (journalisé) | Pas de party bloquée si son créateur disparaît |
| 2026-11-21 | L'admin peut **supprimer sa party**, avec une double confirmation à la GitHub : recopier « je confirme la suppression de la party » | Choix du porteur |
| 2026-11-21 | **Sauvegarde** : bouton super admin qui télécharge un JSON, à faire après chaque soirée | Aucune sauvegarde automatique sur Spark ; procédé le plus simple |
| 2026-11-21 | Le porteur prépare lui-même, en amont, les données de chaque nouvelle édition | Choix du porteur |
| 2026-11-21 | Inscription ouverte à tout compte : sans code, on ne voit aucune party | Choix du porteur |
| 2026-11-21 | Emailing propre (mot de passe oublié hors spam) : plus tard, selon l'avancement | Un plus, pas un prérequis |
| 2026-11-21 | **Pas de validation des membres** par l'admin ; à la place, l'admin peut **changer le code** (l'ancien lien cesse de marcher) et **Firebase App Check** (gratuit) bloque les bots | Deviner un code est irréaliste (31^6 ≈ 887 millions) ; le vrai risque d'un bot est d'épuiser le quota gratuit. Aucune friction pour les joueurs |
| 2026-11-21 | Skill de design **UI UX Pro Max** installée dans `.claude/skills/ui-ux-pro-max/` (MIT, nextlevelbuilder) pour les agents qui font de l'interface | Demande du porteur |

## 4. Règles du jeu (résumé ; le détail est dans SPEC.md)

1. Je me connecte (Google ou email), je choisis un pseudo et un emoji.
2. Je **crée une party** pour l'édition en cours (j'en deviens l'admin, l'app me donne un code) **ou j'en rejoins une** avec le code ou le lien `/rejoindre/<code>` qu'un ami m'a envoyé.
3. Je parcours les candidates et j'en **choisis une** pour ma party. Je peux changer d'avis autant que je veux tant que les pronos sont ouverts. Chaque changement est horodaté par le serveur.
4. L'admin de la party ferme les pronos. Plus aucun changement n'est possible et **tous les pronos de la party sont révélés**, avec l'historique des changements d'avis.
5. Pendant l'émission, l'admin de la party saisit le top 15, puis le top 5, puis le podium. Chacun voit en direct si sa candidate est encore en course.
6. À la fin, chacun reçoit 🥇, 🥈, 🥉 ou rien, selon la place de sa candidate. Les trophées restent sur le profil d'année en année.

**Phases d'une party** : `open` → `closed` → `finished`. Seuls l'admin de la party et le super admin les changent. Le retour en arrière est permis, et chaque changement de phase est journalisé, visible de tous les membres.

**Vie d'une party** : un membre peut la quitter (confirmation) ; l'admin peut transmettre son rôle (journalisé), retirer un membre, ou supprimer la party (phrase à recopier). Détail dans SPEC.md.

## 5. Écrans

`/connexion`, `/bienvenue` (onboarding), `/rejoindre/:code?` (code ou lien d'invitation), `/parties` (mes parties : choisir l'active, créer, rejoindre), `/` (accueil), `/candidates`, `/candidates/:id`, `/soiree` (live et révélation de la party active), `/soiree/gestion` (admin de la party), `/profil`, `/admin` (super admin : toutes les parties).
On navigue avec une barre d'onglets en bas : Accueil, Candidates, Soirée, Profil, plus Admin si l'utilisateur est super admin. La gestion de la party est un bouton dans Soirée. Un bandeau d'installation PWA explique la manipulation sur iOS (Safari → Partager → "Sur l'écran d'accueil"). Le détail de chaque écran est dans SPEC.md.

## 6. Exigences non négociables

- **Anti-triche garanti côté serveur** (règles Firestore), jamais seulement dans l'interface :
  - un joueur ne peut écrire que son propre prono, et seulement dans une party dont il est membre ;
  - aucune écriture de prono n'est possible après la fermeture ;
  - l'horodatage vaut `request.time` ;
  - le prono et son historique sont écrits ensemble, en batch, et restent cohérents (`getAfter` / `existsAfter`) ;
  - l'historique et le journal des phases sont en création seule ;
  - les pronos des autres sont illisibles avant la fermeture, **par tout le monde** (admin de la party et super admin compris) ;
  - on ne rejoint une party qu'en prouvant qu'on connaît son code ; le code n'est lisible que par les membres, et les codes ne sont pas listables ;
  - seuls l'admin de la party (son créateur) et le super admin changent la phase, saisissent les résultats et retirent des membres ; tout changement de phase est journalisé ;
  - devenir super admin, ou prendre la place du créateur d'une party, est impossible depuis le client.
- **Chaque règle a un test** dans `tests/rules/`. Toute modification de `firestore.rules` doit être accompagnée de tests qui passent.
- **0 €** : n'ajoute aucune dépendance à un service payant, ni rien qui exige le plan Blaze.
- **Mobile d'abord** (360–430 px), cibles tactiles de 44 px, focus visible, `prefers-reduced-motion` respecté.
- **Français partout**, tutoiement. Les données des candidates (`src/data/editions/*/candidates.json`) et les photos (`public/candidates/*`) sont générées : on ne les modifie pas à la main. `edition.json` (titre et date) est écrit à la main.
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
| Fondations | Scaffold, Firebase, couche données `src/lib`, règles Firestore et tests, README, ARCHITECTURE.md | Terminé (modèle par party) |
| Front joueur | Connexion, onboarding, parties (créer, rejoindre, choisir), accueil, candidates, fiche, soirée, profil, bandeau d'installation | En cours |
| Gestion | `/soiree/gestion` (admin de party : phases, résultats, membres, code) et `/admin` (super admin : toutes les parties) | En cours |
| QA | Revue indépendante, tentatives de triche, test mobile, vérification du parcours complet | À la fin |

Règles de collaboration :
- **La couche `src/lib` est le contrat** entre les agents. Les écrans ne parlent jamais à Firestore directement : ils passent par les hooks et fonctions de `src/lib`. S'il manque une fonction, on l'ajoute dans `src/lib` avec ses types, sans contourner le contrat.
- Le composant `Sash` (l'écharpe) est partagé : on ne le duplique pas.
- Pour tout travail d'interface, utiliser la skill **`ui-ux-pro-max`** (`.claude/skills/ui-ux-pro-max/`, script `scripts/search.py`) comme référence UX et accessibilité. Ses résultats sont des **recommandations** : `docs/DESIGN.md` et les décisions de ce fichier priment toujours (par exemple, la direction "l'écharpe", les tokens existants et les avatars emoji, qui sont un contenu choisi par le joueur et non des icônes). On ne lance pas son mode qui persiste un design system dans le dépôt sans l'accord du porteur.
- Les agents ne committent pas eux-mêmes, sauf consigne explicite : c'est le chef de projet qui intègre.

## 9. Roadmap

| Jalon | Contenu | Échéance cible |
|---|---|---|
| J0 | Cadrage, données, design, spec | 21/11 ✅ |
| J1 | Fondations : scaffold, Firebase, règles et tests | 21/11 ✅ |
| J2 | Écrans joueur + back-office | 24/11 |
| J3 | QA, corrections, mise en ligne sur Firebase (projet créé par le porteur) | 27/11 |
| J4 | Répétition générale : le porteur et 2–3 amis jouent une party de test complète (inscription → création de party → invitation → prono → fermeture → résultats) | 29/11 |
| J5 | Création de la party 2027 réelle et envoi du lien d'invitation aux amis | ≤ 05/12 |
| J6 | Soirée : l'admin de la party (le porteur) saisit les résultats pendant l'émission | 12/12 |
| Plus tard | Idées hors périmètre V1 (à ne pas faire sans accord) : co-admin, pronos sur le top 5, mode TV plein écran, notifications push | — |

## 9 bis. État du projet et reprise (mis à jour le 21/11/2026)

**Fait et poussé sur `dev` :**
- Cadrage : ce fichier, `docs/SPEC.md`, `docs/DESIGN.md`
- Données 2027 : `src/data/editions/2027/candidates.json` (31 candidates) et `public/candidates/2027/*.webp`
- `scripts/prep_data.py`, qui régénère ces données à partir des photos

**Jalon J1 Fondations terminé et fusionné dans `dev` :**
- Scaffold Vite/React/TS/PWA, `firebase.json`, `.firebaserc` (missfrancebet), le composant `Sash`, des pages placeholder pour toutes les routes, le README avec la mise en ligne pas à pas
- **Modèle par party** (décisions du 21/11) : `src/lib` (le contrat, API dans `docs/ARCHITECTURE.md`), `firestore.rules`, `firestore.indexes.json`, `src/data/editions/2027/edition.json`
- Quitter, transmettre le rôle d'admin, supprimer une party (double confirmation), changer le code d'invitation, sauvegarde JSON super admin, App Check (activé dès qu'une clé reCAPTCHA est fournie)
- Skill de design `ui-ux-pro-max` installée pour les agents d'interface
- `typecheck`, `lint` et `build` passent ; 7/7 tests unitaires ; **78/78 tests des règles sur l'émulateur**, contrôlés par mutation (casser une règle fait échouer un test)
- Sous Windows : JDK 21 requis pour l'émulateur, et vitest à lancer depuis un chemin `C:\` en majuscule (voir ARCHITECTURE.md)
- Limites connues : voir "Reste à faire" dans `docs/ARCHITECTURE.md` (écrans à construire, retour après connexion pour les liens d'invitation, bundle de 900 kB, `Sash` jamais vu dans un navigateur)

**Pour reprendre :**
1. Agents Front joueur et Gestion lancés en parallèle le 21/11 (section 8), avec `src/lib` comme contrat
2. Agent QA, puis mise en ligne. Le porteur doit d'abord créer le projet Firebase `missfrancebet` (plan Spark) en suivant le README, et fournir la config web pour `.env.local`

## 10. Préparer l'édition suivante (2028 et après), même sans le porteur

C'est la **seule tâche annuelle**. Le porteur la fait lui-même en amont ; à défaut, quelqu'un qui sait lancer un script et déployer (le README guide pas à pas) :
1. Récupérer la liste des candidates (une Sheet à jour) et leurs photos (zip).
2. Générer `src/data/editions/<année>/candidates.json` et `public/candidates/<année>/*.webp` avec `scripts/prep_data.py` (à adapter : liste des candidates, année, nommage des photos).
3. Écrire `src/data/editions/<année>/edition.json` (`editionId`, `title`, `showAt` avec fuseau).
4. `npm run build && npx firebase deploy`. La nouvelle édition devient l'édition en cours : chacun peut créer sa party.
5. Les parties passées restent intactes : les trophées s'accumulent sur les profils.

Il faut aussi que quelqu'un d'autre que le porteur ait accès au projet Firebase (rôle Propriétaire ou Éditeur dans la console) et au dépôt GitHub, sinon personne ne pourra déployer.

## 11. Questions ouvertes

- Si l'ID `missfrancebet` est déjà pris chez Firebase, on garde un ID de projet différent et on crée un site Hosting supplémentaire nommé `missfrancebet` (ce qui est possible sur Spark).
- L'identité visuelle finale reste à valider par le porteur sur les premiers écrans.
- Date et heure exactes de l'émission 2027 (21h10 provisoire) : à reconfirmer par le porteur.
