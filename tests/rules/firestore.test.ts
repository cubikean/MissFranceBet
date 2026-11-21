// Tests des règles Firestore contre l'émulateur : npm run test:rules
//
// Distribution : boss = super admin ; olga = créatrice et admin de la party P ; alice et bob =
// membres de P ; carol = joueuse sans party ; dan = créateur d'une autre party (P2).
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
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
  runTransaction,
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

const dbAs = (uid: string | null): Firestore =>
  (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore()) as unknown as Firestore

const partyDoc = (db: Firestore, p = P) => doc(db, 'parties', p)
const sub = (db: Firestore, name: string, id: string, p = P) => doc(db, 'parties', p, name, id)

/** Écrit un prono comme le fait setPick (batch pick + historique + hasPicked). */
async function pick(db: Firestore, uid: string, candidateId: string, n: number, p = P) {
  const b = writeBatch(db)
  b.set(sub(db, 'picks', uid, p), { candidateId, changeCount: n, updatedAt: serverTimestamp() })
  b.set(sub(db, 'pickHistory', `${uid}_${n}`, p), { uid, candidateId, changeCount: n, at: serverTimestamp() })
  b.update(sub(db, 'members', uid, p), { hasPicked: true })
  return b.commit()
}

/** Rejoint comme le fait joinParty : preuve du code + adhésion dans le même batch. */
async function joinBatch(db: Firestore, uid: string, code: string, extra: Record<string, unknown> = {}, p = P) {
  const b = writeBatch(db)
  b.set(sub(db, 'joinProofs', uid, p), { code })
  b.set(sub(db, 'members', uid, p), { uid, editionId: E, joinedAt: serverTimestamp(), hasPicked: false, ...extra })
  return b.commit()
}

/** Crée une party comme le fait createParty. `over` permet de fausser un champ. */
async function createBatch(
  db: Firestore,
  uid: string,
  p: string,
  code: string,
  over: { party?: Record<string, unknown>; codeDoc?: Record<string, unknown> | null; member?: boolean } = {},
) {
  const b = writeBatch(db)
  b.set(partyDoc(db, p), {
    editionId: E,
    name: 'Les copains',
    ownerUid: uid,
    code,
    status: 'open',
    eventCount: 0,
    createdAt: serverTimestamp(),
    ...over.party,
  })
  if (over.codeDoc !== null) b.set(doc(db, 'partyCodes', code), { partyId: p, editionId: E, ...over.codeDoc })
  if (over.member !== false) {
    b.set(sub(db, 'members', uid, p), { uid, editionId: E, joinedAt: serverTimestamp(), hasPicked: false })
  }
  return b.commit()
}

/** Change de phase comme le fait setPartyStatus (party + events/{n} dans le même batch). */
async function setStatus(db: Firestore, uid: string, from: string, to: string, n: number, event: Record<string, unknown> = {}) {
  const b = writeBatch(db)
  b.update(partyDoc(db), { status: to, eventCount: n })
  b.set(sub(db, 'events', String(n)), { type: 'status', from, to, by: uid, at: serverTimestamp(), ...event })
  return b.commit()
}

/** Transmet le rôle d'admin comme le fait transferOwnership (party + events/{n}). */
async function transfer(db: Firestore, uid: string, from: string, to: string, n: number, event: Record<string, unknown> = {}) {
  const b = writeBatch(db)
  b.update(partyDoc(db), { ownerUid: to, eventCount: n })
  b.set(sub(db, 'events', String(n)), { type: 'owner', from, to, by: uid, at: serverTimestamp(), ...event })
  return b.commit()
}

/** Supprime la party comme le fait deleteParty (adhésions + code + party). */
async function deletePartyBatch(db: Firestore, opts: { keepMembers?: boolean; keepCode?: boolean } = {}) {
  const b = writeBatch(db)
  if (!opts.keepMembers) for (const uid of ['olga', 'alice', 'bob']) b.delete(sub(db, 'members', uid))
  if (!opts.keepCode) b.delete(doc(db, 'partyCodes', CODE))
  b.delete(partyDoc(db))
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
  })
}

