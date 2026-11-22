import { Link } from 'react-router'
import { useNow } from '../components/useNow'
import { currentEdition, useCurrentParties, type Edition } from '../lib'
import '../styles/ui.css'
import './HomePage.css'

const DAY = 24 * 60 * 60 * 1000
/** Durée approximative de l'émission, pour afficher « En direct » pendant la soirée. */
const SHOW_LENGTH = 4 * 60 * 60 * 1000

function showDate(date: Date): string {
  const day = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const time = `${date.getHours()}h${String(date.getMinutes()).padStart(2, '0')}`
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} à ${time}`
}

function Countdown({ edition }: { edition: Edition }) {
  const remaining0 = edition.showAt.getTime() - Date.now()
  const now = useNow(remaining0 < 2 * DAY ? 1000 : 60 * 1000)
  const remaining = edition.showAt.getTime() - now.getTime()

  if (remaining <= 0) {
    if (-remaining < SHOW_LENGTH) return <p className="live-badge">En direct sur TF1</p>
    return <p className="muted">L'émission est passée.</p>
  }
  if (remaining >= DAY) {
    const days = Math.ceil(remaining / DAY)
    return (
      <p className="home__countdown">
        <span aria-hidden="true">J-{days}</span>
        <span className="visually-hidden">Dans {days} jours</span>
      </p>
    )
  }
  const h = Math.floor(remaining / 3_600_000)
  const m = Math.floor((remaining % 3_600_000) / 60_000)
  const s = Math.floor((remaining % 60_000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <p className="home__countdown">
      <span aria-hidden="true">
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
      <span className="visually-hidden">
        Dans {h} heures et {m} minutes
      </span>
    </p>
  )
}

const STEPS: { title: string; text: string }[] = [
  {
    title: 'Crée ta party ou rejoins tes amis',
    text: "Une party, c'est ton groupe pour la soirée. Crée la tienne et partage le code, ou entre celui qu'un ami t'a envoyé.",
  },
  {
    title: 'Choisis ta Miss',
    text: "Parcours les candidates et choisis celle que tu vois gagner. Tu peux changer d'avis jusqu'à la fermeture des pronos.",
  },
  {
    title: 'Découvre les pronos des autres',
    text: "Personne ne voit les choix des autres avant la fermeture. Ensuite, tout est révélé, changements d'avis compris.",
  },
  {
    title: 'Vis la soirée en direct',
    text: "Top 15, top 5, podium : tu vois si ta Miss est encore en course. 🥇 si elle est élue, 🥈 1re dauphine, 🥉 2e dauphine. Tes trophées restent sur ton profil.",
  },
]

/** Accueil : la date de l'émission, ce qu'est l'app, et l'accès aux parties. */
export function HomePage() {
  const edition = currentEdition()
  const current = useCurrentParties()
  const hasParty = current.data.parties.length > 0

  return (
    <section className="page home stack stack--lg" aria-labelledby="home-title">
      <header className="home__header">
        <h1 id="home-title">Pronos Miss {edition ? edition.id : ''}</h1>
        {edition && (
          <>
            <p className="home__date">{showDate(edition.showAt)}, sur TF1</p>
            <Countdown edition={edition} />
          </>
        )}
      </header>

      <div className="stack">
        <p className="home__lead">
          Le jeu de pronos Miss France entre amis : chacun choisit la candidate qu'il voit gagner, et on compare le soir
          de l'élection.
        </p>
        <Link to="/parties" className="button button--action home__cta" aria-busy={current.loading}>
          {current.loading ? 'Mes parties' : hasParty ? 'Voir mes parties' : 'Créer ou rejoindre une party'}
        </Link>
      </div>

      <section className="stack" aria-labelledby="home-how">
        <h2 id="home-how" className="section-title">
          Comment ça marche
        </h2>
        <ol className="home__steps">
          {STEPS.map((step) => (
            <li key={step.title} className="home__step">
              <h3 className="home__step-title">{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <p className="muted home__note">
        C'est un jeu entre amis, pas le vrai vote : celui-là se passe sur TF1, par SMS et téléphone.
      </p>
    </section>
  )
}
