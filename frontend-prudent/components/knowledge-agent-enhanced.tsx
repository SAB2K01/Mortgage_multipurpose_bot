"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { ArrowUp, Sparkles } from "lucide-react"
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion"
import { askKnowledgeAgent, type BackendSource } from "@/lib/api"
import ChatThreads from "./chat-threads"
import SourcesPanel from "./sources-panel"
import AgentControls from "./agent-controls"
import MessageBubble from "./message-bubble"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
  followUpSuggestions?: string[]
  timestamp: Date
}

interface Citation {
  id: string
  title: string
  source: string
  section?: string
  accessLevel?: "public" | "internal"
  snippet: string
  fullText: string
}
function mapBackendSourcesToCitations(sources: BackendSource[]): Citation[] {
  return sources.map((s) => ({
    id: s.id,
    title: s.title,
    source: s.source,
    section: s.section ?? undefined,
    accessLevel: s.access_level ?? "internal",
    snippet: s.snippet ?? "",
    fullText: s.full_text ?? "",
  }))
}


interface ChatThread {
  id: string
  title: string
  timestamp: Date
  preview: string
  messages: Message[]
}

interface User {
  id: number
  email: string
  name: string
  role: "admin" | "employee"
  avatar: string
}

const KNOWLEDGE_BASE = [
  {
    id: 1,
    title: "Company Underwriting Rules Engine",
    source: "engineering/underwriting-system",
    section: "Architecture",
    content:
      "The underwriting rules engine is implemented using a decision tree model with 150+ rules for evaluating borrower creditworthiness...",
    snippet: "Decision tree model with 150+ rules for creditworthiness evaluation",
    accessLevel: "internal" as const,
  },
  {
    id: 2,
    title: "Data Model for Borrower Employment",
    source: "design-docs/data-model",
    section: "Employment Schema",
    content: "Employment data is structured with historical tracking, salary history, and employment gaps...",
    snippet: "Employment data with historical tracking and salary information",
    accessLevel: "internal" as const,
  },
  {
    id: 3,
    title: "Documentation Service SLAs",
    source: "engineering/docs-service",
    section: "SLA & Failure Modes",
    content: "Target SLA: 99.9% uptime. Failure modes include network timeouts, parsing errors...",
    snippet: "99.9% uptime SLA with documented failure modes",
    accessLevel: "internal" as const,
  },
  {
    id: 4,
    title: "API Documentation",
    source: "docs/api",
    section: "REST Endpoints",
    content: "Public API endpoints for third-party integrations. Base URL: api.company.com/v1...",
    snippet: "REST API with authentication and JSON/XML support",
    accessLevel: "public" as const,
  },
  {
    id: 5,
    title: "Project Guidelines",
    source: "docs/guidelines",
    section: "Best Practices",
    content: "Follow coding standards, use meaningful variable names, write unit tests...",
    snippet: "Development standards and best practices",
    accessLevel: "public" as const,
  },
]

