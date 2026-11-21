import type { UserProfile } from '../lib'
import './Avatar.css'

export type AvatarSize = 'sm' | 'md' | 'lg'

/**
 * Avatar rond d'un joueur : sa photo, sinon l'initiale de son pseudo.
 * Décoratif (aria-hidden) : le pseudo est toujours écrit à côté.
 */
export function Avatar({
  profile,
  size = 'md',
  photo,
  name,
}: {
  profile?: Pick<UserProfile, 'displayName' | 'photo'> | null
  size?: AvatarSize
  /** Pour un aperçu avant enregistrement (onboarding, profil) : remplace profile.photo. */
  photo?: string | null
  /** Pour un aperçu : remplace profile.displayName. */
  name?: string
}) {
  const src = photo !== undefined ? photo : (profile?.photo ?? null)
  const label = (name ?? profile?.displayName ?? '').trim()
  const initial = label ? [...label][0]!.toUpperCase() : '?'
  return (
    <span className={`avatar avatar--${size}`} aria-hidden="true">
      {src ? <img className="avatar__img" src={src} alt="" /> : <span className="avatar__initial">{initial}</span>}
    </span>
  )
}
