import { LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

export function TopBar() {
  const { name, email, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-14 flex-shrink-0 bg-gray-900 border-b border-gray-800
                        flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <User size={14} />
          <span>{name ?? email}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-gray-500
                     hover:text-white transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </header>
  )
}
