# Spécification — Pronos Miss

Web app privée (PWA) de pronostics pour l'élection Miss France, entre amis. Chaque groupe d'amis crée sa **party** pour l'édition de l'année, et l'app fonctionne sans intervention du porteur du projet d'une année sur l'autre.
Première édition : **Miss France 2027**, diffusée le **samedi 12 décembre 2026** sur TF1. L'app doit être en ligne au plus tard le 5 décembre.

## Vocabulaire
- **Édition** : une année de Miss France (2027, 2028…). Son titre, sa date et ses candidates sont **embarqués dans l'app** (`src/data/editions/<année>/`), pas dans Firestore.
- **Party** : un groupe d'amis qui joue ensemble une édition. Elle est créée par un joueur, qui en devient l'**admin**, et on la rejoint avec un **code d'invitation**.
- **Super admin** : le porteur du projet (document `admins/{uid}`). Il voit et gère toutes les parties, mais l'app n'a pas besoin de lui pour fonctionner.

## Règles du jeu
- N'importe quel joueur connecté peut **créer une party** pour l'édition en cours. Il en devient l'admin et membre, et l'app génère un **code unique** de 6 caractères (sans 0/O ni 1/I/L).
- Les autres **rejoignent avec ce code** (saisi, ou via le lien `/rejoindre/<code>`). Tous les membres voient le code pour pouvoir inviter d'autres amis.
- Un joueur peut appartenir à plusieurs parties. Il a **un prono par party** : chaque party est un jeu indépendant.
- Chaque joueur choisit **une** candidate, celle qu'il voit gagner. Le choix est **modifiable tant que l'admin de la party n'a pas fermé les pronos**. Chaque changement est enregistré dans un historique horodaté par le serveur, qu'on ne peut ni modifier ni supprimer.
- **Avant la fermeture**, un joueur ne voit que son propre prono. Ceux des autres sont illisibles **pour tout le monde, admin de la party et super admin compris** (l'admin joue aussi). C'est garanti par les règles Firestore.
- **Après la fermeture**, tous les pronos et tous les historiques de la party deviennent visibles de ses membres (révélation), et plus aucune écriture de prono n'est possible.
- Pendant l'émission, **l'admin de la party** saisit le **top 15**, puis le **top 5**, puis le **podium** (gagnante, 1re dauphine, 2e dauphine). Chaque party a ses propres résultats. Chaque joueur voit si sa candidate est "en course" ou "éliminée".
- Trophées : 🥇 si ta candidate est élue, 🥈 si elle est 1re dauphine, 🥉 si elle est 2e dauphine. Sinon, rien. Les trophées sont conservés **sur toutes les parties de toutes les éditions** et affichés sur le profil.

## Phases d'une party (`status`)
`open` (pronos ouverts) → `closed` (fermés et révélés, émission en cours) → `finished` (podium saisi, trophées attribués).
Seuls l'admin de la party et le super admin changent de phase. Le retour en arrière est permis, mais **chaque changement de phase est journalisé** (de, vers, par qui, heure serveur) dans un journal immuable que tous les membres voient (« Olga a rouvert les pronos à 21h04 »).

## Comptes
- Connexion **Google** (OAuth) ou **email + mot de passe**, avec "mot de passe oublié" (email Firebase natif). Les deux sont gratuits sur le plan Spark.
- Sur iOS en mode installé (standalone), la popup est peu fiable : il faut utiliser `signInWithRedirect` sur mobile et `signInWithPopup` sur desktop. `authDomain` doit être le domaine d'hébergement Firebase (`missfrancebet.web.app`), pour éviter les problèmes de cookies tiers sur Safari.
- Après la première connexion, l'onboarding demande un **pseudo** (2 à 20 caractères, unique) et un **emoji avatar**.
- Super admin : un document `admins/{uid}` créé à la main dans la console Firebase. Aucune interface ne permet de le devenir.

## Écrans (routes)
| Route | Contenu |
|---|---|
| `/connexion` | Google + email/mot de passe, création de compte, mot de passe oublié |
| `/bienvenue` | Onboarding : pseudo + emoji (une seule fois) |
| `/rejoindre/:code?` | Saisie du code d'une party ; `/rejoindre/K7QMZ3` = lien d'invitation, code pré-rempli. Si on n'est pas connecté, on y revient après la connexion |
| `/parties` | Mes parties de l'édition en cours (et des précédentes) : choisir la **party active**, **créer** une party (nom), **rejoindre** avec un code |
| `/` | Accueil : la date de l'émission, un compte à rebours, la party active, mon écharpe (mon prono), l'action suivante selon la phase. Sans party : « Crée ta party ou rejoins celle de tes amis » |
| `/candidates` | Grille des candidates de l'édition, ma candidate (dans la party active) mise en avant, statut en course ou éliminée une fois les pronos fermés |
| `/candidates/:id` | Fiche (photo en pied, âge, taille, origine, profession, passions, Instagram) et bouton "Choisir Miss <Région>" (désactivé si fermé ou sans party) |
| `/soiree` | Party active. Avant la fermeture : le nombre de joueurs ayant pronostiqué (sans dire qui a choisi quoi) et le code d'invitation à partager. Après : le prono de chaque joueur sous forme d'écharpe, le statut en direct, le nombre de changements d'avis et l'historique dépliable ; puis le podium et les trophées. Le journal des phases. Bouton « Gérer la party » si j'en suis l'admin |
| `/soiree/gestion` | Admin de la party active (ou super admin) : renommer, changer de phase (fermer, rouvrir, terminer), saisir top 15 / top 5 / podium, retirer un membre, code d'invitation à partager |
| `/profil` | Pseudo, emoji (modifiables), mes trophées de toutes les parties et éditions, déconnexion |
| `/admin` | Super admin uniquement : liste de toutes les parties (édition, nom, admin, nombre de membres, phase), accès à la gestion de n'importe laquelle |
| — | Bandeau "Installer l'app" : un tuto en 3 étapes sur iOS Safari (Partager → Sur l'écran d'accueil), le prompt natif sur Android |

La **party active** est mémorisée sur l'appareil (`useActivePartyId`). Si elle n'est plus valide, l'app prend la plus récente de l'édition en cours.

## Modèle de données Firestore
```
admins/{uid}                                   {}  (super admin, créé à la main)
users/{uid}                                    displayName, displayNameLower, emoji, createdAt
usernames/{displayNameLower}                   uid   (unicité des pseudos)
partyCodes/{CODE}                              partyId, editionId  (l'id EST le code : unicité ; get seulement, pas de list)
parties/{p}                                    editionId, name, ownerUid, code, status, statusChanges, createdAt
parties/{p}/members/{uid}                      uid, editionId, joinedAt, hasPicked  (aucun code stocké)
parties/{p}/joinProofs/{uid}                   code  (preuve écrite avec l'adhésion, comparée à parties/{p}.code ; illisible par tous ; supprimée aussitôt)
parties/{p}/events/{n}                         from, to, by, at (== request.time)  (journal des phases, n = statusChanges)
parties/{p}/picks/{uid}                        candidateId, changeCount, updatedAt (== request.time)
parties/{p}/pickHistory/{uid}_{changeCount}    uid, candidateId, changeCount, at (== request.time)
parties/{p}/results/live                       top15: id[], top5: id[], winner, firstRunnerUp, secondRunnerUp, updatedAt
```
- **Créer une party** = un batch : `parties/{p}` + `partyCodes/{code}` + `members/{créateur}`. Si le code existe déjà, l'écriture est refusée et l'app en tire un autre.
- **Rejoindre** = lire `partyCodes/{code}`, puis un batch `joinProofs/{moi}` + `members/{moi}` ; les règles comparent la preuve au code de la party.
- **Changer de phase** = un batch : `parties/{p}` (status, statusChanges + 1) + `events/{statusChanges}`.
- Un prono s'écrit en **batch** : `picks/{uid}` et `pickHistory/{uid}_{n}` ensemble, plus `members/{uid}.hasPicked`. Les règles imposent la cohérence avec `getAfter`/`existsAfter` : `changeCount` augmente de 1 exactement, la candidate est la même et l'horodatage est `request.time`.
- Les candidates étant embarquées, les règles ne vérifient que le format de `candidateId` ; l'app vérifie qu'elle existe. Un id inventé ne ferait gagner aucun trophée.
- Statut d'une candidate, calculé côté client :
  - `open` : neutre ;
  - après la fermeture, avant le top 15 : en course ;
  - top 15 saisi : éliminée si absente du top 15 ;
  - top 5 saisi : éliminée si absente du top 5 ;
  - podium saisi : 1re, 2e ou 3e place, les autres éliminées.
- Les trophées sont calculés côté client à partir de `picks` et `results`, sur toutes les parties `finished` dont l'utilisateur est membre (requête collection group sur `members.uid`).

## Données et assets
- `src/data/editions/2027/edition.json` : titre et date de l'émission (écrit à la main, une fois par an).
- `src/data/editions/2027/candidates.json` : les 31 candidates (généré par `scripts/prep_data.py`, ne pas modifier à la main).
- `public/candidates/2027/<id>.webp` (portrait 3:4) et `<id>-full.webp` (photo en pied) : générés.
- Rien n'est importé dans Firestore. L'édition la plus récente embarquée est l'**édition en cours**.

## Contraintes
- **0 €** : Firebase plan Spark (Auth, Firestore, Hosting). Aucune Cloud Function, aucun Storage.
- Stack : Vite, React, TypeScript strict, react-router, Firebase JS SDK modulaire, vite-plugin-pwa. CSS natif avec custom properties (tokens de `docs/DESIGN.md`), sans framework UI.
- Pages non indexées (`<meta name="robots" content="noindex">` et `robots.txt` qui bloque tout).
- Accessibilité : focus visible, cibles tactiles de 44 px minimum, `prefers-reduced-motion` respecté.
- Langue de l'interface : français, tutoiement.