async function setStatusRaw(status: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore() as unknown as Firestore, 'parties', P), { status })
  })
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-pronos-miss',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await seed()
})

describe('création de party', () => {
  it('crée une party : son créateur en est admin et membre, le code est réservé', async () => {
    await assertSucceeds(createBatch(dbAs('carol'), 'carol', 'p3', 'ABCDEF'))
    const party = await getDoc(partyDoc(dbAs('carol'), 'p3'))
    expect(party.data()?.ownerUid).toBe('carol')
  })

  it('refuse un code déjà pris par une autre party', async () => {
    await assertFails(createBatch(dbAs('carol'), 'carol', 'p3', CODE))
  })

  it('refuse une party sans code réservé ou sans adhésion du créateur', async () => {
    await assertFails(createBatch(dbAs('carol'), 'carol', 'p3', 'ABCDEF', { codeDoc: null }))
    await assertFails(createBatch(dbAs('carol'), 'carol', 'p3', 'ABCDEF', { member: false }))
  })

  it('refuse de créer une party au nom d’un autre', async () => {
    await assertFails(createBatch(dbAs('carol'), 'carol', 'p3', 'ABCDEF', { party: { ownerUid: 'alice' } }))
  })

  it('refuse une party qui ne démarre pas ouverte à zéro', async () => {
    await assertFails(createBatch(dbAs('carol'), 'carol', 'p3', 'ABCDEF', { party: { status: 'closed' } }))
    await assertFails(createBatch(dbAs('carol'), 'carol', 'p3', 'ABCDEF', { party: { eventCount: 3 } }))
  })

  it('refuse un code mal formé, une édition invalide ou un nom invalide', async () => {
    await assertFails(createBatch(dbAs('carol'), 'carol', 'p3', 'abc'))
    await assertFails(createBatch(dbAs('carol'), 'carol', 'p3', 'ABCDE0'))
    await assertFails(createBatch(dbAs('carol'), 'carol', 'p3', 'ABCDEF', { party: { editionId: 'x' } }))
    await assertFails(createBatch(dbAs('carol'), 'carol', 'p3', 'ABCDEF', { party: { name: 'x' } }))
  })

  it('refuse un code dont l’édition ne correspond pas à la party', async () => {
    await assertFails(createBatch(dbAs('carol'), 'carol', 'p3', 'ABCDEF', { codeDoc: { editionId: '2028' } }))
  })

  it('refuse d’ajouter un second code à une party existante', async () => {
    await assertFails(setDoc(doc(dbAs('olga'), 'partyCodes', 'ZZZZZZ'), { partyId: P, editionId: E }))
  })

  it('laisse lire un code par son id, mais pas lister ni modifier les codes', async () => {
    await assertSucceeds(getDoc(doc(dbAs('carol'), 'partyCodes', CODE)))
    await assertFails(getDocs(collection(dbAs('carol'), 'partyCodes')))
    await assertFails(updateDoc(doc(dbAs('olga'), 'partyCodes', CODE), { partyId: P2 }))
    await assertFails(deleteDoc(doc(dbAs('olga'), 'partyCodes', CODE)))
  })
})

