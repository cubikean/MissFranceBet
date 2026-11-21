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

/** Gestion de la party active : réservée à son admin ou au super admin (canManageParty). */
export { PartyAdminPage } from './PartyAdminPage'

/** Super admin : toutes les parties. */
export { AdminPage } from './AdminPage'

export { NotFoundPage } from './NotFoundPage'
