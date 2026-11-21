// Revue QA « anti-triche » : tentatives de triche directes contre firestore.rules, via le SDK,
// sans passer par l'interface. Complète tests/rules/firestore.test.ts sans le modifier.
//
// Convention : chaque test marqué « FAILLE » est écrit comme il DEVRAIT passer (assertFails sur
// l'écriture ou la lecture de triche). Il échouait tant que la faille existait ; chaque faille
// corrigée porte un commentaire « Corrigé : … » qui nomme la règle qui la bloque.
// Les autres tests vérifient des pistes qui tiennent aujourd'hui (non-régression).
//
// Distribution (comme firestore.test.ts) : boss = super admin ; olga = créatrice et admin de P ;
// alice et bob = membres de P ; carol = joueuse sans party ; dan = créateur de P2.
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'

const E = '2027'
const P = 'p1'
const P2 = 'p2'
const CODE = 'K7QMZ3'
const CODE2 = 'DANDAN'
let env: RulesTestEnvironment

// Hôte et port posés par `firebase emulators:exec` (ne pas supposer 8080).
const [EMU_HOST, EMU_PORT] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':')

const dbAs = (uid: string | null): Firestore =>
  (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore()) as unknown as Firestore

const partyDoc = (db: Firestore, p = P) => doc(db, 'parties', p)
const sub = (db: Firestore, name: string, id: string, p = P) => doc(db, 'parties', p, name, id)

/** Tente une étape intermédiaire d'un scénario ; son échec éventuel est vérifié plus loin. */
async function attempt(op: Promise<unknown>): Promise<boolean> {
  try {
    await op
    return true
  } catch {
    return false
  }
}

async function pick(db: Firestore, uid: string, candidateId: string, n: number, p = P) {
  const b = writeBatch(db)
  b.set(sub(db, 'picks', uid, p), { candidateId, changeCount: n, updatedAt: serverTimestamp() })
  b.set(sub(db, 'pickHistory', `${uid}_${n}`, p), { uid, candidateId, changeCount: n, at: serverTimestamp() })
  b.update(sub(db, 'members', uid, p), { hasPicked: true })
  return b.commit()
}

async function joinBatch(db: Firestore, uid: string, code: string, extra: Record<string, unknown> = {}, p = P) {
  const b = writeBatch(db)
  b.set(sub(db, 'joinProofs', uid, p), { code })
  b.set(sub(db, 'members', uid, p), { uid, editionId: E, joinedAt: serverTimestamp(), hasPicked: false, ...extra })
  return b.commit()
}

async function createBatch(db: Firestore, uid: string, p: string, code: string, opts: { member?: boolean } = {}) {
  const b = writeBatch(db)
  b.set(partyDoc(db, p), {
    editionId: E,
    name: 'Les copains',
    ownerUid: uid,
    code,
    status: 'open',
    eventCount: 0,
    createdAt: serverTimestamp(),
  })
  b.set(doc(db, 'partyCodes', code), { partyId: p, editionId: E })
  if (opts.member !== false) {
    b.set(sub(db, 'members', uid, p), { uid, editionId: E, joinedAt: serverTimestamp(), hasPicked: false })
  }
  return b.commit()
}

async function setStatus(db: Firestore, uid: string, from: string, to: string, n: number, p = P) {
  const b = writeBatch(db)
  b.update(partyDoc(db, p), { status: to, eventCount: n })
  b.set(sub(db, 'events', String(n), p), { type: 'status', from, to, by: uid, at: serverTimestamp() })
  return b.commit()
}

// Suppression complète comme deleteParty : adhésions + code + pierre tombale (status 'deleted').
async function deletePartyBatch(db: Firestore) {
  const b = writeBatch(db)
  for (const uid of ['olga', 'alice', 'bob']) b.delete(sub(db, 'members', uid))
  b.delete(doc(db, 'partyCodes', CODE))
  b.update(partyDoc(db), { status: 'deleted', deletedAt: serverTimestamp() })
  return b.commit()
}