describe('rejoindre une party', () => {
  it('accepte le bon code', async () => {
    await assertSucceeds(joinBatch(dbAs('carol'), 'carol', CODE))
  })

  it('refuse un mauvais code, ou le code d’une autre party', async () => {
    await assertFails(joinBatch(dbAs('carol'), 'carol', 'AAAAAA'))
    await assertFails(joinBatch(dbAs('carol'), 'carol', CODE2))
  })

  it('refuse de rejoindre à la place d’un autre', async () => {
    const carol = dbAs('carol')
    const b = writeBatch(carol)
    b.set(sub(carol, 'joinProofs', 'carol'), { code: CODE })
    b.set(sub(carol, 'members', 'dave'), { uid: 'dave', editionId: E, joinedAt: serverTimestamp(), hasPicked: false })
    await assertFails(b.commit())
  })

  it('refuse de rejoindre sans preuve du code', async () => {
    await assertFails(
      setDoc(sub(dbAs('carol'), 'members', 'carol'), { uid: 'carol', editionId: E, joinedAt: serverTimestamp(), hasPicked: false }),
    )
  })

  it('refuse de stocker le code dans l’adhésion, ou une édition incohérente', async () => {
    await assertFails(joinBatch(dbAs('carol'), 'carol', CODE, { code: CODE }))
    await assertFails(joinBatch(dbAs('carol'), 'carol', CODE, { editionId: '2028' }))
    await assertFails(joinBatch(dbAs('carol'), 'carol', CODE, { hasPicked: true }))
  })

  it('rend la preuve illisible, même pour son auteur et le super admin, puis la laisse supprimer', async () => {
    await assertSucceeds(joinBatch(dbAs('carol'), 'carol', CODE))
    await assertFails(getDoc(sub(dbAs('carol'), 'joinProofs', 'carol')))
    await assertFails(getDoc(sub(dbAs('olga'), 'joinProofs', 'carol')))
    await assertFails(getDoc(sub(dbAs('boss'), 'joinProofs', 'carol')))
    await assertFails(getDocs(collection(dbAs('carol'), 'parties', P, 'joinProofs')))
    await assertFails(deleteDoc(sub(dbAs('alice'), 'joinProofs', 'carol')))
    await assertSucceeds(deleteDoc(sub(dbAs('carol'), 'joinProofs', 'carol')))
  })

  it('refuse une preuve écrite pour quelqu’un d’autre', async () => {
    await assertFails(setDoc(sub(dbAs('carol'), 'joinProofs', 'dave'), { code: CODE }))
  })
})

describe('lecture des parties', () => {
  it('montre la party et son code aux membres seulement', async () => {
    const snap = await getDoc(partyDoc(dbAs('alice')))
    expect(snap.data()?.code).toBe(CODE)
    await assertFails(getDoc(partyDoc(dbAs('carol'))))
    await assertFails(getDoc(partyDoc(dbAs('dan'))))
  })

  it('cache la liste des membres aux non-membres', async () => {
    await assertFails(getDocs(collection(dbAs('carol'), 'parties', P, 'members')))
    await assertFails(getDocs(collection(dbAs('dan'), 'parties', P, 'members')))
    await assertSucceeds(getDocs(collection(dbAs('alice'), 'parties', P, 'members')))
  })

  it('ne laisse lister toutes les parties qu’au super admin', async () => {
    await assertFails(getDocs(collection(dbAs('olga'), 'parties')))
    await assertSucceeds(getDocs(collection(dbAs('boss'), 'parties')))
    await assertSucceeds(getDoc(partyDoc(dbAs('boss'))))
  })

  it('laisse chacun lister ses propres adhésions, pas celles des autres', async () => {
    const alice = dbAs('alice')
    const mine = await getDocs(query(collectionGroup(alice, 'members'), where('uid', '==', 'alice')))
    expect(mine.docs.map((d) => d.ref.parent.parent?.id)).toEqual([P])
    await assertFails(getDocs(query(collectionGroup(alice, 'members'), where('uid', '==', 'dan'))))
    await assertFails(getDocs(collectionGroup(alice, 'members')))
  })
})

