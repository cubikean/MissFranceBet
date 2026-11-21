// Pages provisoires, une par route de docs/SPEC.md. Remplace chacune par son vrai écran
// (un fichier par page dans src/pages/), sans changer les routes de src/App.tsx.
import { useParams } from 'react-router'
import { Sash } from '../components/Sash'
import { Placeholder } from './Placeholder'

export function LoginPage() {
  return <Placeholder title="Connexion" route="/connexion" />
}

export function WelcomePage() {
  return <Placeholder title="Bienvenue" route="/bienvenue" />
}

/** Rejoindre une party avec son code ; /rejoindre/:code = lien d'invitation (code pré-rempli). */
export function JoinPage() {
  const { code } = useParams()
  return <Placeholder title="Rejoindre une party" route={`/rejoindre/${code ?? ''}`} />
}

/** Mes parties : choisir la party active, en créer une, en rejoindre une. */
export function PartiesPage() {
  return <Placeholder title="Mes parties" route="/parties" />
}

export function HomePage() {
  return (
    <Placeholder title="Pronos Miss" route="/">
      <div style={{ display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-5)', justifyItems: 'start' }}>
        <Sash region="Bretagne" size="lg" />
        <Sash region="Corse" variant="eliminated" />
        <Sash region="Provence" variant="winner" />
        <Sash region="Mon prono" variant="mine" size="sm" />
        <Sash region="Saint-Martin-et-Saint-Barthélemy" />
      </div>
    </Placeholder>
  )
}

export function CandidatesPage() {
  return <Placeholder title="Candidates" route="/candidates" />
}

export function CandidatePage() {
  const { id } = useParams()
  return <Placeholder title="Fiche candidate" route={`/candidates/${id ?? ''}`} />
}

export function PartyPage() {
  return <Placeholder title="Soirée" route="/soiree" />
}

export function ProfilePage() {
  return <Placeholder title="Profil" route="/profil" />
}

/** Gestion de la party active : réservée à son admin ou au super admin (canManageParty). */
export { PartyAdminPage } from './PartyAdminPage'

/** Super admin : toutes les parties. */
export function AdminPage() {
  return <Placeholder title="Super admin" route="/admin" />
}

export function NotFoundPage() {
  return <Placeholder title="Page introuvable" route="404" />
}