async function regenerate(db: Firestore, from: string, to: string) {
  const b = writeBatch(db)
  b.set(doc(db, 'partyCodes', to), { partyId: P, editionId: E })
  b.delete(doc(db, 'partyCodes', from))
  b.update(partyDoc(db), { code: to })
  return b.commit()
}

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    await setDoc(doc(db, 'admins', 'boss'), {})
    const parties: Array<[string, string, string, string[]]> = [
      [P, 'olga', CODE, ['olga', 'alice', 'bob']],
      [P2, 'dan', CODE2, ['dan']],
    ]
    for (const [p, owner, code, members] of parties) {
      await setDoc(doc(db, 'parties', p), {
        editionId: E,
        name: `Party de ${owner}`,
        ownerUid: owner,
        code,
        status: 'open',
        eventCount: 0,
        createdAt: Timestamp.now(),
      })
      await setDoc(doc(db, 'partyCodes', code), { partyId: p, editionId: E })
      for (const uid of members) {
        await setDoc(doc(db, 'parties', p, 'members', uid), { uid, editionId: E, joinedAt: Timestamp.now(), hasPicked: false })
      }
    }
    await setDoc(doc(db, 'users', 'olga'), {
      displayName: 'Olga',
      displayNameLower: 'olga',
      photo: `data:image/webp;base64,${'A'.repeat(200)}`,
      createdAt: Timestamp.now(),
    })
    await setDoc(doc(db, 'usernames', 'olga'), { uid: 'olga' })
  })
}

async function setRaw(path: string[], data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    await setDoc(doc(db, path[0], ...path.slice(1)), data, { merge: true })
  })
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-pronos-miss',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: EMU_HOST, port: Number(EMU_PORT) },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await seed()
})

// =====================================================================================
// FAILLES
// =====================================================================================

describe('FAILLES : suppression puis recréation d’une party avec le même id', () => {
  // Scénario commun : olga (admin ET joueuse) a fermé les pronos, journal à l'appui (events/1).
  // Elle supprime le SEUL document parties/p1 (les adhésions, le code, les pronos et le journal
  // restent en base), puis recrée parties/p1 : statut 'open', eventCount 0. Tous les anciens
  // membres retrouvent la party (même id, adhésions intactes).
  async function closeThenRecreate() {
    const olga = dbAs('olga')
    await assertSucceeds(pick(olga, 'olga', 'bretagne', 1))
    await assertSucceeds(pick(dbAs('alice'), 'alice', 'corse', 1))
    await assertSucceeds(setStatus(olga, 'olga', 'open', 'closed', 1))
    await attempt(deleteDoc(partyDoc(olga)))
    // Son adhésion orpheline satisfait existsAfter(members/olga) : pas besoin de la recréer.
    await attempt(createBatch(olga, 'olga', P, 'NEWNEW', { member: false }))
    return olga
  }

  // Corrigé (critique) : changement de prono après la fermeture, sans réouverture journalisée.
  // `allow delete: if false` sur parties/{p} (pierre tombale) : la party ne peut plus être
  // supprimée puis recréée, elle reste fermée et validPickWrite exige isOpen.
  it('FAILLE : l’admin ne peut pas changer son prono après la fermeture en recréant la party', async () => {
    const olga = await closeThenRecreate()
    await assertFails(pick(olga, 'olga', 'corse', 2))
  })

  // Corrigé (critique) : refermer la party recréée sans nouvelle entrée de journal, parce que
  // l'ancien events/1 (orphelin) satisfait existsAfter(events/1). La pierre tombale empêche la
  // recréation, et la branche « renommage seul » exige que le nom change (pas d'écriture à vide).
  it('FAILLE : une party recréée ne peut pas changer de phase en réutilisant l’ancien journal', async () => {
    const olga = await closeThenRecreate()
    await attempt(pick(olga, 'olga', 'corse', 2))
    await assertFails(updateDoc(partyDoc(olga), { status: 'closed', eventCount: 1 }))
  })

  // Corrigé (mineure) : la party pouvait être supprimée seule, sans son code ni ses adhésions
  // (racine des deux failles ci-dessus ; le code orphelin restait réservé pour toujours).
  // `allow delete: if false` ; la pierre tombale exige !existsAfter(partyCodes/{code}) et
  // !existsAfter(members/{ownerUid}).
  it('FAILLE : l’admin ne peut pas supprimer la party sans libérer son code', async () => {
    await assertFails(deleteDoc(partyDoc(dbAs('olga'))))
  })

  // Corrigé (mineure) : même après une suppression complète (adhésions + code + party), un ancien
  // membre qui connaissait l'id recréait la party, la fermait (journal neuf) et lisait les pronos
  // restés secrets. La pierre tombale occupe l'id (create impossible sur un document existant)
  // et isRevealed n'ouvre les pronos que d'une party closed ou finished.
  it('FAILLE : un ancien membre ne peut pas recréer une party supprimée pour lire les pronos secrets', async () => {
    await assertSucceeds(pick(dbAs('alice'), 'alice', 'corse', 1))
    await assertSucceeds(deletePartyBatch(dbAs('olga')))
    const bob = dbAs('bob')
    await attempt(createBatch(bob, 'bob', P, 'BBBBBB'))
    await attempt(setStatus(bob, 'bob', 'open', 'closed', 1))
    await assertFails(getDoc(sub(bob, 'picks', 'alice')))
  })
})

