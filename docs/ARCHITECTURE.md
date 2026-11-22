# Architecture — Pronos Miss

Notes techniques pour les agents/devs. Référence produit : `docs/SPEC.md`, design : `docs/DESIGN.md`.

## Arborescence

```
firestore.rules            règles de sécurité (le cœur anti-triche)
firestore.indexes.json     index pickHistory (uid, changeCount) + index collection group members.uid
firebase.json / .firebaserc hosting (dist, SPA, cache), émulateurs, projet missfrancebet
index.html                 lang="fr", noindex
public/                    robots.txt, favicon.svg, icons/ (SVG + PNG générés), candidates/ (photos, ne pas toucher)
scripts/generate-icons.mjs npm run icons
src/
  main.tsx                 polices @fontsource + CSS globaux
  App.tsx                  routes (ne pas les renommer)
  styles/tokens.css        tous les tokens DESIGN.md en custom properties
  styles/base.css          reset, focus visible, reduced-motion, .button, .page, .visually-hidden
  components/Sash.tsx      l'écharpe (élément signature)
  components/AppShell.tsx  barre d'onglets du bas (+ Admin si super admin), bulle « Party active » si plusieurs parties
  components/guards.tsx    RequireAuth, RequireProfile, RequireSuperAdmin
  components/ConfirmDialog.tsx  fenêtre de confirmation partagée (<dialog> natif ; requirePhrase pour la double confirmation)
  pages/index.tsx          pages provisoires (une par route) à remplacer
  lib/                     couche données (contrat), import depuis '../lib'
  data/editions/2027/edition.json     titre + date de l'émission
  data/editions/2027/candidates.json  (généré, ne pas toucher)
tests/rules/firestore.test.ts  tests des règles (émulateur)
tests/rules/qa-triche.test.ts  revue QA : tentatives de triche (failles corrigées + pistes qui tiennent)
```

## Routes

`/connexion` (public), `/bienvenue` (connecté), `/rejoindre/:code?` (connecté + pseudo), puis sous `AppShell` (connecté + pseudo) : `/`, `/candidates`, `/candidates/:id`, `/parties`, `/soiree`, `/soiree/gestion`, `/profil`, `/admin` (RequireSuperAdmin). L'appartenance à une party n'est pas imposée par un guard : les écrans résolvent la party active (`useActivePartyId` croisé avec `useMyParties(currentEdition()?.id)`) et proposent `/parties` s'il n'y en a pas. `/soiree/gestion` vérifie `canManageParty`.

## API de `src/lib` (importer depuis `src/lib/index.ts`)

Tous les hooks Firestore sont temps réel (onSnapshot) et renvoient `Live<T> = { data: T; loading: boolean; error: Error | null }`. Un argument `null` = pas d'abonnement (données vides). Les dates sont des `Date` (serverTimestamp en attente : estimation locale). Éditions et candidates sont **embarquées** : fonctions synchrones, pas de hook.

