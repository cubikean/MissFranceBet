# Spécification — Pronos Miss

Web app privée (PWA) de pronostics pour l'élection Miss France, à utiliser entre ~20 amis.
Première édition : **Miss France 2027**, diffusée le **samedi 12 décembre 2026** sur TF1. L'app doit être en ligne au plus tard le 5 décembre.

## Règles du jeu
- Chaque joueur choisit **une** candidate par édition, celle qu'il voit gagner.
- Le choix est **modifiable tant que l'admin n'a pas fermé les pronos**. Chaque changement est enregistré dans un historique horodaté par le serveur, qu'on ne peut ni modifier ni supprimer.
- **Avant la fermeture**, un joueur ne voit que son propre prono. Les pronos et les historiques des autres sont illisibles, et c'est garanti côté serveur par les règles Firestore, pas seulement par l'interface.
- **Après la fermeture**, tous les pronos et tous les historiques deviennent visibles (révélation), et plus aucune écriture de prono n'est possible.
- Pendant l'émission, l'admin saisit le **top 15**, puis le **top 5**, puis le **podium** (gagnante, 1re dauphine, 2e dauphine). Chaque joueur voit si sa candidate est "en course" ou "éliminée".
- Trophées : 🥇 si ta candidate est élue, 🥈 si elle est 1re dauphine, 🥉 si elle est 2e dauphine. Sinon, rien.
- Les trophées sont conservés **sur toutes les éditions** et affichés sur le profil.

## Phases d'une édition (`status`)
`open` (pronos ouverts) → `closed` (fermés et révélés, émission en cours) → `finished` (podium saisi, trophées attribués).
Seul l'admin change de phase. Le retour en arrière est autorisé pour l'admin, en cas d'erreur de saisie.

## Comptes
- Connexion **Google** (OAuth) ou **email + mot de passe**, avec "mot de passe oublié" (email Firebase natif). Les deux sont gratuits sur le plan Spark.
- Sur iOS en mode installé (standalone), la popup est peu fiable : il faut utiliser `signInWithRedirect` sur mobile et `signInWithPopup` sur desktop. `authDomain` doit être le domaine d'hébergement Firebase (`<projet>.web.app`), pour éviter les problèmes de cookies tiers sur Safari.
- Après la première connexion, l'onboarding demande un **pseudo** (2 à 20 caractères, unique) et un **emoji avatar**.
- Pour rejoindre une édition, il faut entrer le **code de soirée**. Le code est vérifié par les règles Firestore et n'est jamais lisible par le client.
- Admin : un document `admins/{uid}` créé à la main dans la console Firebase. Aucune interface ne permet de devenir admin.

## Écrans (routes)
| Route | Contenu |
|---|---|
| `/connexion` | Google + email/mot de passe, création de compte, mot de passe oublié |
| `/bienvenue` | Onboarding : pseudo + emoji (une seule fois) |
| `/rejoindre` | Saisie du code de soirée de l'édition en cours |
| `/` | Accueil : ce qu'est le site, la date de l'émission, un compte à rebours, mon écharpe (mon prono), l'action suivante selon la phase |
| `/candidates` | Grille des 31 candidates, ma candidate mise en avant, statut en course ou éliminée une fois les pronos fermés |
| `/candidates/:id` | Fiche (photo en pied, âge, taille, origine, profession, passions, Instagram) et bouton "Choisir Miss <Région>" (désactivé si fermé) |
| `/soiree` | Avant la fermeture : le nombre de joueurs ayant pronostiqué (sans dire qui a choisi quoi). Après : le prono de chaque joueur sous forme d'écharpe, le statut en direct, le nombre de changements d'avis et l'historique dépliable ; puis le podium et les trophées |
| `/profil` | Pseudo, emoji (modifiables), mon prono de l'édition en cours, mes trophées de toutes les éditions, déconnexion |
| `/admin` | Admin uniquement : créer ou choisir une édition, définir le code de soirée et la date, importer les candidates depuis le JSON embarqué, changer de phase, saisir top 15 / top 5 / podium, voir tous les pronos et les historiques |
| — | Bandeau "Installer l'app" : un tuto en 3 étapes sur iOS Safari (Partager → Sur l'écran d'accueil), le prompt natif sur Android |

## Modèle de données Firestore
```
admins/{uid}                                   {}  (créé à la main)
users/{uid}                                    displayName, displayNameLower, emoji, createdAt
usernames/{displayNameLower}                   uid   (unicité des pseudos)
editionSecrets/{editionId}                     code  (aucune lecture client ; utilisé par les règles via get())
editions/{editionId}                           title, showAt (timestamp), status, createdAt
editions/{e}/members/{uid}                     joinedAt, code (doit égaler editionSecrets.code à la création)
editions/{e}/candidates/{candidateId}          champs de src/data/editions/<e>/candidates.json
editions/{e}/picks/{uid}                       candidateId, changeCount, updatedAt (== request.time)
editions/{e}/pickHistory/{uid}_{changeCount}   uid, candidateId, changeCount, at (== request.time)
editions/{e}/results/live                      top15: id[], top5: id[], winner, firstRunnerUp, secondRunnerUp, updatedAt
```
- Un prono s'écrit en **batch** : `picks/{uid}` et `pickHistory/{uid}_{n}` ensemble. Les règles imposent la cohérence entre les deux avec `getAfter`/`existsAfter` : `changeCount` augmente de 1 exactement, la candidate est la même et l'horodatage est `request.time`.
- `pickHistory` : création seulement, ni mise à jour ni suppression.
- Statut d'une candidate, calculé côté client :
  - `open` : neutre ;
  - après la fermeture, avant le top 15 : en course ;
  - top 15 saisi : éliminée si absente du top 15 ;
  - top 5 saisi : éliminée si absente du top 5 ;
  - podium saisi : 1re, 2e ou 3e place, les autres éliminées.
- Les trophées sont calculés côté client à partir de `picks` et `results`, sur toutes les éditions dont l'utilisateur est membre.

## Données et assets
- `src/data/editions/2027/candidates.json` : les 31 candidates (déjà généré, ne pas modifier à la main).
- `public/candidates/2027/<id>.webp` (portrait 3:4) et `<id>-full.webp` (photo en pied) : déjà générés.
- Le JSON est importé dans Firestore par l'admin. Les photos restent statiques, il n'y a pas de Cloud Storage (indisponible sur le plan Spark).

## Contraintes
- **0 €** : Firebase plan Spark (Auth, Firestore, Hosting). Aucune Cloud Function, aucun Storage.
- Stack : Vite, React, TypeScript strict, react-router, Firebase JS SDK modulaire, vite-plugin-pwa. CSS natif avec custom properties (tokens de `docs/DESIGN.md`), sans framework UI.
- Pages non indexées (`<meta name="robots" content="noindex">` et `robots.txt` qui bloque tout).
- Accessibilité : focus visible, cibles tactiles de 44 px minimum, `prefers-reduced-motion` respecté.
- Langue de l'interface : français, tutoiement.