describe('FAILLES : transmission du rôle et cohérence', () => {
  // Corrigé (mineure) : dans le même batch, l'admin transmettait son rôle à alice et la retirait.
  // La règle de suppression lisait l'ownerUid AVANT le batch (partyData = get). Résultat : un
  // admin qui n'était plus membre. members/{uid} delete compare aussi l'uid à
  // getAfter(party).ownerUid, et la transmission exige existsAfter(members/{nouvel admin}).
  it('FAILLE : impossible de transmettre le rôle et de retirer le nouvel admin dans le même batch', async () => {
    const olga = dbAs('olga')
    const b = writeBatch(olga)
    b.update(partyDoc(olga), { ownerUid: 'alice', eventCount: 1 })
    b.set(sub(olga, 'events', '1'), { type: 'owner', from: 'olga', to: 'alice', by: 'olga', at: serverTimestamp() })
    b.delete(sub(olga, 'members', 'alice'))
    await assertFails(b.commit())
  })
})

describe('FAILLES : résultats', () => {
  // Corrigé (importante, quota) : n'importe quel inscrit créait sa party et y écrivait un
  // results/live de près de 1 Mio (valeurs ni typées ni bornées). ~4 écritures par Mio : le 1 Gio
  // de stockage gratuit se remplissait en environ 4 000 écritures. validResults() : listes de
  // 15 et 5 ids au plus, ids de 64 caractères au plus au format [a-z0-9-].
  it('FAILLE : refuse un document de résultats énorme', async () => {
    const carol = dbAs('carol')
    await assertSucceeds(createBatch(carol, 'carol', 'p3', 'CCCCCC'))
    // Fermée (journal à l'appui) : seule la validation du contenu peut bloquer.
    await assertSucceeds(setStatus(carol, 'carol', 'open', 'closed', 1, 'p3'))
    const big = Array.from({ length: 15 }, (_, i) => `${'x'.repeat(60000)}${i}`)
    await assertFails(setDoc(sub(carol, 'results', 'live', 'p3'), { top15: big, updatedAt: serverTimestamp() }))
  })

  // Corrigé (mineure) : types libres (top15 en chaîne, winner en map, top15 de 500 entrées) ;
  // l'admin d'une party pouvait faire planter l'écran des membres. validResults() : null ou
  // liste bornée d'ids distincts pour top15/top5, null ou id pour le podium.
  it('FAILLE : refuse des résultats mal typés ou trop longs', async () => {
    const olga = dbAs('olga')
    await setRaw(['parties', P], { status: 'closed' })
    await assertFails(setDoc(sub(olga, 'results', 'live'), { winner: { evil: true }, updatedAt: serverTimestamp() }))
    await assertFails(setDoc(sub(olga, 'results', 'live'), { top15: 'corse', updatedAt: serverTimestamp() }))
    const many = Array.from({ length: 500 }, (_, i) => `c${i}`)
    await assertFails(setDoc(sub(olga, 'results', 'live'), { top15: many, updatedAt: serverTimestamp() }))
  })

  // Corrigé (mineure) : une fois la party terminée, l'admin modifiait le podium (donc les
  // trophées) sans aucune trace au journal. results/{docId} write exige
  // partyData(p).status == 'closed' : il faut d'abord revenir à la soirée en cours (journalisé).
  it('FAILLE : refuse de modifier les résultats d’une party terminée sans passer par une phase journalisée', async () => {
    await setRaw(['parties', P], { status: 'finished' })
    await setRaw(['parties', P, 'results', 'live'], { winner: 'corse', firstRunnerUp: 'bretagne' })
    await assertFails(updateDoc(sub(dbAs('olga'), 'results', 'live'), { winner: 'bretagne', firstRunnerUp: 'corse' }))
  })
})

