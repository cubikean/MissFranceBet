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

export function JoinPage() {
  return <Placeholder title="Rejoindre la soirée" route="/rejoindre" />
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

export function AdminPage() {
  return <Placeholder title="Admin" route="/admin" />
}

export function NotFoundPage() {
  return <Placeholder title="Page introuvable" route="404" />
}
