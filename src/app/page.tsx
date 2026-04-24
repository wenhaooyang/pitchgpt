'use client'

import { useState, useEffect, useRef } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

// ── Icons ─────────────────────────────────────────────────────────────────────

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M7 1v12M1 7h12" />
  </svg>
)

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 3h12M5 3V2h4v1M2.5 3l1 9h7l1-9" />
  </svg>
)

const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l4 2.5M12 2l-5.5 9.5L6.5 9 12 2Z" />
  </svg>
)

const SearchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="6" cy="6" r="4" />
    <path d="M12 12l-2.5-2.5" />
  </svg>
)

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 1v8M4 6l3 3 3-3M2 11h10" />
  </svg>
)

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

interface ChatSession {
  id: string
  name: string
  messages: Message[]
}

// ── Starter prompts ───────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  'Review my YC application draft',
  'What makes a strong problem statement?',
  'How do I explain my traction metrics?',
  'Help me sharpen my elevator pitch',
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Page() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
  const [renameInput, setRenameInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const currentSession = sessions.find((s) => s.id === currentSessionId)

  // ── Persistence ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const stored = localStorage.getItem('pitchgpt_sessions')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed)
          setCurrentSessionId(parsed[0].id)
        }
      } catch (e) {
        console.error('Failed to load sessions:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (sessions.length === 0) {
      const id = uuidv4()
      setSessions([{ id, name: 'New Chat', messages: [] }])
      setCurrentSessionId(id)
    }
  }, [sessions])

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('pitchgpt_sessions', JSON.stringify(sessions))
    }
  }, [sessions])

  // ── Scroll to bottom ─────────────────────────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentSession?.messages.length, loading])

  // ── Session helpers ──────────────────────────────────────────────────────────

  const updateCurrentSessionMessages = (newMessages: Message[]) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === currentSessionId ? { ...s, messages: newMessages } : s))
    )
  }

  const createNewSession = () => {
    const id = uuidv4()
    setSessions((prev) => [{ id, name: 'New Chat', messages: [] }, ...prev])
    setCurrentSessionId(id)
  }

  const deleteSession = (id: string) => {
    const updated = sessions.filter((s) => s.id !== id)
    setSessions(updated)
    if (id === currentSessionId) {
      if (updated.length > 0) {
        setCurrentSessionId(updated[0].id)
      } else {
        const newId = uuidv4()
        setSessions([{ id: newId, name: 'New Chat', messages: [] }])
        setCurrentSessionId(newId)
      }
    }
    toast.success('Chat deleted')
  }

  const exportSession = (session: ChatSession) => {
    const content = session.messages
      .map((m) => `${m.role === 'user' ? 'You' : 'PitchGPT'}:\n${m.content.trim()}`)
      .join('\n\n---\n\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${session.name || 'pitchgpt-chat'}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!input.trim() || !currentSessionId || loading) return

    const trimmed = input.trim()
    const userMsg: Message = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }
    const newMessages = [...(currentSession?.messages || []), userMsg]

    setInput('')
    setLoading(true)
    updateCurrentSessionMessages(newMessages)

    if (currentSession?.name === 'New Chat' && newMessages.length === 1) {
      const preview = trimmed.slice(0, 32)
      setSessions((prev) =>
        prev.map((s) => (s.id === currentSessionId ? { ...s, name: preview } : s))
      )
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      const data = await res.json()
      const reply: Message = {
        role: 'assistant',
        content: data.reply ?? 'Sorry, no reply was generated.',
        timestamp: new Date().toISOString(),
      }
      updateCurrentSessionMessages([...newMessages, reply])
    } catch (err) {
      console.error(err)
      toast.error('Failed to get a reply. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Search ───────────────────────────────────────────────────────────────────

  const filteredResults = searchQuery.trim()
    ? sessions.flatMap((session) =>
        session.messages
          .filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((m) => ({ sessionId: session.id, sessionName: session.name, content: m.content }))
      )
    : []

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r border-white/5">
        {/* Logo */}
        <div className="px-4 py-4 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-white text-xs font-bold">P</span>
          </div>
          <span className="text-white font-semibold tracking-tight text-sm">PitchGPT</span>
        </div>

        {/* New chat */}
        <div className="px-3 mb-2">
          <button
            onClick={createNewSession}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors text-sm"
          >
            <PlusIcon />
            <span>New chat</span>
          </button>
        </div>

        {/* Search */}
        <div className="px-3 mb-3">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search messages…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 text-slate-300 placeholder-slate-600 text-xs rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition"
            />
          </div>
        </div>

        {/* Session list / search results */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {searchQuery ? (
            filteredResults.length > 0 ? (
              filteredResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrentSessionId(r.sessionId); setSearchQuery('') }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="text-[10px] text-slate-500 mb-0.5">{r.sessionName}</div>
                  <div className="text-xs text-slate-300 truncate">{r.content}</div>
                </button>
              ))
            ) : (
              <p className="text-xs text-slate-600 px-3 py-2 italic">No results</p>
            )
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setCurrentSessionId(session.id)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  session.id === currentSessionId
                    ? 'bg-white/10 text-white'
                    : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                }`}
              >
                {renamingSessionId === session.id ? (
                  <input
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    onBlur={() => {
                      setSessions((prev) =>
                        prev.map((s) =>
                          s.id === session.id ? { ...s, name: renameInput.trim() || s.name } : s
                        )
                      )
                      setRenamingSessionId(null)
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    className="flex-1 bg-transparent text-sm text-white focus:outline-none border-b border-slate-500 min-w-0"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="flex-1 truncate text-sm min-w-0"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setRenamingSessionId(session.id)
                      setRenameInput(session.name)
                    }}
                  >
                    {session.name}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(session.id) }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-600 hover:text-red-400 transition-all flex-shrink-0"
                  title="Delete chat"
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Export */}
        <div className="px-3 py-3 border-t border-white/5">
          <button
            onClick={() => { const s = sessions.find((s) => s.id === currentSessionId); if (s) exportSession(s) }}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-600 hover:bg-white/5 hover:text-slate-400 transition-colors text-sm"
          >
            <DownloadIcon />
            <span>Export chat</span>
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {/* Header */}
        <header className="px-6 py-3 border-b border-slate-100 flex-shrink-0">
          <p className="font-semibold text-slate-900 text-sm leading-tight">
            {currentSession?.name || 'New Chat'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Your AI startup pitch coach</p>
        </header>

        <Toaster
          position="top-center"
          toastOptions={{
            style: { fontSize: '13px', borderRadius: '10px' },
          }}
        />

        {/* Messages */}
        <main className="flex-1 overflow-y-auto">
          {!currentSession?.messages.length && !loading ? (
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center px-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-5 shadow-lg shadow-indigo-200">
                <span className="text-white text-xl font-bold">P</span>
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-1.5">How can I help you pitch?</h2>
              <p className="text-sm text-slate-400 mb-8 max-w-xs leading-relaxed">
                I&apos;m your AI startup coach. Ask me to review your application, refine your pitch, or sharpen your story.
              </p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="text-left px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors leading-snug"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-6 py-6 space-y-5 max-w-2xl mx-auto">
              {currentSession?.messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5 ${
                      msg.role === 'user'
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-slate-900 text-white'
                    }`}
                  >
                    {msg.role === 'user' ? 'Y' : 'P'}
                  </div>

                  <div className={`flex-1 ${msg.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                    <div
                      className={`inline-block px-4 py-2.5 rounded-2xl text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-sm'
                          : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                    {msg.timestamp && (
                      <div className="text-[10px] text-slate-400 mt-1 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white mt-0.5">
                    P
                  </div>
                  <div className="px-4 py-3 bg-slate-100 rounded-2xl rounded-tl-sm">
                    <div className="flex gap-1 items-center">
                      <span
                        className="w-1.5 h-1.5 bg-slate-400 rounded-full inline-block"
                        style={{ animation: 'bounce 1.2s infinite 0ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-slate-400 rounded-full inline-block"
                        style={{ animation: 'bounce 1.2s infinite 200ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-slate-400 rounded-full inline-block"
                        style={{ animation: 'bounce 1.2s infinite 400ms' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </main>

        {/* Input */}
        <footer className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 bg-slate-50 rounded-2xl border border-slate-200 px-4 py-2.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <input
                className="flex-1 bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Ask about your pitch, application, or startup story…"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              PitchGPT can make mistakes. Verify important details independently.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