describe('FAILLES : profils et pseudos', () => {
  // Corrigé (importante, vie privée) : usernames/{pseudo} était lisible de tout inscrit et
  // contient l'uid ; avec une liste de prénoms, un inconnu retrouvait les profils et les photos.
  // usernames/{lower} get exige resource == null (pseudo libre) ou resource.data.uid == moi.
  it('FAILLE : un inconnu ne peut pas retrouver l’uid (puis la photo) d’un joueur à partir de son pseudo', async () => {
    const carol = dbAs('carol')
    await assertFails(getDoc(doc(carol, 'usernames', 'olga')))
  })

  // Corrigé (mineure) : pseudo « Olga » + espace de largeur nulle (ou retour à la ligne) :
  // unicité contournée, usurpation visuelle d'un autre joueur. validName refuse
  // '(?s).*[\p{Cc}\p{Cf}].*' (caractères de contrôle et de format invisibles).
  it('FAILLE : refuse un pseudo avec un caractère invisible ou de contrôle', async () => {
    const carol = dbAs('carol')
    for (const name of ['Ol' + String.fromCharCode(10) + 'ga', 'Olga' + String.fromCharCode(0x200b)]) {
      const b = writeBatch(carol)
      b.set(doc(carol, 'users', 'carol'), {
        displayName: name,
        displayNameLower: name.toLowerCase(),
        photo: null,
        createdAt: serverTimestamp(),
      })
      b.set(doc(carol, 'usernames', name.toLowerCase()), { uid: 'carol' })
      await assertFails(b.commit())
    }
  })
})

describe('FAILLES : quota', () => {
  // Corrigé (mineure) : une preuve de code s'écrivait sous n'importe quel id de party, même
  // inexistante : déchets en base, jamais nettoyés. joinProofs/{uid} create exige isLive(p)
  // (party existante et non supprimée) et !isMember(p).
  it('FAILLE : refuse une preuve de code pour une party inexistante', async () => {
    await assertFails(setDoc(doc(dbAs('carol'), 'parties', 'nexistepas', 'joinProofs', 'carol'), { code: 'AAAAAA' }))
  })
})

// =====================================================================================
// PISTES QUI TIENNENT (non-régression)
// =====================================================================================