export default function KnowledgeAgentEnhanced({ user }: { user: User }) {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Welcome to the Internal Knowledge Agent. I can help you find answers to your questions about internal policies, technical architecture, and documentation. What would you like to know?",
      followUpSuggestions: [
        user.role === "admin" ? "Tell me about underwriting rules" : "What are the API docs?",
        "Show me the SLA documentation",
        "Compare employment data sources",
      ],
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [activeAgent, setActiveAgent] = useState("knowledge")
  const [scope, setScope] = useState<"internal" | "web" | "hybrid">("hybrid")
  const [strictCitations, setStrictCitations] = useState(false)
  const [currentSources, setCurrentSources] = useState<Citation[]>([])
  const [isFocused, setIsFocused] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 3D effect for input
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useTransform(mouseY, [-100, 100], [2, -2])
  const rotateY = useTransform(mouseX, [-100, 100], [-2, 2])

  const handleInputMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseX.set(e.clientX - rect.left - rect.width / 2)
    mouseY.set(e.clientY - rect.top - rect.height / 2)
  }

  const handleInputMouseLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const filterAccessibleDocs = (docs: typeof KNOWLEDGE_BASE) => {
    const filtered = user.role === "admin" ? docs : docs.filter((doc) => doc.accessLevel === "public")

    if (scope === "internal") {
      return filtered.filter((doc) => doc.accessLevel === "internal")
    } else if (scope === "web") {
      return filtered.filter((doc) => doc.accessLevel === "public")
    }
    return filtered
  }

  const performRAG = (query: string) => {
    const queryLower = query.toLowerCase()
    const accessibleDocs = filterAccessibleDocs(KNOWLEDGE_BASE)

    const relevantDocs = accessibleDocs
      .filter(
        (doc) =>
          doc.title.toLowerCase().includes(queryLower) ||
          doc.content.toLowerCase().includes(queryLower) ||
          doc.snippet.toLowerCase().includes(queryLower),
      )
      .slice(0, 3)

    return relevantDocs
  }

  const generateResponse = (
    query: string,
    citations: (typeof KNOWLEDGE_BASE)[0][],
  ): { text: string; citations: Citation[]; suggestions: string[] } => {
    const citationsList: Citation[] = citations.map((doc) => ({
      id: doc.id.toString(),
      title: doc.title,
      source: doc.source,
      section: doc.section,
      accessLevel: doc.accessLevel,
      snippet: doc.snippet,
      fullText: doc.content,
    }))

    let text = ""
    let suggestions: string[] = []

    if (citations.length === 0 && strictCitations) {
      text =
        "I don't have access to documents that match your query with the current filters. Please try rephrasing or adjusting your scope settings."
      suggestions = ["Change scope to hybrid", "Ask a different question", "Show all available topics"]
    } else if (citations.length === 0) {
      text =
        "I don't have access to documents matching your query. Please try rephrasing your question or contact your administrator."
      suggestions = ["Show available topics", "Ask about access policies"]
    } else if (query.toLowerCase().includes("compare") || query.toLowerCase().includes("difference")) {
      text = `Comparing ${citations[0]?.title} with other sources. ${citations.map((c) => c.snippet).join(" vs. ")}`
      suggestions = ["Show comparison details", "Which is more current?", "Are there other sources?"]
    } else {
      text =
        citations[0]?.snippet ||
        `Based on the available documentation, I found ${citations.length} relevant document(s).`
      suggestions = ["Show sources", "Open the cited section", `More about ${citations[0]?.title.split(" ")[0]}`]
    }

    return { text, citations: citationsList, suggestions }
  }

 const handleSendMessage = async (e: React.FormEvent | string) => {
  if (typeof e !== "string") {
    e.preventDefault()
  }
  const messageText = typeof e === "string" ? e : input.trim()
  if (!messageText || isLoading) return

  // Special commands handled on frontend without layout changes
  const lower = messageText.toLowerCase().trim()
  if (lower === "show sources" && currentSources.length > 0) {
    // Just add a small assistant note; SourcesPanel already shows the sources
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "Here are the sources for the previous answer.",
      citations: currentSources,
      timestamp: new Date(),
    }
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        content: messageText,
        timestamp: new Date(),
      },
      assistantMessage,
    ])
    setInput("")
    return
  }

  const userMessage: Message = {
    id: Date.now().toString(),
    role: "user",
    content: messageText,
    timestamp: new Date(),
  }

  setMessages((prev) => [...prev, userMessage])
  setInput("")
  setIsLoading(true)

  try {
    // Build minimal history for backend (no layout change)
    const historyForBackend = [...messages, userMessage].slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const data = await askKnowledgeAgent({
      question: messageText,
      scope,
      agent: activeAgent,
      strictCitations,
      history: historyForBackend,
    })

    const citations = mapBackendSourcesToCitations(data.sources || [])

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: data.answer,
      citations,
      followUpSuggestions: data.follow_up_questions ?? [],
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, assistantMessage])
    setCurrentSources(citations)
  } catch (error) {
    console.error("knowledge agent error", error)
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content:
        "Sorry, I couldn't reach the knowledge backend. Please try again in a moment.",
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, assistantMessage])
    setCurrentSources([])
  } finally {
    setIsLoading(false)
  }
}

  const handleNewThread = () => {
    const newThreadId = Date.now().toString()
    const newThread: ChatThread = {
      id: newThreadId,
      title: "New Conversation",
      timestamp: new Date(),
      preview: "Start typing to begin...",
      messages: [messages[0]],
    }
    setThreads((prev) => [newThread, ...prev])
    setActiveThreadId(newThreadId)
    setMessages([messages[0]])
    setCurrentSources([])
  }

  return (
    <div className="flex h-full relative overflow-hidden">
      <ChatThreads
        threads={threads}
        activeThread={activeThreadId}
        onSelectThread={(id) => {
          const thread = threads.find((t) => t.id === id)
          if (thread) {
            setActiveThreadId(id)
            setMessages(thread.messages)
            setCurrentSources(thread.messages[thread.messages.length - 1]?.citations || [])
          }
        }}
        onNewThread={handleNewThread}
        onDeleteThread={(id) => {
          setThreads((prev) => prev.filter((t) => t.id !== id))
          if (activeThreadId === id) {
            setActiveThreadId(null)
            setMessages([messages[0]])
          }
        }}
      />

      <div className="flex-1 flex flex-col h-full relative">
        {/* Agent Controls */}
        <AgentControls
          activeAgent={activeAgent}
          onAgentChange={(next) => {
            setActiveAgent(next)

            // UX: selecting Industry Current Affairs forces web-only, non-strict mode.
            if (next === "industry") {
              setScope("web")
              setStrictCitations(false)
            }
          }}
          scope={scope}
          onScopeChange={(s) => {
            // Industry agent is web-only; ignore other scopes
            if (activeAgent === "industry" && s !== "web") return
            setScope(s)
          }}
          strictCitations={strictCitations}
          onStrictCitationsChange={(v) => {
            // Industry agent hides strict citations
            if (activeAgent === "industry") return
            setStrictCitations(v)
          }}
        />

        {/* Messages Area */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
        >
          <AnimatePresence mode="popLayout">
            {messages.map((message, idx) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25, delay: idx * 0.03 }}
              >
                <MessageBubble
                  role={message.role}
                  content={message.content}
                  followUpSuggestions={message.followUpSuggestions}
                  onSuggestionClick={handleSendMessage}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading State */}
          {isLoading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
              <div className="flex items-start gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center"
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </motion.div>
                <motion.div className="bg-black/40 backdrop-blur-xl border border-white/[0.08] rounded-2xl rounded-tl-md p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          animate={{
                            y: [0, -8, 0],
                            opacity: [0.3, 1, 0.3],
                          }}
                          transition={{
                            duration: 1,
                            repeat: Number.POSITIVE_INFINITY,
                            delay: i * 0.15,
                          }}
                          className="w-2 h-2 rounded-full bg-purple-400"
                        />
                      ))}
                    </div>
                    <p className="text-sm text-white/50">Searching knowledge base...</p>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </motion.div>

        {/* Input Area with 3D effect */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-white/[0.05] bg-black/40 p-4 md:p-6 backdrop-blur-xl relative"
        >
          {/* Subtle pattern */}
          <div
            className="absolute inset-0 opacity-[0.01]"
            style={{
              backgroundImage: `linear-gradient(135deg, white 0.5px, transparent 0.5px)`,
              backgroundSize: "20px 20px",
            }}
          />

          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto space-y-3 relative">
            <motion.div
              onMouseMove={handleInputMouseMove}
              onMouseLeave={handleInputMouseLeave}
              style={{ perspective: 1000 }}
              className="relative"
            >
              <motion.div style={{ rotateX, rotateY }} className="relative group">
                {/* Traveling light border */}
                <div className="absolute -inset-[0.5px] rounded-xl overflow-hidden">
                  <motion.div
                    className="absolute top-0 left-0 h-[2px] w-[40%] bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-60"
                    animate={{ left: ["-40%", "100%"] }}
                    transition={{ duration: 2.5, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY, repeatDelay: 1 }}
                  />
                  <motion.div
                    className="absolute top-0 right-0 h-[40%] w-[2px] bg-gradient-to-b from-transparent via-purple-400 to-transparent opacity-60"
                    animate={{ top: ["-40%", "100%"] }}
                    transition={{
                      duration: 2.5,
                      ease: "easeInOut",
                      repeat: Number.POSITIVE_INFINITY,
                      repeatDelay: 1,
                      delay: 0.6,
                    }}
                  />
                  <motion.div
                    className="absolute bottom-0 right-0 h-[2px] w-[40%] bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-60"
                    animate={{ right: ["-40%", "100%"] }}
                    transition={{
                      duration: 2.5,
                      ease: "easeInOut",
                      repeat: Number.POSITIVE_INFINITY,
                      repeatDelay: 1,
                      delay: 1.2,
                    }}
                  />
                  <motion.div
                    className="absolute bottom-0 left-0 h-[40%] w-[2px] bg-gradient-to-b from-transparent via-purple-400 to-transparent opacity-60"
                    animate={{ bottom: ["-40%", "100%"] }}
                    transition={{
                      duration: 2.5,
                      ease: "easeInOut",
                      repeat: Number.POSITIVE_INFINITY,
                      repeatDelay: 1,
                      delay: 1.8,
                    }}
                  />

                  {/* Corner glows */}
                  {["top-0 left-0", "top-0 right-0", "bottom-0 right-0", "bottom-0 left-0"].map((pos, i) => (
                    <motion.div
                      key={pos}
                      className={`absolute ${pos} h-[4px] w-[4px] rounded-full bg-white/40 blur-[1px]`}
                      animate={{ opacity: [0.2, 0.5, 0.2] }}
                      transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, delay: i * 0.3 }}
                    />
                  ))}
                </div>

                <div className="relative flex gap-3 p-1 rounded-xl bg-black/40 border border-white/10 backdrop-blur-xl">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Ask about documentation, sources, comparisons..."
                    className="flex-1 h-12 px-4 bg-transparent text-white placeholder:text-white/30 focus:outline-none text-sm"
                    disabled={isLoading}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="h-12 px-5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 text-white disabled:opacity-30 transition-all flex items-center gap-2 font-medium border border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/20"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </motion.button>
                </div>

                {/* Focus highlight */}
                {isFocused && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute -inset-[1px] rounded-xl bg-purple-500/10 -z-10"
                  />
                )}
              </motion.div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-white/30 flex items-center gap-2"
            >
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                className="w-1.5 h-1.5 rounded-full bg-green-500"
              />
              {user.role === "admin" ? "Full access to internal documentation" : "Access to public documentation only"}
            </motion.p>
          </form>
        </motion.div>
      </div>

      <SourcesPanel sources={currentSources} />
    </div>
  )
}
