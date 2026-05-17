import { useQuery } from '@tanstack/react-query'
import { Bot, GitFork, Play, MessageSquare } from 'lucide-react'
import { api } from '@/api/client'

export function Dashboard() {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then(r => r.data),
    refetchInterval: 30_000,
  })

  const stats = [
    { label: 'Agents',    icon: Bot,           color: 'text-blue-400',   href: '/agents'    },
    { label: 'Workflows', icon: GitFork,        color: 'text-purple-400', href: '/workflows' },
    { label: 'Sessions',  icon: MessageSquare,  color: 'text-green-400',  href: '/sessions'  },
    { label: 'Runs',      icon: Play,           color: 'text-orange-400', href: '/runs'      },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Dashboard</h2>
        <p className="text-gray-400 text-sm mt-1">Welcome to MAS Platform</p>
      </div>

      {/* Quick-nav cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, icon: Icon, color, href }) => (
          <a
            key={label}
            href={href}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5
                       hover:border-gray-700 transition-colors group"
          >
            <Icon size={24} className={`${color} mb-3`} />
            <p className="text-sm font-medium text-white group-hover:text-blue-400
                          transition-colors">
              {label}
            </p>
          </a>
        ))}
      </div>

      {/* System health */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-4">System Health</h3>
        {health ? (
          <div className="flex flex-wrap gap-4">
            {Object.entries(health.services as Record<string, string>).map(([svc, status]) => (
              <div key={svc} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  status === 'ok' ? 'bg-green-400' : 'bg-red-400'
                }`} />
                <span className="text-sm text-gray-300 capitalize">{svc}</span>
                <span className={`text-xs ${
                  status === 'ok' ? 'text-green-400' : 'text-red-400'
                }`}>{status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Checking services…</p>
        )}
      </div>
    </div>
  )
}