describe('tient : lecture des pronos avant la fermeture', () => {
  beforeEach(async () => {
    await assertSucceeds(pick(dbAs('alice'), 'alice', 'bretagne', 1))
    await assertSucceeds(pick(dbAs('bob'), 'bob', 'corse', 1))
  })

  it('refuse les requêtes collection group sur picks et pickHistory, à tous', async () => {
    for (const uid of ['alice', 'olga', 'boss', 'carol']) {
      const db = dbAs(uid)
      await assertFails(getDocs(collectionGroup(db, 'picks')))
      await assertFails(getDocs(collectionGroup(db, 'pickHistory')))
      await assertFails(getDocs(query(collectionGroup(db, 'pickHistory'), where('uid', '==', 'bob'))))
    }
  })

  it('refuse une requête d’historique filtrée sur un autre joueur, admin et super admin compris', async () => {
    for (const uid of ['alice', 'olga', 'boss']) {
      await assertFails(getDocs(query(collection(dbAs(uid), 'parties', P, 'pickHistory'), where('uid', '==', 'bob'))))
      await assertFails(
        getDocs(query(collection(dbAs(uid), 'parties', P, 'picks'), where('candidateId', '==', 'corse'))),
      )
    }
  })

  it('ne donne pas d’oracle d’existence (doc existant ou absent : même refus)', async () => {
    const alice = dbAs('alice')
    await assertFails(getDoc(sub(alice, 'pickHistory', 'bob_1')))
    await assertFails(getDoc(sub(alice, 'pickHistory', 'bob_2')))
    await assertFails(getDoc(sub(alice, 'picks', 'olga')))
  })

  it('le super admin ne lit pas les pronos d’une party ouverte, même via une requête vide', async () => {
    await assertFails(getDocs(query(collection(dbAs('boss'), 'parties', P, 'picks'), where('changeCount', '>', 0))))
  })
})

describe('tient : écriture des pronos', () => {
  it('refuse un historique écrit seul pour un prono existant (sans changer le prono)', async () => {
    const alice = dbAs('alice')
    await assertSucceeds(pick(alice, 'alice', 'bretagne', 1))
    await assertFails(
      setDoc(sub(alice, 'pickHistory', 'alice_2'), { uid: 'alice', candidateId: 'corse', changeCount: 2, at: serverTimestamp() }),
    )
  })

  it('refuse un historique avec un autre uid, ou rangé dans une autre party', async () => {
    const alice = dbAs('alice')
    const b = writeBatch(alice)
    b.set(sub(alice, 'picks', 'alice'), { candidateId: 'corse', changeCount: 1, updatedAt: serverTimestamp() })
    b.set(sub(alice, 'pickHistory', 'alice_1', P2), { uid: 'alice', candidateId: 'corse', changeCount: 1, at: serverTimestamp() })
    await assertFails(b.commit())
    const b2 = writeBatch(alice)
    b2.set(sub(alice, 'picks', 'alice'), { candidateId: 'corse', changeCount: 1, updatedAt: serverTimestamp() })
    b2.set(sub(alice, 'pickHistory', 'alice_1'), { uid: 'bob', candidateId: 'corse', changeCount: 1, at: serverTimestamp() })
    await assertFails(b2.commit())
  })

  it('refuse un changement d’avis après la fermeture via quitter puis revenir', async () => {
    const alice = dbAs('alice')
    await assertSucceeds(pick(alice, 'alice', 'bretagne', 1))
    await assertSucceeds(setStatus(dbAs('olga'), 'olga', 'open', 'closed', 1))
    await assertSucceeds(deleteDoc(sub(alice, 'members', 'alice')))
    await assertSucceeds(joinBatch(alice, 'alice', CODE, { hasPicked: true }))
    await assertFails(pick(alice, 'alice', 'corse', 2))
  })

  it('refuse un prono écrit dans le même batch que l’adhésion (sans être déjà membre)', async () => {
    const carol = dbAs('carol')
    const b = writeBatch(carol)
    b.set(sub(carol, 'joinProofs', 'carol'), { code: CODE })
    b.set(sub(carol, 'members', 'carol'), { uid: 'carol', editionId: E, joinedAt: serverTimestamp(), hasPicked: false })
    b.set(sub(carol, 'picks', 'carol'), { candidateId: 'corse', changeCount: 1, updatedAt: serverTimestamp() })
    b.set(sub(carol, 'pickHistory', 'carol_1'), { uid: 'carol', candidateId: 'corse', changeCount: 1, at: serverTimestamp() })
    await assertFails(b.commit())
  })

  it('refuse un candidateId de plus de 64 caractères', async () => {
    await assertFails(pick(dbAs('alice'), 'alice', 'a'.repeat(65), 1))
  })

  it('refuse un prono écrit par un membre dans le même batch qu’une réouverture (non admin)', async () => {
    await setRaw(['parties', P], { status: 'closed' })
    const alice = dbAs('alice')
    const b = writeBatch(alice)
    b.update(partyDoc(alice), { status: 'open', eventCount: 1 })
    b.set(sub(alice, 'events', '1'), { type: 'status', from: 'closed', to: 'open', by: 'alice', at: serverTimestamp() })
    b.set(sub(alice, 'picks', 'alice'), { candidateId: 'corse', changeCount: 1, updatedAt: serverTimestamp() })
    b.set(sub(alice, 'pickHistory', 'alice_1'), { uid: 'alice', candidateId: 'corse', changeCount: 1, at: serverTimestamp() })
    await assertFails(b.commit())
  })
})

