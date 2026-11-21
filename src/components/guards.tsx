import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth, useIsAdmin, useProfile } from '../lib'

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
  if (profile.loading) return <Loading />
  if (!profile.data) return <Navigate to="/bienvenue" replace />
  return children
}

/** Réservé à l'admin (admins/{uid}) ; sinon retour à l'accueil. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const admin = useIsAdmin()
  if (admin.loading) return <Loading />
  if (!admin.data) return <Navigate to="/" replace />
  return children
}
