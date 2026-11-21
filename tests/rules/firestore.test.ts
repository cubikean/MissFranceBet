// Tests des règles Firestore contre l'émulateur : npm run test:rules
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
const CODE = 'STRASS'
let env: RulesTestEnvironment

const dbAs = (uid: string | null): Firestore =>
  (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore()) as unknown as Firestore

/** Écrit un prono comme le fait setPick (batch pick + historique + hasPicked). */
async function pick(db: Firestore, uid: string, candidateId: string, n: number) {
  const b = writeBatch(db)
  b.set(doc(db, 'editions', E, 'picks', uid), { candidateId, changeCount: n, updatedAt: serverTimestamp() })
  b.set(doc(db, 'editions', E, 'pickHistory', `${uid}_${n}`), {
    uid,
    candidateId,
    changeCount: n,
    at: serverTimestamp(),
  })
  b.update(doc(db, 'editions', E, 'members', uid), { hasPicked: true })
  return b.commit()
}

async function seed(status: 'open' | 'closed' | 'finished' = 'open') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    await setDoc(doc(db, 'admins', 'admin'), {})
    await setDoc(doc(db, 'editions', E), {
      title: 'Miss France 2027',
      showAt: Timestamp.fromDate(new Date('2026-12-12T20:10:00+01:00')),
      status,
      createdAt: Timestamp.now(),
    })
    await setDoc(doc(db, 'editionSecrets', E), { code: CODE })
    for (const id of ['bretagne', 'corse', 'provence']) {
      await setDoc(doc(db, 'editions', E, 'candidates', id), { id, region: id, order: 0 })
    }
    for (const uid of ['alice', 'bob']) {
      await setDoc(doc(db, 'editions', E, 'members', uid), { joinedAt: Timestamp.now(), code: CODE, hasPicked: false })
    }
  })
}

