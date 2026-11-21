import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { RequireAdmin, RequireAuth, RequireProfile } from './components/guards'
import {
  AdminPage,
  CandidatePage,
  CandidatesPage,
  HomePage,
  JoinPage,
  LoginPage,
  NotFoundPage,
  PartyPage,
  ProfilePage,
  WelcomePage,
} from './pages'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/bienvenue" element={<RequireAuth><WelcomePage /></RequireAuth>} />
        <Route path="/rejoindre" element={<RequireAuth><RequireProfile><JoinPage /></RequireProfile></RequireAuth>} />
        <Route element={<RequireAuth><RequireProfile><AppShell /></RequireProfile></RequireAuth>}>
          <Route index element={<HomePage />} />
          <Route path="candidates" element={<CandidatesPage />} />
          <Route path="candidates/:id" element={<CandidatePage />} />
          <Route path="soiree" element={<PartyPage />} />
          <Route path="profil" element={<ProfilePage />} />
          <Route path="admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
