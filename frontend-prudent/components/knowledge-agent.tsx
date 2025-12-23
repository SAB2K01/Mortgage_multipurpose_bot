"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { SendIcon, LoaderIcon, X, FileText, Clock, Shield } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
  timestamp: Date
}

interface Citation {
  title: string
  source: string
  section?: string
  accessLevel?: "public" | "internal"
}

interface User {
  id: number
  email: string
  name: string
  role: "admin" | "employee"
  avatar: string
}

// Mock knowledge base with role-based access
const KNOWLEDGE_BASE = [
  {
    id: 1,
    title: "Company Underwriting Rules Engine",
    source: "engineering/underwriting-system",
    section: "Architecture",
    content: "The underwriting rules engine is implemented using a decision tree model with 150+ rules...",
    accessLevel: "internal" as const,
    summary: "System overview of the underwriting rules engine",
  },
  {
    id: 2,
    title: "Data Model for Borrower Employment",
    source: "design-docs/data-model",
    section: "Employment Schema",
    content: "Latest decision: Employment data is structured with historical tracking...",
    accessLevel: "internal" as const,
    summary: "Database schema for employment information",
  },
  {
    id: 3,
    title: "Documentation Service SLAs",
    source: "engineering/docs-service",
    section: "SLA & Failure Modes",
    content: "Target SLA: 99.9% uptime. Failure modes include network timeouts, parsing errors...",
    accessLevel: "internal" as const,
    summary: "Service level agreements and failure modes",
  },
  {
    id: 4,
    title: "API Documentation",
    source: "docs/api",
    section: "REST Endpoints",
    content: "Public API endpoints for third-party integrations. Base URL: api.company.com/v1...",
    accessLevel: "public" as const,
    summary: "Public API reference and authentication",
  },
  {
    id: 5,
    title: "Project Guidelines",
    source: "docs/guidelines",
    section: "Best Practices",
    content: "Follow coding standards, use meaningful variable names, write unit tests...",
    accessLevel: "public" as const,
    summary: "Development standards and best practices",
  },
  {
    id: 6,
    title: "Access Control Policies",
    source: "security/iam",
    section: "Role-Based Access",
    content: "Admin role has access to all systems. Employee role has access to public docs...",
    accessLevel: "internal" as const,
    summary: "Identity and access management policies",
  },
]

export default function KnowledgeAgent({ user }: { user: User }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Welcome to the Internal Knowledge Agent. I can help you find answers to your questions about internal policies, technical architecture, and documentation. What would you like to know?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const filterAccessibleDocs = (docs: typeof KNOWLEDGE_BASE) => {
    if (user.role === "admin") {
      return docs
    }
    // Employees only see public documents
    return docs.filter((doc) => doc.accessLevel === "public")
  }

  const performRAG = (query: string) => {
    const queryLower = query.toLowerCase()
    const accessibleDocs = filterAccessibleDocs(KNOWLEDGE_BASE)

    // Simple relevance matching
    const relevantDocs = accessibleDocs
      .filter(
        (doc) =>
          doc.title.toLowerCase().includes(queryLower) ||
          doc.content.toLowerCase().includes(queryLower) ||
          doc.summary.toLowerCase().includes(queryLower),
      )
      .slice(0, 3)

    return relevantDocs
  }

  const generateResponse = (
    query: string,
    citations: (typeof KNOWLEDGE_BASE)[0][],
  ): { text: string; citations: Citation[] } => {
    const citationsList: Citation[] = citations.map((doc) => ({
      title: doc.title,
      source: doc.source,
      section: doc.section,
      accessLevel: doc.accessLevel,
    }))

    let text = ""

    if (citations.length === 0) {
      text =
        "I don't have access to documents matching your query. Please try rephrasing your question or contact your administrator for more information."
    } else if (query.toLowerCase().includes("underwriting")) {
      text =
        citations[0]?.summary || "The underwriting system uses a decision tree model with role-based access controls."
    } else if (query.toLowerCase().includes("employment")) {
      text = citations[0]?.summary || "Employment data is structured with historical tracking capabilities."
    } else if (query.toLowerCase().includes("sla")) {
      text =
        "Our documentation service maintains a 99.9% uptime SLA with documented failure modes and recovery procedures."
    } else if (query.toLowerCase().includes("access")) {
      text =
        user.role === "admin"
          ? "As an admin, you have access to all internal documentation and systems. Role-based access control is enforced at multiple levels."
          : "As an employee, you have access to public documentation and project guidelines. Internal system documentation is restricted to admin roles."
    } else if (query.toLowerCase().includes("api")) {
      text =
        "Our REST API is documented at api.company.com/v1. All endpoints require authentication and support both JSON and XML formats."
    } else {
      text = `Based on the available documentation, I found ${citations.length} relevant document(s). ${citations[0]?.summary || "This covers the topic you asked about."}`
    }

    return { text, citations: citationsList }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // Simulate RAG processing
    setTimeout(() => {
      const relevantDocs = performRAG(input)
      const { text, citations } = generateResponse(input, relevantDocs)

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: text,
        citations,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1500)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-2xl ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-none"
                    : "bg-card border border-border rounded-2xl rounded-tl-none"
                } p-4 md:p-5 space-y-3`}
              >
                <p className="text-sm md:text-base leading-relaxed">{message.content}</p>

                {message.citations && message.citations.length > 0 && (
                  <div className="pt-3 border-t border-border/30 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Sources</p>
                    {message.citations.map((citation, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedCitation(citation)}
                        className="w-full text-left p-2 rounded bg-secondary/50 hover:bg-secondary transition-colors group"
                      >
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{citation.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {citation.section && `${citation.section} • `}
                              {citation.source}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-tl-none p-4 md:p-5">
              <div className="flex items-center gap-2">
                <LoaderIcon className="w-4 h-4 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Searching knowledge base...</p>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card p-4 md:p-6">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto space-y-4">
          {/* Quick suggestions */}
          <div className="flex flex-wrap gap-2">
            {[
              user.role === "admin" ? "Tell me about underwriting" : "What are the API docs?",
              "What are the SLAs?",
              "Access policies",
            ].map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setInput(suggestion)}
                className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {/* Input field */}
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about internal documentation..."
              className="flex-1 h-12 px-4 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-12 px-4 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <SendIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            {user.role === "admin"
              ? "✓ Full access to internal documentation"
              : "✓ Access to public documentation only"}
          </p>
        </form>
      </div>

      {/* Citation Modal */}
      <AnimatePresence>
        {selectedCitation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedCitation(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-lg max-w-2xl w-full p-6 space-y-4 max-h-96 overflow-y-auto"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-lg">{selectedCitation.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedCitation.section && `${selectedCitation.section} • `}
                    {selectedCitation.source}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCitation(null)}
                  className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {selectedCitation.accessLevel === "internal" && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    <Shield className="w-3 h-3" />
                    Internal Only
                  </div>
                )}
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400">
                  <Clock className="w-3 h-3" />
                  Latest
                </div>
              </div>

              <p className="text-sm text-foreground/80 leading-relaxed">
                This document contains detailed information about {selectedCitation.title.toLowerCase()}. Access is
                controlled based on your role and permissions within the organization.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
