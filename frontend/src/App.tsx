import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard }  from '@/pages/Dashboard'
import { Agents }     from '@/pages/Agents'
import { Workflows }  from '@/pages/Workflows'
import { Sessions }   from '@/pages/Sessions'
import { Templates }  from '@/pages/Templates'
import { Runs }       from '@/pages/Runs'
import { Profile }    from '@/pages/Profile'
import { Login }      from '@/pages/Login'
import { Register }   from '@/pages/Register'
import { useAuthStore } from '@/store/auth'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/" element={
          <RequireAuth><AppLayout /></RequireAuth>
        }>
          <Route index              element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"   element={<Dashboard />} />
          <Route path="agents/*"    element={<Agents />} />
          <Route path="workflows/*" element={<Workflows />} />
          <Route path="sessions/*"  element={<Sessions />} />
          <Route path="templates/*" element={<Templates />} />
          <Route path="runs/*"      element={<Runs />} />
          <Route path="profile"     element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
