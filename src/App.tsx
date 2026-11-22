import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { RequireAuth, RequireSuperAdmin, RequireProfile } from './components/guards'
import { UpdateToast } from './components/UpdateToast'
import {
  AdminPage,
  CandidatePage,
  CandidatesPage,
  HomePage,
  JoinPage,
  LoginPage,
  NotFoundPage,
  PartiesPage,
  PartyAdminPage,
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
        <Route path="/rejoindre/:code?" element={<RequireAuth><RequireProfile><JoinPage /></RequireProfile></RequireAuth>} />
        <Route element={<RequireAuth><RequireProfile><AppShell /></RequireProfile></RequireAuth>}>
          <Route index element={<HomePage />} />
          <Route path="candidates" element={<CandidatesPage />} />
          <Route path="candidates/:id" element={<CandidatePage />} />
          <Route path="parties" element={<PartiesPage />} />
          <Route path="soiree" element={<PartyPage />} />
          <Route path="soiree/gestion" element={<PartyAdminPage />} />
          <Route path="profil" element={<ProfilePage />} />
          <Route path="admin" element={<RequireSuperAdmin><AdminPage /></RequireSuperAdmin>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <UpdateToast />
    </BrowserRouter>
  )
}
