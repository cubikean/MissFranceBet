import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth, useIsSuperAdmin, useProfile } from '../lib'

function Loading() {
  return (
    <p className="page muted" role="status">
      Chargement…
    </p>
  )
}

/** Redirige vers /connexion si personne n'est connecté. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  return children
}

/** Redirige vers /bienvenue tant que le pseudo n'est pas choisi (à utiliser sous RequireAuth). */
export function RequireProfile({ children }: { children: ReactNode }) {
  const profile = useProfile()
  const location = useLocation()
  if (profile.loading) return <Loading />
  // `from` : après l'onboarding, on revient sur le lien d'invitation /rejoindre/<code>.
  if (!profile.data) return <Navigate to="/bienvenue" replace state={{ from: location.pathname }} />
  return children
}

/** Réservé au super admin (admins/{uid}) ; sinon retour à l'accueil. */
export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const admin = useIsSuperAdmin()
  if (admin.loading) return <Loading />
  if (!admin.data) return <Navigate to="/" replace />
  return children
}
