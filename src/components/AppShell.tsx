import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useIsAdmin } from '../lib'
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

/** Cadre des écrans connectés : contenu + barre d'onglets en bas (Admin si admin). */
export function AppShell() {
  const isAdmin = useIsAdmin().data
  const tabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS
  return (
    <div className="shell">
      <main className="shell__main" id="contenu">
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