Types : `Edition`, `EditionFile`, `Candidate`, `CandidatesFile`, `PartyStatus`, `Party`, `Membership`, `PartyEvent`, `Pick` (masque l'utilitaire TS `Pick<>`), `PickHistoryEntry`, `Results`, `UserProfile`, `CandidateStatus`, `Trophy`, `Live<T>`.

Auth (`auth.ts`)
- `useAuth(): { user: User | null; loading: boolean; error: Error | null }`
- `signInWithGoogle(): Promise<void>` — redirect si mobile/standalone, popup sinon (repli redirect si bloquée)
- `signUpWithEmail(email, password)`, `signInWithEmail(email, password)`, `resetPassword(email)`, `signOut()` — `Promise<void>`
- `requireUid(): string`, `prefersRedirect(): boolean`

Profil (`profile.ts`)
- `claimUsername(displayName, photo?): Promise<void>` — transaction, crée le profil ou change de pseudo ; `AppError('username-taken' | 'username-invalid')`. La lecture de `usernames/{pseudo}` est refusée s'il appartient à un autre : ce refus est traduit en `username-taken`
- `updateProfile(current: UserProfile, patch: { displayName?; photo? }): Promise<void>`, `setProfilePhoto(photo | null)`
- `photoFromFile(file): Promise<dataUrl>` — carré de `PHOTO_SIZE` (256) px, WebP (JPEG sur Safari), sous `PHOTO_MAX_CHARS` (100 000) ; `AppError('photo-invalid')`
- `useProfile(uid?: string | null): Live<UserProfile | null>` (défaut : moi)
- `useUsers(uids | 'all'): Live<Record<uid, UserProfile>>` — lus un par un ('all' : super admin seulement) ; pour une party, préférer `usePartyUsers(partyId)` (membres + auteurs du journal)
- Composants : `<Avatar profile size />` (photo ou initiale), `<PhotoPicker value name onChange />` (Parcourir / Prendre une photo)
- `usernameError(name): string | null` (refuse aussi les caractères de contrôle et invisibles `\p{Cc}` / `\p{Cf}`, comme `validName` dans les règles), `normalizeUsername(name)`, `USERNAME_MIN/MAX`

Éditions et candidates embarquées (`editions.ts`, `candidates.ts`)
- `listEditions(): Edition[]` (plus récente d'abord), `currentEdition(): Edition | null`, `getEdition(id): Edition | null`
- `listCandidates(editionId): Candidate[]` (triées par order), `getCandidate(editionId, id): Candidate | null`, `missLabel(c)` → "Miss Bretagne"

Parties (`parties.ts`)
- `createParty(editionId, name): Promise<{ partyId; code }>` — batch party + partyCodes + mon adhésion ; réessaie si collision de code ; `AppError('party-invalid')`
- `joinParty(code): Promise<partyId>` — `AppError('wrong-code')` ; sans effet si déjà membre ; preuve + adhésion en batch, puis suppression de la preuve
- `useParty(partyId): Live<Party | null>` (membres et super admin ; null si absente ou supprimée)
- `useMyParties(editionId?): Live<Party[]>`, `useMyMemberships(): Live<Membership[]>` (collection group `members` où `uid == moi`). Une party supprimée, ou dont l'écoute devient refusée (permission-denied), sort de la liste sans mettre le hook en erreur
- `DELETED_STATUS` (`'deleted'`), `isDeletedParty(data)` : pierre tombale d'une party supprimée. Les hooks ne renvoient jamais une `Party` supprimée (`PartyStatus` ne contient pas `'deleted'`)
- `useMembership(partyId): Live<Membership | null>` (moi), `useMembers(partyId): Live<Membership[]>`
- `usePartyEvents(partyId): Live<PartyEvent[]>` (journal des phases)
- `useAllParties(enabled): Live<Party[]>` (super admin : passer `useIsSuperAdmin().data`) ; sans les parties supprimées
- `useActiveParty(): Live<Party | null>` : **point d'entrée des onglets** (party active de l'édition en cours, sinon la plus récente ; null = aucune party → proposer `/parties`)
- `useCurrentParties(): Live<{ parties: Party[]; active: Party | null }>` : mes parties de l'édition en cours et l'active (bulle de l'AppShell, accueil)
- `useActivePartyId(): string | null`, `setActivePartyId(id | null)` (localStorage, par appareil)
- `canManageParty(party, uid, isSuperAdmin): boolean`
- `normalizeCode`, `isValidCode`, `generateCode`, `CODE_ALPHABET`, `CODE_LENGTH`, `PARTY_NAME_MIN/MAX`, `PARTY_STATUSES`

Pronos (`picks.ts`)
- `setPick(party: Party, candidateId): Promise<{ changeCount }>` — vérifie la candidate (données embarquées), batch pick + pickHistory + members.hasPicked ; `AppError('unknown-candidate' | 'picks-closed')`
- `useMyPick(partyId): Live<Pick | null>`
- `usePicks(partyId): Live<Pick[]>` — passer `null` tant que status == 'open' (illisible par tous avant)
- `usePickHistory(partyId, scope: 'mine' | 'all'): Live<PickHistoryEntry[]>` — 'all' : après fermeture seulement

Résultats et logique de jeu (`results.ts`, `game.ts`, `trophies.ts`)
- `useResults(partyId): Live<Results>` (`EMPTY_RESULTS` si rien)
- `candidateStatus(candidateId, party, results): CandidateStatus` — 'neutral' | 'inRace' | 'eliminated' | 'winner' | 'firstRunnerUp' | 'secondRunnerUp'
- `trophyFor(pick, results): 'gold' | 'silver' | 'bronze' | null`
- `useMyTrophies(): Live<{ party; edition; candidateId; trophy }[]>` (parties finished ; une party supprimée ou devenue illisible disparaît sans erreur)
- Composant `<ResultsEditor partyId editionId results readOnly? onPodiumSaved? />` : saisie top 15 / top 5 / podium en phase `closed` ; `readOnly` (phase `finished`) affiche les résultats sans saisie

Administration (`admin.ts`) — admin de la party ou super admin, sauf mention
- `useIsSuperAdmin(): Live<boolean>`
- `setPartyStatus(party: Party, status)` — batch party + events/{n} (type 'status')
- `transferOwnership(party: Party, newOwnerUid)` — batch party + events/{n} (type 'owner') ; le nouvel admin doit être membre
- `renameParty(partyId, name)` (le nom doit changer : une écriture identique est refusée), `removeMember(partyId, uid)`, `setResults(partyId, patch)` (fusion, `null` efface ; phase `closed` seulement)
- `regenerateCode(party): Promise<code>` — nouveau partyCodes + suppression de l'ancien + party.code, en un batch ; l'ancien lien cesse de marcher
- `leaveParty(party)` — n'importe quel membre sauf l'admin ; réinitialise la party active. **L'interface confirme d'abord (popup)**
- `deleteParty(party, typedPhrase)` — refuse si `deletePhraseMatches(typedPhrase)` est faux ; batch : suppression des adhésions et du code, party passée en pierre tombale (`status: 'deleted'`, `deletedAt`). `DELETE_PARTY_PHRASE` = « je confirme la suppression de la party » (champ à recopier, bouton désactivé tant que ça ne correspond pas)
- `exportBackup(): Promise<object>`, `downloadBackup()` — super admin : fichier JSON de sauvegarde (pierres tombales comprises, sans leurs pronos)

Erreurs (`errors.ts`) : `errorMessage(err): string` (français, prêt à afficher), `AppError`, `isPermissionDenied`.

## Garanties des règles (firestore.rules)

Chaque point est couvert par `tests/rules/firestore.test.ts` (101 tests) et `tests/rules/qa-triche.test.ts` (37 tentatives de triche de la revue QA), soit 138 tests, vérifiés aussi par mutation : casser une règle fait échouer un test.

- Création de party : le créateur est `ownerUid`, statut `open`, `eventCount == 0`, `createdAt == request.time`, code au bon format, `partyCodes/{code}` réservé dans le même batch (create échoue si le code existe), adhésion du créateur dans le même batch. Impossible d'ajouter un second code à une party existante.
- `partyCodes` : get pour tout connecté, list interdit, jamais modifié. Créé dans le batch de création de la party ou de changement de code ; supprimé dans le batch de suppression de la party ou de changement de code (par l'admin ou le super admin). Changer le code : seul champ modifié de la party, nouveau code créé et ancien supprimé dans le même batch.
- Rejoindre : `members/{uid}` ne se crée que par soi-même, avec `editionId` égal à celui de la party, `hasPicked == false`, et soit en créant la party, soit avec `joinProofs/{uid}` (même batch) dont le code égale celui de la party, non supprimée. La preuve est illisible par tous, et ne s'écrit que sous une party existante et non supprimée, par un non-membre.
- Lecture d'une party et de ses membres : membres et super admin. Liste de toutes les parties : super admin. Collection group `members` : seulement ses propres adhésions (`uid == moi`).
- Phases et transmission : admin de la party ou super admin ; changer de statut **ou** d'admin (jamais les deux) incrémente `eventCount` et exige `events/{n}` dans le même batch (type, from = ancienne valeur, to = nouvelle, by = moi, at = request.time). Le nouvel admin doit être membre avant et après le batch. Renommer exige un nouveau nom (pas d'écriture à vide). Journal immuable, lisible des membres. `code`, `editionId`, `createdAt` immuables.
- Suppression d'une party (pierre tombale) : admin de la party ou super admin. `delete` est interdit à tous ; la suppression est un update vers `status: 'deleted'` (+ `deletedAt == request.time`, aucun autre champ), dans le même batch que la suppression de `partyCodes/{code}` et de l'adhésion de l'admin (l'app retire toutes les adhésions). Le code et les adhésions ne peuvent être supprimés par l'admin que dans ce batch (ou celui d'un changement de code). Une pierre tombale : id impossible à recréer (create ne s'applique qu'à un document absent), aucune écriture sur elle ni dans ses sous-collections (phase, nom, code, journal, résultats, pronos, adhésions, preuves ; seul le retrait d'une adhésion restée là est permis), lisible seulement par le super admin (party, membres, journal, résultats), pronos lisibles par personne (sauf son propre prono).
- Pronos : écrits par leur propriétaire seulement, membre, party `open`, clés exactes, `candidateId` au format `[a-z0-9-]`, `updatedAt == request.time`, `changeCount` = 1 à la création puis ancien + 1 ; `getAfter(pickHistory/{uid}_{n})` cohérent. Suppression interdite à tous.
- Historique : création seule, id `{uid}_{changeCount}`, cohérent avec le prono du même batch. Ni update ni delete.
- Lecture des pronos : son prono et son historique toujours ; ceux des autres seulement après la fermeture (`closed` ou `finished`), par les membres et le super admin. **Avant, personne** (ni l'admin de la party, ni le super admin).
- members : `hasPicked` à la création = existence de mon prono (vrai si je reviens après avoir quitté) ; seule mise à jour : `hasPicked → true` dans un batch de prono, party ouverte. Quitter : soi-même, sauf l'admin. Retrait : admin de la party ou super admin, jamais l'admin. « L'admin » s'entend avant et après le batch : impossible de transmettre le rôle et de retirer (ou faire partir) le nouvel ou l'ancien admin dans la même écriture.
- Résultats : écriture admin de la party ou super admin, document `live` seulement, **phase `closed` seulement** ; `validResults()` : champs connus, `top15` null ou 1 à 15 ids distincts, `top5` null ou 1 à 5, podium null ou un id, ids au format `^[a-z0-9-]{1,64}$`, `updatedAt == request.time`. Lecture membres et super admin.
- `admins` : jamais écrit par le client, lecture de son propre doc.
- Pseudos : `usernames/{lower}` lisible seulement s'il est libre ou à soi (pas d'uid à tirer d'un pseudo) ; créé seulement si `users/{uid}.displayNameLower` correspond après écriture ; jamais mis à jour ; libéré uniquement par son propriétaire en changeant de pseudo. `validName` refuse « / » et les caractères `\p{Cc}` et `\p{Cf}` (contrôle, invisibles). `users` modifiable par son propriétaire seulement.

## Conventions

- Interface : skill `ui-ux-pro-max` (`.claude/skills/ui-ux-pro-max/`) comme référence UX et accessibilité, par exemple `python .claude/skills/ui-ux-pro-max/scripts/search.py "<besoin>" --domain ux`. `docs/DESIGN.md` prime.

- Textes en français, tutoiement, casse normale ; capitales uniquement dans `<Sash>`.
- CSS natif : uniquement les variables de `tokens.css`, un fichier CSS à côté du composant. Pas de framework UI.
- `<Sash region variant size delay>` : `region` en casse normale ; mini-écharpe "Mon prono" = `<Sash region="Mon prono" variant="mine" size="sm" />`. Animation de décrochage : changer `variant` en `eliminated` avec `delay={i * 60}`.
- Accès Firestore uniquement via `src/lib` ; pas d'appel Firebase dans les pages.
- Un écran = un fichier dans `src/pages/`, branché sur la route existante de `App.tsx`.

## Tests

- `npm run test:unit` : `src/**/*.test.ts` (fonctions pures).
- `npm run test:rules` : `firebase emulators:exec --only firestore` + vitest projet `rules` (tests/rules). Les tests lisent l'hôte et le port dans `FIRESTORE_EMULATOR_HOST` (posé par `emulators:exec`, repli `127.0.0.1:8080`) : pour ne pas gêner un émulateur déjà lancé, passer un autre `firebase.json` avec `--config` (port Firestore, hub et websocket différents, `ui` désactivée).

## Reste à faire

- Tous les écrans métier (pages provisoires dans `src/pages/index.tsx`), bandeau « Installer l'app », animation orchestrée des écharpes et confettis.
- `/connexion` doit renvoyer vers `state.from` après connexion (pour que le lien `/rejoindre/<code>` marche sans compte).
- Bundle de 900 kB (Firebase) : découper par route avec `React.lazy` si besoin.
- **Firebase App Check** : le code est prêt (`src/lib/firebase.ts`, actif si `VITE_RECAPTCHA_SITE_KEY` est fournie). Fournisseur `ReCaptchaEnterpriseProvider` (les clés v3 classiques ne se créent plus ; offre gratuite de 10 000 évaluations par mois sans facturation, compatible Spark). Reste, avant la mise en ligne, à créer la clé reCAPTCHA Enterprise (console Google Cloud > Fraud Defense, type Web, à score), à l'enregistrer dans la console et à **appliquer** App Check à Firestore. Pourquoi : un bot qui teste des codes ne peut pas en deviner un (31^6 ≈ 887 millions), mais il peut épuiser le quota gratuit de 50 000 lectures par jour.
- Le Sash n'a été vérifié que par typecheck/build, pas visuellement dans un navigateur.
- `useMyParties` et `useMyTrophies` ouvrent un abonnement par party : sans souci pour quelques parties par joueur.
- Tests de règles sous Windows : JDK 21 requis (firebase-tools), et lancer vitest depuis un chemin `C:\` en majuscule (sinon vitest se charge deux fois et plante sur `reading 'config'`).