describe('pronos', () => {
  it('accepte un premier prono puis un changement d’avis', async () => {
    const alice = dbAs('alice')
    await assertSucceeds(pick(alice, 'alice', 'bretagne', 1))
    await assertSucceeds(pick(alice, 'alice', 'corse', 2))
  })

  it('refuse d’écrire le prono de quelqu’un d’autre', async () => {
    const alice = dbAs('alice')
    await assertFails(pick(alice, 'bob', 'bretagne', 1))
    const b = writeBatch(alice)
    b.set(sub(alice, 'picks', 'bob'), { candidateId: 'corse', changeCount: 1, updatedAt: serverTimestamp() })
    b.set(sub(alice, 'pickHistory', 'bob_1'), { uid: 'bob', candidateId: 'corse', changeCount: 1, at: serverTimestamp() })
    await assertFails(b.commit())
  })

  it('refuse un prono si on n’est pas membre de la party', async () => {
    for (const uid of ['carol', 'dan']) {
      const db = dbAs(uid)
      const b = writeBatch(db)
      b.set(sub(db, 'picks', uid), { candidateId: 'corse', changeCount: 1, updatedAt: serverTimestamp() })
      b.set(sub(db, 'pickHistory', `${uid}_1`), { uid, candidateId: 'corse', changeCount: 1, at: serverTimestamp() })
      await assertFails(b.commit())
    }
  })

  it('refuse d’écrire après la fermeture', async () => {
    const alice = dbAs('alice')
    await assertSucceeds(pick(alice, 'alice', 'bretagne', 1))
    await setStatusRaw('closed')
    await assertFails(pick(alice, 'alice', 'corse', 2))
    await setStatusRaw('finished')
    await assertFails(pick(alice, 'alice', 'corse', 2))
  })

  it('refuse un updatedAt falsifié', async () => {
    const alice = dbAs('alice')
    const fake = Timestamp.fromDate(new Date('2026-12-01'))
    const b = writeBatch(alice)
    b.set(sub(alice, 'picks', 'alice'), { candidateId: 'corse', changeCount: 1, updatedAt: fake })
    b.set(sub(alice, 'pickHistory', 'alice_1'), { uid: 'alice', candidateId: 'corse', changeCount: 1, at: fake })
    await assertFails(b.commit())
  })

  it('refuse de sauter ou de répéter un changeCount', async () => {
    const alice = dbAs('alice')
    await assertFails(pick(alice, 'alice', 'bretagne', 2))
    await assertSucceeds(pick(alice, 'alice', 'bretagne', 1))
    await assertFails(pick(alice, 'alice', 'corse', 3))
    await assertFails(pick(alice, 'alice', 'corse', 1))
  })

  it('refuse un prono sans historique', async () => {
    await assertFails(
      setDoc(sub(dbAs('alice'), 'picks', 'alice'), { candidateId: 'corse', changeCount: 1, updatedAt: serverTimestamp() }),
    )
  })

  it('refuse un historique sans prono', async () => {
    await assertFails(
      setDoc(sub(dbAs('alice'), 'pickHistory', 'alice_1'), {
        uid: 'alice',
        candidateId: 'corse',
        changeCount: 1,
        at: serverTimestamp(),
      }),
    )
  })

  it('refuse un historique incohérent avec le prono', async () => {
    const alice = dbAs('alice')
    const b = writeBatch(alice)
    b.set(sub(alice, 'picks', 'alice'), { candidateId: 'corse', changeCount: 1, updatedAt: serverTimestamp() })
    b.set(sub(alice, 'pickHistory', 'alice_1'), { uid: 'alice', candidateId: 'bretagne', changeCount: 1, at: serverTimestamp() })
    await assertFails(b.commit())
  })

  it('refuse un identifiant de candidate mal formé', async () => {
    await assertFails(pick(dbAs('alice'), 'alice', 'Atlantide!', 1))
    await assertFails(pick(dbAs('alice'), 'alice', '', 1))
  })

  it('refuse de modifier ou supprimer un historique ou un prono', async () => {
    const alice = dbAs('alice')
    await assertSucceeds(pick(alice, 'alice', 'bretagne', 1))
    const h = sub(alice, 'pickHistory', 'alice_1')
    await assertFails(updateDoc(h, { candidateId: 'corse' }))
    await assertFails(setDoc(h, { uid: 'alice', candidateId: 'corse', changeCount: 1, at: serverTimestamp() }))
    await assertFails(deleteDoc(h))
    await assertFails(deleteDoc(sub(alice, 'picks', 'alice')))
    await assertFails(deleteDoc(sub(dbAs('boss'), 'picks', 'alice')))
  })

  it('cache les pronos des autres avant la fermeture, admin de party et super admin compris', async () => {
    await assertSucceeds(pick(dbAs('alice'), 'alice', 'bretagne', 1))
    await assertSucceeds(pick(dbAs('bob'), 'bob', 'corse', 1))
    const alice = dbAs('alice')
    await assertSucceeds(getDoc(sub(alice, 'picks', 'alice')))
    await assertSucceeds(getDocs(query(collection(alice, 'parties', P, 'pickHistory'), where('uid', '==', 'alice'))))
    await assertFails(getDoc(sub(alice, 'picks', 'bob')))
    await assertFails(getDocs(collection(alice, 'parties', P, 'picks')))
    await assertFails(getDoc(sub(alice, 'pickHistory', 'bob_1')))
    await assertFails(getDocs(collection(alice, 'parties', P, 'pickHistory')))
    for (const uid of ['olga', 'boss']) {
      await assertFails(getDocs(collection(dbAs(uid), 'parties', P, 'picks')))
      await assertFails(getDoc(sub(dbAs(uid), 'picks', 'bob')))
      await assertFails(getDocs(collection(dbAs(uid), 'parties', P, 'pickHistory')))
    }
  })

  it('révèle tout aux membres et au super admin après la fermeture, pas aux autres', async () => {
    await assertSucceeds(pick(dbAs('alice'), 'alice', 'bretagne', 1))
    await assertSucceeds(pick(dbAs('bob'), 'bob', 'corse', 1))
    await setStatusRaw('closed')
    const alice = dbAs('alice')
    await assertSucceeds(getDoc(sub(alice, 'picks', 'bob')))
    await assertSucceeds(getDocs(collection(alice, 'parties', P, 'picks')))
    await assertSucceeds(getDocs(collection(alice, 'parties', P, 'pickHistory')))
    await assertSucceeds(getDocs(collection(dbAs('boss'), 'parties', P, 'picks')))
    await assertFails(getDocs(collection(dbAs('carol'), 'parties', P, 'picks')))
    await assertFails(getDocs(collection(dbAs('dan'), 'parties', P, 'picks')))
  })
})

