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

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (const line of lines) {
    // Bold: **text**
    const parts = line.split(/\*\*(.+?)\*\*/g)
    const rendered = parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    )
    elements.push(<span key={key++}>{rendered}</span>)
    elements.push(<br key={key++} />)
  }
  // Remove trailing <br>
  elements.pop()
  return elements
}

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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#020617' }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.06)', background: '#020617' }}>
        {/* Logo */}
        <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>P</span>
          </div>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>PitchGPT</span>
        </div>

        {/* New chat */}
        <div style={{ padding: '0 12px 8px' }}>
          <button
            onClick={createNewSession}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <PlusIcon />
            <span>New chat</span>
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '0 12px 12px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }}>
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search messages…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, color: '#cbd5e1', fontSize: 12, padding: '6px 10px 6px 28px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Session list / search results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {searchQuery ? (
            filteredResults.length > 0 ? (
              filteredResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrentSessionId(r.sessionId); setSearchQuery('') }}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: 2 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontSize: 10, color: '#475569', marginBottom: 2 }}>{r.sessionName}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.content}</div>
                </button>
              ))
            ) : (
              <p style={{ fontSize: 12, color: '#334155', padding: '8px 12px', fontStyle: 'italic' }}>No results</p>
            )
          ) : (
            sessions.map((session) => {
              const isActive = session.id === currentSessionId
              return (
                <div
                  key={session.id}
                  onClick={() => setCurrentSessionId(session.id)}
                  className="group"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    marginBottom: 2,
                    background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: isActive ? '#fff' : '#64748b',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
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
                      style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid #475569', color: '#fff', fontSize: 13, outline: 'none', minWidth: 0 }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
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
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#475569', padding: 2, borderRadius: 4, display: 'flex', flexShrink: 0, opacity: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.opacity = '0' }}
                    title="Delete chat"
                  >
                    <TrashIcon />
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Export */}
        <div style={{ padding: '12px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => { const s = sessions.find((s) => s.id === currentSessionId); if (s) exportSession(s) }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 13 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#94a3b8' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569' }}
          >
            <DownloadIcon />
            <span>Export chat</span>
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', minWidth: 0 }}>
        {/* Header */}
        <header style={{ padding: '12px 24px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', margin: 0 }}>
            {currentSession?.name || 'New Chat'}
          </p>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>Your AI startup pitch coach</p>
        </header>

        <Toaster
          position="top-center"
          toastOptions={{ style: { fontSize: '13px', borderRadius: '10px' } }}
        />

        {/* Messages */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {!currentSession?.messages.length && !loading ? (
            /* Empty state */
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 8px 24px rgba(79,70,229,0.3)' }}>
                <span style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>P</span>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', margin: '0 0 8px' }}>How can I help you pitch?</h2>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 32px', maxWidth: 280, lineHeight: 1.6 }}>
                I&apos;m your AI startup coach. Ask me to review your application, refine your pitch, or sharpen your story.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 360 }}>
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, color: '#475569', cursor: 'pointer', lineHeight: 1.4 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#a5b4fc'; e.currentTarget.style.background = '#eef2ff'; e.currentTarget.style.color = '#4338ca' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#475569' }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px', maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {currentSession?.messages.map((msg, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', gap: 12, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: 11, fontWeight: 700, marginTop: 2,
                    background: msg.role === 'user' ? '#e0e7ff' : '#0f172a',
                    color: msg.role === 'user' ? '#4338ca' : '#fff',
                  }}>
                    {msg.role === 'user' ? 'Y' : 'P'}
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      display: 'inline-block',
                      padding: '10px 14px',
                      borderRadius: msg.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                      fontSize: 14,
                      lineHeight: 1.6,
                      maxWidth: '85%',
                      background: msg.role === 'user' ? '#4f46e5' : '#f1f5f9',
                      color: msg.role === 'user' ? '#fff' : '#1e293b',
                    }}>
                      {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                    </div>
                    {msg.timestamp && (
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, paddingLeft: 4, paddingRight: 4 }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                    P
                  </div>
                  <div style={{ padding: '12px 16px', background: '#f1f5f9', borderRadius: '4px 18px 18px 18px', display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span className="dot-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="dot-bounce" style={{ animationDelay: '200ms' }} />
                    <span className="dot-bounce" style={{ animationDelay: '400ms' }} />
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </main>

        {/* Input */}
        <footer style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', borderRadius: 24, border: '1px solid #e2e8f0', padding: '10px 12px 10px 18px' }}
              onFocus={() => {}}
            >
              <input
                style={{ flex: 1, background: 'transparent', border: 'none', color: '#0f172a', fontSize: 14, outline: 'none' }}
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
                style={{
                  width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: loading || !input.trim() ? '#c7d2fe' : '#4f46e5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'background 0.15s',
                  color: '#fff',
                }}
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </div>
            <p style={{ fontSize: 10, color: '#cbd5e1', textAlign: 'center', marginTop: 8 }}>
              PitchGPT can make mistakes. Verify important details independently.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
