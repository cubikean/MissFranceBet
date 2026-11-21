import { useState } from 'react'
import '../styles/ui.css'
import './InviteShare.css'

/** Lien d'invitation d'une party : /rejoindre/<code> sur le domaine courant. */
export function inviteLink(code: string): string {
  return `${window.location.origin}/rejoindre/${code}`
}

/**
 * Code d'invitation et lien à envoyer aux amis : partage natif si le téléphone le permet,
 * sinon copie dans le presse-papiers.
 */
export function InviteShare({ code, partyName }: { code: string; partyName: string }) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const link = inviteLink(code)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function share() {
    setFeedback(null)
    if (canShare) {
      try {
        await navigator.share({
          title: `Pronos Miss : ${partyName}`,
          text: `Rejoins ma party « ${partyName} » pour les pronos Miss France. Code : ${code}`,
          url: link,
        })
        return
      } catch (e) {
        // Partage annulé par l'utilisateur : rien à faire.
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(link)
      setFeedback('Lien copié. Colle-le dans ta conversation de groupe.')
    } catch {
      setFeedback('Copie impossible : sélectionne le lien et copie-le à la main.')
    }
  }

  return (
    <div className="invite">
      <p>
        Code d'invitation : <span className="code-badge">{code}</span>
      </p>
      <p className="invite__link">
        <span className="visually-hidden">Lien d'invitation : </span>
        {link}
      </p>
      <button type="button" className="button button--ghost" onClick={() => void share()}>
        {canShare ? 'Partager le lien' : 'Copier le lien'}
      </button>
      <p className="form-ok" role="status">
        {feedback}
      </p>
    </div>
  )
}