describe('membres et hasPicked', () => {
  const member = (uid: string, target = uid) => sub(dbAs(uid), 'members', target)

  it('refuse de passer hasPicked à true sans prono', async () => {
    await assertFails(updateDoc(member('alice'), { hasPicked: true }))
  })

  it('refuse de remettre hasPicked à false après un prono', async () => {
    await assertSucceeds(pick(dbAs('alice'), 'alice', 'corse', 1))
    await assertFails(updateDoc(member('alice'), { hasPicked: false }))
  })

  it('refuse de modifier sa date d’arrivée ou d’ajouter un champ', async () => {
    await assertFails(updateDoc(member('alice'), { joinedAt: serverTimestamp() }))
    await assertFails(updateDoc(member('alice'), { code: CODE }))
  })

  it('refuse de toucher à hasPicked après la fermeture', async () => {
    await assertSucceeds(pick(dbAs('alice'), 'alice', 'corse', 1))
    await setStatusRaw('closed')
    await assertFails(updateDoc(member('alice'), { hasPicked: true }))
  })

  it('laisse l’admin de la party et le super admin retirer un membre, pas les autres', async () => {
    await assertFails(deleteDoc(member('alice', 'bob')))
    await assertFails(deleteDoc(member('dan', 'bob')))
    await assertSucceeds(deleteDoc(member('olga', 'alice')))
    await assertSucceeds(deleteDoc(member('boss', 'bob')))
  })

  it('interdit de retirer l’admin de la party, ou qu’il parte sans transmettre son rôle', async () => {
    await assertFails(deleteDoc(member('olga')))
    await assertFails(deleteDoc(member('boss', 'olga')))
  })
})

describe('quitter une party', () => {
  it('laisse un membre quitter la party quand il veut, même après la fermeture', async () => {
    await assertSucceeds(deleteDoc(sub(dbAs('alice'), 'members', 'alice')))
    await setStatusRaw('closed')
    await assertSucceeds(deleteDoc(sub(dbAs('bob'), 'members', 'bob')))
    await assertFails(getDocs(collection(dbAs('bob'), 'parties', P, 'picks')))
  })

  it('retrouve son prono en revenant, avec hasPicked fidèle', async () => {
    await assertSucceeds(pick(dbAs('alice'), 'alice', 'corse', 1))
    await assertSucceeds(deleteDoc(sub(dbAs('alice'), 'members', 'alice')))
    await assertFails(joinBatch(dbAs('alice'), 'alice', CODE, { hasPicked: false }))
    await assertSucceeds(joinBatch(dbAs('alice'), 'alice', CODE, { hasPicked: true }))
  })
})

