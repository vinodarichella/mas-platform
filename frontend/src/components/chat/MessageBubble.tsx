import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, User } from 'lucide-react'
import { clsx } from 'clsx'
import type { ChatMessage } from '@/api/sessions'
import type { Components } from 'react-markdown'

interface Props {
  message: ChatMessage
  streaming?: boolean
}

// Markdown component map — maps to Tailwind-styled HTML elements
const mdComponents: Components = {
  p:          ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  h1:         ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
  h2:         ({ children }) => <h2 className="text-sm font-bold mb-1.5 mt-3 first:mt-0">{children}</h2>,
  h3:         ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
  ul:         ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5 pl-1">{children}</ul>,
  ol:         ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5 pl-1">{children}</ol>,
  li:         ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-500 pl-3 my-2 text-gray-400 italic">{children}</blockquote>
  ),
  strong:     ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em:         ({ children }) => <em className="italic text-gray-300">{children}</em>,
  hr:         () => <hr className="border-gray-600 my-3" />,
  a:          ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
       className="text-blue-400 hover:underline">
      {children}
    </a>
  ),
  // Inline code and fenced code blocks
  code: ({ className, children }) => {
    const lang = /language-(\w+)/.exec(className ?? '')?.[1]
    if (lang) {
      return (
        <div className="my-2 rounded-lg overflow-hidden border border-gray-700">
          <div className="px-3 py-1 bg-gray-900 text-xs text-gray-500 border-b border-gray-700 font-mono">
            {lang}
          </div>
          <pre className="p-3 bg-gray-950 overflow-x-auto text-xs font-mono text-green-300 leading-relaxed whitespace-pre">
            <code>{children}</code>
          </pre>
        </div>
      )
    }
    return (
      <code className="px-1.5 py-0.5 bg-gray-700 rounded text-xs font-mono text-pink-300">
        {children}
      </code>
    )
  },
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-gray-700">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-900 text-gray-400">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-gray-700">{children}</tbody>,
  tr:    ({ children }) => <tr className="hover:bg-gray-800/40 transition-colors">{children}</tr>,
  th:    ({ children }) => <th className="px-3 py-2 text-left font-medium">{children}</th>,
  td:    ({ children }) => <td className="px-3 py-2 text-gray-300">{children}</td>,
}

export function MessageBubble({ message, streaming }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={clsx('flex gap-3 px-4 py-2', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={clsx(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1',
        isUser ? 'bg-blue-600' : 'bg-gray-700',
      )}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Bubble */}
      <div className={clsx(
        'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
        isUser
          ? 'bg-blue-600 text-white rounded-tr-sm'
          : 'bg-gray-800 text-gray-100 rounded-tl-sm',
      )}>
        {isUser ? (
          // User messages render as plain pre-wrap text
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          // Agent messages render with full markdown
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {message.content}
          </ReactMarkdown>
        )}
        {streaming && (
          <span className="inline-block ml-1 animate-pulse text-gray-400">▋</span>
        )}
      </div>
    </div>
  )
}
