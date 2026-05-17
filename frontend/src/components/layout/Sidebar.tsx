import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Bot,
  GitFork,
  MessageSquare,
  BookTemplate,
  Play,
  UserCircle,
} from 'lucide-react'
import { clsx } from 'clsx'

const nav = [
  { to: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/sessions',   label: 'Sessions',   icon: MessageSquare   },
  { to: '/agents',     label: 'Agents',     icon: Bot             },
  { to: '/workflows',  label: 'Workflows',  icon: GitFork         },
  { to: '/templates',  label: 'Templates',  icon: BookTemplate    },
  { to: '/runs',       label: 'Runs',       icon: Play            },
  { to: '/profile',    label: 'Profile',    icon: UserCircle      },
]

export function Sidebar() {
  return (
    <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-800">
        <span className="text-lg font-semibold text-white tracking-tight">
          MAS Platform
        </span>
        <p className="text-xs text-gray-500 mt-0.5">Multi-Agent System</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800',
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