describe('transmission du rôle d’admin', () => {
  it('laisse l’admin transmettre son rôle à un membre, journalisé', async () => {
    await assertSucceeds(transfer(dbAs('olga'), 'olga', 'olga', 'alice', 1))
    const event = await getDoc(sub(dbAs('bob'), 'events', '1'))
    expect(event.data()).toMatchObject({ type: 'owner', from: 'olga', to: 'alice', by: 'olga' })
  })

  it('donne les droits au nouvel admin et les retire à l’ancien', async () => {
    await assertSucceeds(transfer(dbAs('olga'), 'olga', 'olga', 'alice', 1))
    await assertFails(setStatus(dbAs('olga'), 'olga', 'open', 'closed', 2))
    await assertSucceeds(setStatus(dbAs('alice'), 'alice', 'open', 'closed', 2))
    // l'ancien admin peut maintenant partir
    await assertSucceeds(deleteDoc(sub(dbAs('olga'), 'members', 'olga')))
  })

  it('refuse de transmettre à un non-membre', async () => {
    await assertFails(transfer(dbAs('olga'), 'olga', 'olga', 'carol', 1))
  })

  it('refuse une transmission par un simple membre', async () => {
    await assertFails(transfer(dbAs('alice'), 'alice', 'olga', 'alice', 1))
  })

  it('refuse une transmission sans journal, ou avec un journal faussé', async () => {
    await assertFails(updateDoc(partyDoc(dbAs('olga')), { ownerUid: 'alice' }))
    await assertFails(updateDoc(partyDoc(dbAs('olga')), { ownerUid: 'alice', eventCount: 1 }))
    await assertFails(transfer(dbAs('olga'), 'olga', 'bob', 'alice', 1))
    await assertFails(transfer(dbAs('olga'), 'olga', 'olga', 'alice', 1, { type: 'status' }))
  })

  it('refuse de changer de phase et d’admin dans la même écriture', async () => {
    const olga = dbAs('olga')
    const b = writeBatch(olga)
    b.update(partyDoc(olga), { ownerUid: 'alice', status: 'closed', eventCount: 1 })
    b.set(sub(olga, 'events', '1'), { type: 'owner', from: 'olga', to: 'alice', by: 'olga', at: serverTimestamp() })
    await assertFails(b.commit())
  })

  it('laisse le super admin réattribuer le rôle', async () => {
    await assertSucceeds(transfer(dbAs('boss'), 'boss', 'olga', 'bob', 1))
  })
})

describe('suppression d’une party', () => {
  it('laisse l’admin supprimer sa party, son code et les adhésions', async () => {
    await assertSucceeds(deletePartyBatch(dbAs('olga')))
    await assertFails(getDoc(partyDoc(dbAs('alice'))))
    let codeExists = true
    await env.withSecurityRulesDisabled(async (ctx) => {
      codeExists = (await getDoc(doc(ctx.firestore() as unknown as Firestore, 'partyCodes', CODE))).exists()
    })
    expect(codeExists).toBe(false)
  })

  it('laisse le super admin supprimer n’importe quelle party', async () => {
    await assertSucceeds(deletePartyBatch(dbAs('boss')))
  })

  it('refuse la suppression par un membre ou l’admin d’une autre party', async () => {
    await assertFails(deletePartyBatch(dbAs('alice')))
    await assertFails(deletePartyBatch(dbAs('dan')))
    await assertFails(deleteDoc(partyDoc(dbAs('alice'))))
  })

  it('refuse de libérer le code sans supprimer la party', async () => {
    await assertFails(deleteDoc(doc(dbAs('olga'), 'partyCodes', CODE)))
  })
})