describe('tient : journal', () => {
  it('refuse une entrée de journal créée sans changement de la party (events/0 libre)', async () => {
    const olga = dbAs('olga')
    await assertFails(
      setDoc(sub(olga, 'events', '0'), { type: 'status', from: 'open', to: 'closed', by: 'olga', at: serverTimestamp() }),
    )
    await assertFails(
      setDoc(sub(olga, 'events', '0'), { type: 'status', from: 'open', to: 'open', by: 'olga', at: serverTimestamp() }),
    )
  })

  it('refuse une entrée de journal mensongère à l’occasion d’un renommage', async () => {
    const olga = dbAs('olga')
    const b = writeBatch(olga)
    b.update(partyDoc(olga), { name: 'Nouveau nom' })
    b.set(sub(olga, 'events', '0'), { type: 'status', from: 'closed', to: 'open', by: 'olga', at: serverTimestamp() })
    await assertFails(b.commit())
  })

  it('refuse au super admin de signer le journal au nom de l’admin', async () => {
    const boss = dbAs('boss')
    const b = writeBatch(boss)
    b.update(partyDoc(boss), { status: 'closed', eventCount: 1 })
    b.set(sub(boss, 'events', '1'), { type: 'status', from: 'open', to: 'closed', by: 'olga', at: serverTimestamp() })
    await assertFails(b.commit())
  })

  it('refuse de pré-créer une entrée future du journal', async () => {
    const olga = dbAs('olga')
    await assertFails(
      setDoc(sub(olga, 'events', '2'), { type: 'status', from: 'open', to: 'closed', by: 'olga', at: serverTimestamp() }),
    )
  })
})

describe('tient : rejoindre et codes', () => {
  it('refuse une preuve écrite avant un changement de code puis utilisée après', async () => {
    const carol = dbAs('carol')
    await assertSucceeds(setDoc(sub(carol, 'joinProofs', 'carol'), { code: CODE }))
    await assertSucceeds(regenerate(dbAs('olga'), CODE, 'NEWNEW'))
    await assertFails(
      setDoc(sub(carol, 'members', 'carol'), { uid: 'carol', editionId: E, joinedAt: serverTimestamp(), hasPicked: false }),
    )
  })

  it('un membre retiré revient avec le code (voulu, l’interface le dit), mais plus après un changement de code', async () => {
    await assertSucceeds(deleteDoc(sub(dbAs('olga'), 'members', 'bob')))
    await assertSucceeds(joinBatch(dbAs('bob'), 'bob', CODE))
    await assertSucceeds(deleteDoc(sub(dbAs('olga'), 'members', 'bob')))
    await assertSucceeds(regenerate(dbAs('olga'), CODE, 'NEWNEW'))
    await assertFails(joinBatch(dbAs('bob'), 'bob', CODE))
    await assertFails(getDoc(partyDoc(dbAs('bob'))))
  })

  it('refuse au super admin d’entrer dans une party sans le code', async () => {
    const boss = dbAs('boss')
    await assertFails(
      setDoc(sub(boss, 'members', 'boss'), { uid: 'boss', editionId: E, joinedAt: serverTimestamp(), hasPicked: false }),
    )
  })

  it('refuse d’écraser une party existante en la « créant »', async () => {
    await assertFails(createBatch(dbAs('carol'), 'carol', P, 'CCCCCC'))
  })

  it('refuse de lister les parties ou les codes, même filtré', async () => {
    const carol = dbAs('carol')
    await assertFails(getDocs(query(collection(carol, 'parties'), where('editionId', '==', E))))
    await assertFails(getDocs(query(collection(carol, 'partyCodes'), where('partyId', '==', P))))
    await assertFails(getDocs(query(collection(carol, 'parties'), where('ownerUid', '==', 'olga'))))
  })

  it('une adhésion avec une date d’arrivée falsifiée est refusée', async () => {
    await assertFails(joinBatch(dbAs('carol'), 'carol', CODE, { joinedAt: Timestamp.fromDate(new Date('2026-01-01')) }))
  })
})

