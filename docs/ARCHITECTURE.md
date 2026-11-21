# Architecture — Pronos Miss

Notes techniques pour les agents/devs. Référence produit : `docs/SPEC.md`, design : `docs/DESIGN.md`.

## Arborescence

```
firestore.rules            règles de sécurité (le cœur anti-triche)
firestore.indexes.json     index composite pickHistory (uid, changeCount)
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
  components/AppShell.tsx  barre d'onglets du bas (+ Admin si admin)
  components/guards.tsx    RequireAuth, RequireProfile, RequireAdmin
  pages/index.tsx          pages provisoires (une par route) à remplacer
  lib/                     couche données (contrat), import depuis '../lib'
  data/editions/2027/candidates.json  (ne pas toucher)
tests/rules/firestore.test.ts  tests des règles (émulateur)
```

## Routes

`/connexion` (public), `/bienvenue` (connecté), `/rejoindre` (connecté + pseudo), puis sous `AppShell` (connecté + pseudo) : `/`, `/candidates`, `/candidates/:id`, `/soiree`, `/profil`, `/admin` (RequireAdmin). L'appartenance à l'édition n'est pas imposée par un guard : chaque écran teste `useMembership` et renvoie vers `/rejoindre`.

## API de `src/lib` (importer depuis `src/lib/index.ts`)

Tous les hooks sont temps réel (onSnapshot) et renvoient `Live<T> = { data: T; loading: boolean; error: Error | null }`. Un argument `null` = pas d'abonnement (données vides, loading false). Les dates sont des `Date` (serverTimestamp en attente : estimation locale).