describe('phases et journal', () => {
  it('laisse l’admin de la party fermer les pronos avec une entrée au journal', async () => {
    await assertSucceeds(setStatus(dbAs('olga'), 'olga', 'open', 'closed', 1))
    const event = await getDoc(sub(dbAs('alice'), 'events', '1'))
    expect(event.data()).toMatchObject({ from: 'open', to: 'closed', by: 'olga' })
  })

  it('autorise la réouverture, journalisée elle aussi', async () => {
    await assertSucceeds(setStatus(dbAs('olga'), 'olga', 'open', 'closed', 1))
    await assertSucceeds(setStatus(dbAs('olga'), 'olga', 'closed', 'open', 2))
    const events = await getDocs(collection(dbAs('bob'), 'parties', P, 'events'))
    expect(events.size).toBe(2)
  })

  it('refuse un changement de phase sans entrée au journal', async () => {
    await assertFails(updateDoc(partyDoc(dbAs('olga')), { status: 'closed', eventCount: 1 }))
    await assertFails(updateDoc(partyDoc(dbAs('olga')), { status: 'closed' }))
  })

  it('refuse un journal faussé (de, vers, auteur, numéro, heure)', async () => {
    const olga = dbAs('olga')
    await assertFails(setStatus(olga, 'olga', 'closed', 'closed', 1))
    await assertFails(setStatus(olga, 'olga', 'finished', 'closed', 1))
    await assertFails(setStatus(olga, 'olga', 'open', 'closed', 1, { to: 'finished' }))
    await assertFails(setStatus(olga, 'olga', 'open', 'closed', 1, { by: 'alice' }))
    await assertFails(setStatus(olga, 'olga', 'open', 'closed', 2))
    await assertFails(setStatus(olga, 'olga', 'open', 'closed', 1, { at: Timestamp.fromDate(new Date('2026-12-12')) }))
  })

  it('refuse un changement de phase par un simple membre ou l’admin d’une autre party', async () => {
    await assertFails(setStatus(dbAs('alice'), 'alice', 'open', 'closed', 1))
    await assertFails(setStatus(dbAs('dan'), 'dan', 'open', 'closed', 1))
  })

  it('laisse le super admin changer la phase de n’importe quelle party', async () => {
    await assertSucceeds(setStatus(dbAs('boss'), 'boss', 'open', 'closed', 1))
  })

  it('rend le journal immuable et invisible des non-membres', async () => {
    await assertSucceeds(setStatus(dbAs('olga'), 'olga', 'open', 'closed', 1))
    await assertFails(updateDoc(sub(dbAs('olga'), 'events', '1'), { by: 'bob' }))
    await assertFails(deleteDoc(sub(dbAs('olga'), 'events', '1')))
    await assertFails(deleteDoc(sub(dbAs('boss'), 'events', '1')))
    await assertFails(getDocs(collection(dbAs('carol'), 'parties', P, 'events')))
  })

  it('laisse renommer la party, mais pas changer son créateur, son code ou son édition', async () => {
    const olga = dbAs('olga')
    await assertSucceeds(updateDoc(partyDoc(olga), { name: 'Les Miss du 12' }))
    await assertFails(updateDoc(partyDoc(olga), { name: 'x' }))
    await assertFails(updateDoc(partyDoc(dbAs('alice')), { name: 'Piratée' }))
    await assertFails(updateDoc(partyDoc(olga), { ownerUid: 'alice' }))
    await assertFails(updateDoc(partyDoc(olga), { code: 'ZZZZZZ' }))
    await assertFails(updateDoc(partyDoc(olga), { editionId: '2028' }))
  })

  it('refuse une entrée de journal sans type ou d’un type inconnu', async () => {
    const olga = dbAs('olga')
    const b = writeBatch(olga)
    b.update(partyDoc(olga), { status: 'closed', eventCount: 1 })
    b.set(sub(olga, 'events', '1'), { from: 'open', to: 'closed', by: 'olga', at: serverTimestamp() })
    await assertFails(b.commit())
    await assertFails(setStatus(olga, 'olga', 'open', 'closed', 1, { type: 'magie' }))
  })
})

describe('résultats', () => {
  const results = (uid: string, data: Record<string, unknown> = { winner: 'bretagne', updatedAt: serverTimestamp() }) =>
    setDoc(sub(dbAs(uid), 'results', 'live'), data, { merge: true })

  it('laisse l’admin de la party et le super admin saisir les résultats', async () => {
    await assertSucceeds(results('olga'))
    await assertSucceeds(results('boss'))
    await assertSucceeds(getDoc(sub(dbAs('alice'), 'results', 'live')))
  })

  it('refuse les résultats saisis par un membre, l’admin d’une autre party ou un inconnu', async () => {
    await assertFails(results('alice'))
    await assertFails(results('dan'))
    await assertFails(results('carol'))
    await assertFails(getDoc(sub(dbAs('carol'), 'results', 'live')))
  })

  it('refuse un autre document que live ou des champs inconnus', async () => {
    await assertFails(setDoc(sub(dbAs('olga'), 'results', 'autre'), { winner: 'bretagne' }))
    await assertFails(results('olga', { winner: 'bretagne', trophee: 'olga' }))
  })
})

