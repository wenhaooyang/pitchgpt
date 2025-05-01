<<<<<<< HEAD
'use client'

import { useState, useEffect, useRef } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

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

export default function Page() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [dots, setDots] = useState('')
  const [displayedAssistantMessage, setDisplayedAssistantMessage] = useState('')
  const [fullReply, setFullReply] = useState('')
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
  const [renameInput, setRenameInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const currentSession = sessions.find((s) => s.id === currentSessionId)

  const updateCurrentSessionMessages = (newMessages: Message[]) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSessionId ? { ...s, messages: newMessages } : s
      )
    )
  }

  const deleteSession = (id: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this chat?")
    if (!confirmed) return

    const updated = sessions.filter((s) => s.id !== id)
    setSessions(updated)

    if (id === currentSessionId) {
      if (updated.length > 0) {
        setCurrentSessionId(updated[0].id)
      } else {
        const newId = uuidv4()
        const freshSession = { id: newId, name: 'Untitled Chat', messages: [] }
        setSessions([freshSession])
        setCurrentSessionId(newId)
      }
    }

    toast.success('Chat deleted')
  }

  const exportSession = (session: ChatSession) => {
    const content = session.messages
      .map((msg) => {
        const label = msg.role === 'user' ? 'You' : 'PitchGPT'
        return `${label}:
${msg.content.trim()}`
      })
      .join('\n---\n\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${session.name || 'pitchgpt-chat'}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const sendMessage = async () => {
    if (!input.trim() || !currentSessionId) return

    const targetSession = sessions.find((s) => s.id === currentSessionId)
    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    }
    const newMessages = [...(targetSession?.messages || []), userMessage]

    setInput('')
    setLoading(true)
    setDisplayedAssistantMessage('')
    setDots('')

    updateCurrentSessionMessages(newMessages)

    if (targetSession && targetSession.name === 'Untitled Chat' && newMessages.length === 1) {
      const preview = input.trim().slice(0, 30)
      const newName = preview || 'New Chat'
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId ? { ...s, name: newName } : s
        )
      )
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      })
      const data = await res.json()
      const reply: Message = {
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString()
      }
      setFullReply(reply.content)
      updateCurrentSessionMessages([...newMessages, reply])
      setDisplayedAssistantMessage('')
      setLoading(false)
    } catch (err) {
      toast.error('Failed to fetch reply')
      setLoading(false)
    }
  }

  const filteredResults = searchQuery.trim()
    ? sessions.flatMap((session) =>
        session.messages
          .filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((m) => ({ sessionId: session.id, sessionName: session.name, content: m.content }))
      )
    : []

  useEffect(() => {
    if (loading && fullReply && displayedAssistantMessage.length < fullReply.length) {
      const nextChar = fullReply.charAt(displayedAssistantMessage.length)
      let delay = 30
      if (nextChar === ',' || nextChar === ';') delay = 120
      if (nextChar === '.' || nextChar === '!' || nextChar === '?') delay = 300

      const timeout = setTimeout(() => {
        setDisplayedAssistantMessage((prev) => prev + nextChar)
      }, delay)
      return () => clearTimeout(timeout)
    }
  }, [displayedAssistantMessage, loading, fullReply])

  useEffect(() => {
    if (loading && !fullReply) {
      const interval = setInterval(() => {
        setDots((prev) => (prev.length >= 3 ? '' : prev + '.'))
      }, 500)
      return () => clearInterval(interval)
    }
  }, [loading, fullReply])

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
        console.error('Error loading sessions:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (sessions.length === 0) {
      const id = uuidv4()
      const defaultSession: ChatSession = { id, name: 'Untitled Chat', messages: [] }
      setSessions([defaultSession])
      setCurrentSessionId(id)
    }
  }, [sessions])

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('pitchgpt_sessions', JSON.stringify(sessions))
    }
  }, [sessions])

  const createNewSession = () => {
    const confirmed = window.confirm('Start a new chat session?')
    if (!confirmed) return

    const id = uuidv4()
    const newSession: ChatSession = { id, name: 'Untitled Chat', messages: [] }
    setSessions([newSession, ...sessions])
    setCurrentSessionId(id)
    toast.success('New chat started!')
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-72 bg-white dark:bg-gray-900 border-r p-4 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-black dark:text-white">Your Chats</h2>

        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-2 py-1 border rounded text-sm bg-white dark:bg-gray-800 text-black dark:text-white"
        />

        {searchQuery && (
          <div className="flex-1 overflow-y-auto text-sm">
            {filteredResults.length > 0 ? (
              filteredResults.map((result, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setCurrentSessionId(result.sessionId)
                    setSearchQuery('')
                  }}
                  className="p-2 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <div className="font-semibold text-xs text-gray-500 dark:text-gray-300">{result.sessionName}</div>
                  <div className="truncate text-gray-800 dark:text-white">{result.content}</div>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-xs italic mt-2">No matches found</div>
            )}
          </div>
        )}

        {!searchQuery && (
          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`flex justify-between items-center px-3 py-1 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  session.id === currentSessionId
                    ? 'bg-blue-100 dark:bg-blue-700 text-black dark:text-white font-semibold'
                    : 'text-gray-800 dark:text-gray-200'
                }`}
                onClick={() => setCurrentSessionId(session.id)}
              >
                {renamingSessionId === session.id ? (
                  <input
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    onBlur={() => {
                      setSessions(prev =>
                        prev.map(s => s.id === session.id ? { ...s, name: renameInput.trim() || s.name } : s)
                      )
                      setRenamingSessionId(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                    className="text-sm bg-transparent border-b border-gray-400 focus:outline-none text-black dark:text-white"
                    autoFocus
                  />
                ) : (
                  <span
                    className="truncate max-w-[160px]"
                    onDoubleClick={() => {
                      setRenamingSessionId(session.id)
                      setRenameInput(session.name)
                    }}
                    title="Double-click to rename"
                  >
                    {session.name}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSession(session.id)
                  }}
                  className="ml-2 text-red-500 hover:text-red-600 dark:hover:text-red-400 text-xs"
                  title="Delete chat"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}

        <button onClick={createNewSession} className="text-blue-500 text-sm hover:underline">
          ➕ New Chat
        </button>
        <button
          onClick={() => {
            const session = sessions.find((s) => s.id === currentSessionId)
            if (session) exportSession(session)
          }}
          className="text-green-600 text-sm hover:underline"
        >
          ⬇️ Export Chat
        </button>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-background text-textPrimary">
        <header className="p-4 border-b border-gray-300">
          <h1 className="text-2xl font-bold">PitchGPT</h1>
        </header>

        <Toaster position="top-center" />

        <main className="flex-1 overflow-y-auto px-4 py-6 w-full max-w-2xl mx-auto">
          {currentSession?.messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 my-2 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-yellow-300 text-black font-bold">
                  🤖
                </div>
              )}
              <div
                className={`p-3 rounded-lg max-w-[80%] whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-userBubble text-right'
                    : 'bg-aiBubble text-left'
                }`}
              >
                <div className="text-xs text-gray-400 mb-1">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-green-300 text-black font-bold">
                  🧑‍💻
                </div>
              )}
            </div>
          ))}

          {loading && displayedAssistantMessage && (
            <div className="flex items-start gap-2 my-2 justify-start">
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-yellow-300 text-black font-bold">
                🤖
              </div>
              <div className="p-3 rounded-lg max-w-[80%] bg-aiBubble text-left whitespace-pre-wrap">
                {displayedAssistantMessage}
              </div>
            </div>
          )}

          {loading && !fullReply && (
            <div className="flex items-start gap-2 my-2 justify-start">
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-yellow-300 text-black font-bold">
                🤖
              </div>
              <div className="p-3 rounded-lg max-w-[80%] bg-aiBubble italic text-sm text-gray-600">
                PitchGPT is typing{dots}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </main> 

        <footer className="w-full max-w-2xl mx-auto p-4 border-t border-gray-300 bg-background">
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 p-3 rounded-lg text-textPrimary"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button
              onClick={sendMessage}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              Send
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
=======
import Image from "next/image";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol className="list-inside list-decimal text-sm/6 text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
          <li className="mb-2 tracking-[-.01em]">
            Get started by editing{" "}
            <code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-[family-name:var(--font-geist-mono)] font-semibold">
              src/app/page.tsx
            </code>
            .
          </li>
          <li className="tracking-[-.01em]">
            Save and see your changes instantly.
          </li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read our docs
          </a>
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
>>>>>>> 8a2def252c6b666814bd8525edeed66766d8207c
}
