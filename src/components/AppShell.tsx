import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useCurrentParties, useIsSuperAdmin } from '../lib'
import { InstallBanner } from './InstallBanner'
import './AppShell.css'

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
)

const TABS = [
  { to: '/', label: 'Accueil', end: true, icon: icon(<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />) },
  {
    to: '/parties',
    label: 'Parties',
    end: false,
    icon: icon(
      <>
        <circle cx="9" cy="8.5" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
      </>,
    ),
  },
  {
    to: '/candidates',
    label: 'Candidates',
    end: false,
    icon: icon(
      <>
        <rect x="3.5" y="3.5" width="7" height="9" rx="2" />
        <rect x="13.5" y="3.5" width="7" height="9" rx="2" />
        <path d="M3.5 17.5 20.5 14.5M3.5 20.5l17-3" />
      </>,
    ),
  },
  {
    to: '/soiree',
    label: 'Soirée',
    end: false,
    icon: icon(
      <>
        <rect x="3" y="5" width="18" height="12" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>,
    ),
  },
  {
    to: '/profil',
    label: 'Profil',
    end: false,
    icon: icon(
      <>
        <circle cx="12" cy="8.5" r="4" />
        <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
      </>,
    ),
  },
]

const ADMIN_TAB = {
  to: '/admin',
  label: 'Admin',
  end: false,
  icon: icon(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
}

/**
 * Bulle en haut de l'écran : la party dans laquelle comptent mes pronos.
 * Seulement si je suis dans plusieurs parties cette année (et pas sur /parties, qui l'indique déjà).
 */
function ActivePartyBubble() {
  const { pathname } = useLocation()
  const { parties, active } = useCurrentParties().data
  if (parties.length < 2 || !active || pathname === '/parties') return null
  return (
    <div className="party-bubble">
      <Link to="/parties" className="party-bubble__link">
        <span className="party-bubble__dot" aria-hidden="true" />
        <span className="party-bubble__label">Party active :</span>
        <strong className="party-bubble__name">{active.name}</strong>
        <span className="visually-hidden">, changer de party</span>
      </Link>
    </div>
  )
}

/** Cadre des écrans connectés : contenu + barre d'onglets en bas (Admin si super admin). */
export function AppShell() {
  const isAdmin = useIsSuperAdmin().data
  const tabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS
  return (
    <div className="shell">
      <main className="shell__main" id="contenu">
        <ActivePartyBubble />
        <InstallBanner />
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Navigation principale">
        <ul className="tabbar__list" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink to={tab.to} end={tab.end} className="tabbar__link">
                {tab.icon}
                <span className="tabbar__label">{tab.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