describe('super admin', () => {
  it('refuse de se rendre super admin', async () => {
    await assertFails(setDoc(doc(dbAs('alice'), 'admins', 'alice'), {}))
    await assertFails(setDoc(doc(dbAs('boss'), 'admins', 'alice'), {}))
  })

  it('ne laisse lire que son propre statut', async () => {
    await assertSucceeds(getDoc(doc(dbAs('alice'), 'admins', 'alice')))
    await assertFails(getDoc(doc(dbAs('alice'), 'admins', 'boss')))
  })
})

describe('visiteur non connecté', () => {
  it('ne peut rien lire ni écrire', async () => {
    const db = dbAs(null)
    await assertFails(getDoc(partyDoc(db)))
    await assertFails(getDoc(doc(db, 'partyCodes', CODE)))
    await assertFails(getDoc(doc(db, 'users', 'alice')))
    await assertFails(getDoc(doc(db, 'usernames', 'alice')))
    await assertFails(getDocs(collection(db, 'parties', P, 'members')))
    await assertFails(joinBatch(db, 'carol', CODE))
  })
})

describe('pseudos et profils', () => {
  async function claim(db: Firestore, uid: string, name: string) {
    const lower = name.toLowerCase()
    return runTransaction(db, async (tx) => {
      tx.set(doc(db, 'usernames', lower), { uid })
      tx.set(doc(db, 'users', uid), { displayName: name, displayNameLower: lower, emoji: '😎', createdAt: serverTimestamp() })
    })
  }

  it('réserve un pseudo libre', async () => {
    await assertSucceeds(claim(dbAs('alice'), 'alice', 'Hugo'))
  })

  it('refuse de voler un pseudo pris', async () => {
    await assertSucceeds(claim(dbAs('alice'), 'alice', 'Hugo'))
    await assertFails(claim(dbAs('bob'), 'bob', 'HUGO'))
    await assertFails(setDoc(doc(dbAs('bob'), 'usernames', 'hugo'), { uid: 'bob' }))
    await assertFails(deleteDoc(doc(dbAs('bob'), 'usernames', 'hugo')))
  })

  it('refuse un profil sans réservation du pseudo', async () => {
    await assertFails(
      setDoc(doc(dbAs('bob'), 'users', 'bob'), { displayName: 'Bob', displayNameLower: 'bob', emoji: '🦄', createdAt: serverTimestamp() }),
    )
  })

  it('refuse de modifier le profil d’un autre', async () => {
    await assertSucceeds(claim(dbAs('alice'), 'alice', 'Hugo'))
    await assertFails(updateDoc(doc(dbAs('bob'), 'users', 'alice'), { emoji: '💩' }))
    await assertSucceeds(updateDoc(doc(dbAs('alice'), 'users', 'alice'), { emoji: '👑' }))
  })

  it('change de pseudo en libérant l’ancien', async () => {
    const alice = dbAs('alice')
    await assertSucceeds(claim(alice, 'alice', 'Hugo'))
    const b = writeBatch(alice)
    b.delete(doc(alice, 'usernames', 'hugo'))
    b.set(doc(alice, 'usernames', 'cubik'), { uid: 'alice' })
    b.update(doc(alice, 'users', 'alice'), { displayName: 'Cubik', displayNameLower: 'cubik' })
    await assertSucceeds(b.commit())
    // garder l'ancien en plus du nouveau est refusé
    const b2 = writeBatch(alice)
    b2.set(doc(alice, 'usernames', 'autre'), { uid: 'alice' })
    b2.update(doc(alice, 'users', 'alice'), { displayName: 'Autre', displayNameLower: 'autre' })
    await assertFails(b2.commit())
  })
})