describe('tient : rôles', () => {
  it('refuse à un membre de se nommer admin en écrivant ownerUid, avec ou sans journal', async () => {
    const alice = dbAs('alice')
    await assertFails(updateDoc(partyDoc(alice), { ownerUid: 'alice' }))
    const b = writeBatch(alice)
    b.update(partyDoc(alice), { ownerUid: 'alice', eventCount: 1 })
    b.set(sub(alice, 'events', '1'), { type: 'owner', from: 'olga', to: 'alice', by: 'alice', at: serverTimestamp() })
    await assertFails(b.commit())
  })

  it('refuse à l’admin de partir dans le même batch que sa transmission', async () => {
    const olga = dbAs('olga')
    const b = writeBatch(olga)
    b.update(partyDoc(olga), { ownerUid: 'alice', eventCount: 1 })
    b.set(sub(olga, 'events', '1'), { type: 'owner', from: 'olga', to: 'alice', by: 'olga', at: serverTimestamp() })
    b.delete(sub(olga, 'members', 'olga'))
    await assertFails(b.commit())
  })

  it('refuse de devenir super admin, même dans un batch de création de profil', async () => {
    const carol = dbAs('carol')
    await assertFails(setDoc(doc(carol, 'admins', 'carol'), {}))
    await assertFails(getDocs(collection(carol, 'admins')))
  })
})

describe('tient : profils', () => {
  it('refuse de falsifier createdAt à la création ou ensuite', async () => {
    const carol = dbAs('carol')
    const b = writeBatch(carol)
    b.set(doc(carol, 'users', 'carol'), {
      displayName: 'Carol',
      displayNameLower: 'carol',
      photo: null,
      createdAt: Timestamp.fromDate(new Date('2020-01-01')),
    })
    b.set(doc(carol, 'usernames', 'carol'), { uid: 'carol' })
    await assertFails(b.commit())
    await assertFails(updateDoc(doc(dbAs('olga'), 'users', 'olga'), { createdAt: serverTimestamp() }))
  })

  it('refuse de garder deux pseudos, ou de libérer le pseudo d’un autre', async () => {
    const olga = dbAs('olga')
    const b = writeBatch(olga)
    b.update(doc(olga, 'users', 'olga'), { displayName: 'Olgaa', displayNameLower: 'olgaa' })
    b.set(doc(olga, 'usernames', 'olgaa'), { uid: 'olga' })
    await assertFails(b.commit())
    await assertFails(deleteDoc(doc(dbAs('carol'), 'usernames', 'olga')))
  })

  it('refuse une photo SVG ou avec du contenu hors base64', async () => {
    await assertFails(updateDoc(doc(dbAs('olga'), 'users', 'olga'), { photo: 'data:image/svg+xml;base64,AAAA' }))
    await assertFails(updateDoc(doc(dbAs('olga'), 'users', 'olga'), { photo: 'data:image/webp;base64,AA"><script>' }))
  })
})