Types : `EditionStatus`, `Edition`, `Candidate`, `CandidatesFile`, `Membership`, `Pick` (masque l'utilitaire TS `Pick<>`), `PickHistoryEntry`, `Results`, `UserProfile`, `CandidateStatus`, `Trophy`, `Live<T>`.

Auth (`auth.ts`)
- `useAuth(): { user: User | null; loading: boolean; error: Error | null }`
- `signInWithGoogle(): Promise<void>` — redirect si mobile/standalone, popup sinon (repli redirect si bloquée)
- `signUpWithEmail(email, password)`, `signInWithEmail(email, password)`, `resetPassword(email)`, `signOut()` — `Promise<void>`
- `requireUid(): string`, `prefersRedirect(): boolean`

Profil (`profile.ts`)
- `claimUsername(displayName, emoji): Promise<void>` — transaction, crée le profil ou change de pseudo ; `AppError('username-taken' | 'username-invalid')`
- `updateProfile(current: UserProfile, patch: { displayName?; emoji? }): Promise<void>`
- `useProfile(uid?: string | null): Live<UserProfile | null>` (défaut : moi)
- `useUsers(): Live<Record<uid, UserProfile>>`
- `usernameError(name): string | null`, `normalizeUsername(name)`, `USERNAME_MIN/MAX`

Éditions (`editions.ts`)
- `useCurrentEdition(): Live<Edition | null>` (dernière par showAt), `useEditions(): Live<Edition[]>`, `useEdition(id): Live<Edition | null>`
- `joinEdition(editionId, code): Promise<void>` — `AppError('wrong-code')` ; sans effet si déjà membre ; écrit preuve + adhésion en batch, puis supprime la preuve
- `useMembership(editionId): Live<Membership | null>` (moi), `useMembers(editionId): Live<Membership[]>` (pour compter qui a pronostiqué)
- `normalizeCode(code)` (sans espaces, majuscules)

Candidates (`candidates.ts`)
- `useCandidates(editionId): Live<Candidate[]>` (triées par order)
- `bundledCandidateFiles(): Record<editionId, CandidatesFile>` (JSON embarqués, pour l'import admin), `missLabel(c)` → "Miss Bretagne"

Pronos (`picks.ts`)
- `setPick(editionId, candidateId): Promise<{ changeCount }>` — batch pick + pickHistory + members.hasPicked ; `AppError('picks-closed')`
- `useMyPick(editionId): Live<Pick | null>`
- `usePicks(editionId): Live<Pick[]>` — passer `null` tant que status == 'open' (sauf admin)
- `usePickHistory(editionId, scope: 'mine' | 'all'): Live<PickHistoryEntry[]>` — 'all' : après fermeture ou admin

Résultats et logique de jeu (`results.ts`, `game.ts`, `trophies.ts`)
- `useResults(editionId): Live<Results>` (`EMPTY_RESULTS` si rien)
- `candidateStatus(candidateId, edition, results): CandidateStatus` — 'neutral' | 'inRace' | 'eliminated' | 'winner' | 'firstRunnerUp' | 'secondRunnerUp'
- `trophyFor(pick, results): 'gold' | 'silver' | 'bronze' | null`
- `useMyTrophies(): Live<{ edition; candidateId; trophy }[]>` (éditions finished)

Admin (`admin.ts`)
- `useIsAdmin(): Live<boolean>`
- `createEdition({ id, title, showAt: Date, code })`, `updateEdition(id, { title?, showAt? })`, `setEditionCode(id, code)`, `importCandidates(id, file): Promise<number>`, `setStatus(id, status)`, `setResults(id, patch)` (fusion, `null` efface)

Erreurs (`errors.ts`) : `errorMessage(err): string` (français, prêt à afficher), `AppError`, `isPermissionDenied`.

## Garanties des règles (firestore.rules)

- Code de soirée : `members/{uid}` ne se crée que si la preuve `joinProofs/{uid}`, écrite dans le même batch, porte `code == get(editionSecrets/{e}).code`. La preuve est illisible par tous (auteur et admin compris) et supprimée par `joinEdition` juste après ; l'adhésion ne stocke aucun code. `editionSecrets` : `editionSecrets` : lecture refusée à tous (admin compris), écriture admin.
- Pronos : écrits par leur propriétaire seulement, membre, `status == 'open'`, clés exactes, candidate existante, `updatedAt == request.time`, `changeCount` = 1 à la création puis ancien + 1 ; `getAfter(pickHistory/{uid}_{n})` doit avoir mêmes uid/candidate/compteur et `at == request.time`. Suppression interdite (même pour l'admin).
- Historique : création seule, id `{uid}_{changeCount}`, `getAfter(picks/{uid})` cohérent avec `updatedAt == request.time` (donc écrit dans le même batch). Ni update ni delete.
- Lecture : son prono/historique toujours ; ceux des autres seulement si membre et status != 'open' ; admin tout.
- members : lisibles par les membres (aucun code n'y est stocké) ; seule mise à jour : `hasPicked → true` dans un batch de prono.
- results/candidates/editions (dont status)/editionSecrets : écriture admin. `admins` : jamais écrit par le client, lecture de son propre doc.
- Pseudos : `usernames/{lower}` créé seulement si `users/{uid}.displayNameLower` correspond après écriture ; jamais mis à jour ; libéré uniquement par son propriétaire en changeant de pseudo. `users` modifiable par son propriétaire seulement.

## Conventions

- Textes en français, tutoiement, casse normale ; capitales uniquement dans `<Sash>`.
- CSS natif : uniquement les variables de `tokens.css`, un fichier CSS à côté du composant. Pas de framework UI.
- `<Sash region variant size delay>` : `region` en casse normale ; mini-écharpe "Mon prono" = `<Sash region="Mon prono" variant="mine" size="sm" />`. Animation de décrochage : changer `variant` en `eliminated` avec `delay={i * 60}`.
- Accès Firestore uniquement via `src/lib` ; pas d'appel Firebase dans les pages.
- Un écran = un fichier dans `src/pages/`, branché sur la route existante de `App.tsx`.

## Tests

- `npm run test:unit` : `src/**/*.test.ts` (fonctions pures).
- `npm run test:rules` : `firebase emulators:exec --only firestore` + vitest projet `rules` (tests/rules).

## Reste à faire

- **Les tests de règles n'ont jamais tourné** : le téléchargement de l'émulateur Firestore (storage.googleapis.com) est bloqué dans l'environnement de l'agent Fondations, et il n'existe pas de compilateur de règles hors ligne. Les règles n'ont donc pas non plus été compilées. Lancer `npm run test:rules` sur une machine avec accès réseau avant tout déploiement, et corriger ce qui échoue.
- Tous les écrans métier (pages provisoires dans `src/pages/index.tsx`), bandeau « Installer l'app », animation orchestrée des écharpes et confettis.
- Bundle de 900 kB (Firebase) : découper par route avec `React.lazy` si besoin.
- Le Sash n'a été vérifié que par typecheck/build, pas visuellement dans un navigateur.
