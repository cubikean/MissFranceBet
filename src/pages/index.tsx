// Une page par route de docs/SPEC.md, chacune dans son fichier de src/pages/.
// Les routes sont dans src/App.tsx (ne pas les changer).
import { Placeholder } from './Placeholder'

export { LoginPage } from './LoginPage'
export { WelcomePage } from './WelcomePage'
export { JoinPage } from './JoinPage'
export { PartiesPage } from './PartiesPage'
export { HomePage } from './HomePage'
export { CandidatesPage } from './CandidatesPage'
export { CandidatePage } from './CandidatePage'
export { PartyPage } from './PartyPage'
export { ProfilePage } from './ProfilePage'

/** Gestion de la party active : réservée à son créateur ou au super admin (canManageParty). */
export function PartyAdminPage() {
  return <Placeholder title="Gérer la party" route="/soiree/gestion" />
}

/** Super admin : toutes les parties. */
export function AdminPage() {
  return <Placeholder title="Super admin" route="/admin" />
}

export { NotFoundPage } from './NotFoundPage'