async function setStatusRaw(status: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore() as unknown as Firestore, 'editions', E), { status })
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
    b.set(doc(alice, 'editions', E, 'picks', 'bob'), { candidateId: 'corse', changeCount: 1, updatedAt: serverTimestamp() })
    b.set(doc(alice, 'editions', E, 'pickHistory', 'bob_1'), { uid: 'bob', candidateId: 'corse', changeCount: 1, at: serverTimestamp() })
    await assertFails(b.commit())
  })

  it('refuse un prono si on n’est pas membre', async () => {
    const carol = dbAs('carol')
    const b = writeBatch(carol)
    b.set(doc(carol, 'editions', E, 'picks', 'carol'), { candidateId: 'corse', changeCount: 1, updatedAt: serverTimestamp() })
    b.set(doc(carol, 'editions', E, 'pickHistory', 'carol_1'), { uid: 'carol', candidateId: 'corse', changeCount: 1, at: serverTimestamp() })
    await assertFails(b.commit())
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
    b.set(doc(alice, 'editions', E, 'picks', 'alice'), { candidateId: 'corse', changeCount: 1, updatedAt: fake })
    b.set(doc(alice, 'editions', E, 'pickHistory', 'alice_1'), { uid: 'alice', candidateId: 'corse', changeCount: 1, at: fake })
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
    const alice = dbAs('alice')
    await assertFails(
      setDoc(doc(alice, 'editions', E, 'picks', 'alice'), { candidateId: 'corse', changeCount: 1, updatedAt: serverTimestamp() }),
    )
  })

  it('refuse un historique sans prono', async () => {
    const alice = dbAs('alice')
    await assertFails(
      setDoc(doc(alice, 'editions', E, 'pickHistory', 'alice_1'), {
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
    b.set(doc(alice, 'editions', E, 'picks', 'alice'), { candidateId: 'corse', changeCount: 1, updatedAt: serverTimestamp() })
    b.set(doc(alice, 'editions', E, 'pickHistory', 'alice_1'), { uid: 'alice', candidateId: 'bretagne', changeCount: 1, at: serverTimestamp() })
    await assertFails(b.commit())
  })

  it('refuse une candidate inexistante', async () => {
    await assertFails(pick(dbAs('alice'), 'alice', 'atlantide', 1))
  })

  it('refuse de modifier ou supprimer un historique ou un prono', async () => {
    const alice = dbAs('alice')
    await assertSucceeds(pick(alice, 'alice', 'bretagne', 1))
    const h = doc(alice, 'editions', E, 'pickHistory', 'alice_1')
    await assertFails(updateDoc(h, { candidateId: 'corse' }))
    await assertFails(setDoc(h, { uid: 'alice', candidateId: 'corse', changeCount: 1, at: serverTimestamp() }))
    await assertFails(deleteDoc(h))
    await assertFails(deleteDoc(doc(alice, 'editions', E, 'picks', 'alice')))
  })

  it('cache les pronos et historiques des autres avant la fermeture', async () => {
    await assertSucceeds(pick(dbAs('alice'), 'alice', 'bretagne', 1))
    await assertSucceeds(pick(dbAs('bob'), 'bob', 'corse', 1))
    const alice = dbAs('alice')
    await assertSucceeds(getDoc(doc(alice, 'editions', E, 'picks', 'alice')))
    await assertSucceeds(getDocs(query(collection(alice, 'editions', E, 'pickHistory'), where('uid', '==', 'alice'))))
    await assertFails(getDoc(doc(alice, 'editions', E, 'picks', 'bob')))
    await assertFails(getDocs(collection(alice, 'editions', E, 'picks')))
    await assertFails(getDoc(doc(alice, 'editions', E, 'pickHistory', 'bob_1')))
    await assertFails(getDocs(collection(alice, 'editions', E, 'pickHistory')))
    // l'admin voit tout
    await assertSucceeds(getDocs(collection(dbAs('admin'), 'editions', E, 'picks')))
  })

  it('révèle tout aux membres après la fermeture, pas aux non-membres', async () => {
    await assertSucceeds(pick(dbAs('alice'), 'alice', 'bretagne', 1))
    await assertSucceeds(pick(dbAs('bob'), 'bob', 'corse', 1))
    await setStatusRaw('closed')
    const alice = dbAs('alice')
    await assertSucceeds(getDoc(doc(alice, 'editions', E, 'picks', 'bob')))
    await assertSucceeds(getDocs(collection(alice, 'editions', E, 'picks')))
    await assertSucceeds(getDocs(collection(alice, 'editions', E, 'pickHistory')))
    await assertFails(getDocs(collection(dbAs('carol'), 'editions', E, 'picks')))
  })
})

describe('code de soirée', () => {
  const join = (uid: string, code: string) =>
    setDoc(doc(dbAs(uid), 'editions', E, 'members', uid), { joinedAt: serverTimestamp(), code, hasPicked: false })

  it('accepte le bon code', async () => {
    await assertSucceeds(join('carol', CODE))
  })

  it('refuse un mauvais code', async () => {
    await assertFails(join('carol', 'PAILLETTE'))
  })

  it('refuse de rejoindre à la place d’un autre', async () => {
    await assertFails(
      setDoc(doc(dbAs('carol'), 'editions', E, 'members', 'dave'), { joinedAt: serverTimestamp(), code: CODE, hasPicked: false }),
    )
  })

  it('ne laisse lire editionSecrets à personne, admin compris', async () => {
    await assertFails(getDoc(doc(dbAs('alice'), 'editionSecrets', E)))
    await assertFails(getDoc(doc(dbAs('admin'), 'editionSecrets', E)))
    await assertFails(getDocs(collection(dbAs('alice'), 'editionSecrets')))
  })

  it('cache la liste des membres aux non-membres', async () => {
    await assertFails(getDocs(collection(dbAs('carol'), 'editions', E, 'members')))
    await assertSucceeds(getDocs(collection(dbAs('alice'), 'editions', E, 'members')))
  })
})

describe('admin', () => {
  it('refuse de se rendre admin', async () => {
    await assertFails(setDoc(doc(dbAs('alice'), 'admins', 'alice'), {}))
    await assertFails(setDoc(doc(dbAs('admin'), 'admins', 'alice'), {}))
  })

  it('ne laisse lire que son propre statut admin', async () => {
    await assertSucceeds(getDoc(doc(dbAs('alice'), 'admins', 'alice')))
    await assertFails(getDoc(doc(dbAs('alice'), 'admins', 'admin')))
  })

  it('refuse résultats, statut, candidates et code aux non-admins', async () => {
    const alice = dbAs('alice')
    await assertFails(setDoc(doc(alice, 'editions', E, 'results', 'live'), { winner: 'bretagne' }))
    await assertFails(updateDoc(doc(alice, 'editions', E), { status: 'closed' }))
    await assertFails(setDoc(doc(alice, 'editions', E, 'candidates', 'x'), { region: 'X' }))
    await assertFails(setDoc(doc(alice, 'editionSecrets', E), { code: 'HACKED' }))
  })

  it('autorise l’admin à saisir résultats, statut et code', async () => {
    const admin = dbAs('admin')
    await assertSucceeds(setDoc(doc(admin, 'editions', E, 'results', 'live'), { winner: 'bretagne', updatedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(doc(admin, 'editions', E), { status: 'closed' }))
    await assertSucceeds(updateDoc(doc(admin, 'editions', E), { status: 'open' }))
    await assertFails(updateDoc(doc(admin, 'editions', E), { status: 'bidon' }))
    await assertSucceeds(setDoc(doc(admin, 'editionSecrets', E), { code: 'NOUVEAU' }))
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
    const bob = dbAs('bob')
    await assertFails(
      setDoc(doc(bob, 'users', 'bob'), { displayName: 'Bob', displayNameLower: 'bob', emoji: '🦄', createdAt: serverTimestamp() }),
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
