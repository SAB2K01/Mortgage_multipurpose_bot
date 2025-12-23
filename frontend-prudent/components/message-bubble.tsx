"use client"

import { motion } from "framer-motion"
import { Copy, CheckCircle2, Bot, User } from "lucide-react"
import { useState } from "react"

interface MessageBubbleProps {
  role: "user" | "assistant"
  content: string
  followUpSuggestions?: string[]
  onSuggestionClick?: (suggestion: string) => void
}

export default function MessageBubble({ role, content, followUpSuggestions, onSuggestionClick }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}
    >
      <div className={`flex items-start gap-3 max-w-2xl ${role === "user" ? "flex-row-reverse" : ""}`}>
        {/* Avatar */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            role === "user"
              ? "bg-gradient-to-br from-purple-500 to-purple-700 border border-purple-400/30"
              : "bg-gradient-to-br from-white/10 to-white/5 border border-white/10"
          }`}
        >
          {role === "user" ? (
            <User className="w-4 h-4 text-white" />
          ) : (
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            >
              <Bot className="w-4 h-4 text-purple-400" />
            </motion.div>
          )}
        </motion.div>

        {/* Message Bubble */}
        <div className="relative group">
          {/* Traveling light effect for assistant messages */}
          {role === "assistant" && (
            <div className="absolute -inset-[0.5px] rounded-2xl overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <motion.div
                className="absolute top-0 left-0 h-[1.5px] w-[40%] bg-gradient-to-r from-transparent via-purple-400 to-transparent"
                animate={{ left: ["-40%", "100%"] }}
                transition={{ duration: 2.5, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
              />
              <motion.div
                className="absolute top-0 right-0 h-[40%] w-[1.5px] bg-gradient-to-b from-transparent via-purple-400 to-transparent"
                animate={{ top: ["-40%", "100%"] }}
                transition={{ duration: 2.5, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY, delay: 0.6 }}
              />
              <motion.div
                className="absolute bottom-0 right-0 h-[1.5px] w-[40%] bg-gradient-to-r from-transparent via-purple-400 to-transparent"
                animate={{ right: ["-40%", "100%"] }}
                transition={{ duration: 2.5, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY, delay: 1.2 }}
              />
              <motion.div
                className="absolute bottom-0 left-0 h-[40%] w-[1.5px] bg-gradient-to-b from-transparent via-purple-400 to-transparent"
                animate={{ bottom: ["-40%", "100%"] }}
                transition={{ duration: 2.5, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY, delay: 1.8 }}
              />
            </div>
          )}

          <div
            className={`relative ${
              role === "user"
                ? "bg-gradient-to-br from-purple-600 to-purple-800 text-white rounded-2xl rounded-tr-md border border-purple-500/30"
                : "bg-black/40 backdrop-blur-xl border border-white/[0.08] text-white/90 rounded-2xl rounded-tl-md"
            } p-4 md:p-5 space-y-3 transition-all duration-300 ${
              role === "assistant" ? "hover:bg-black/50 hover:border-white/15" : ""
            }`}
          >
            {/* Inner pattern for assistant */}
            {role === "assistant" && (
              <div
                className="absolute inset-0 rounded-2xl opacity-[0.02]"
                style={{
                  backgroundImage: `linear-gradient(135deg, white 0.5px, transparent 0.5px)`,
                  backgroundSize: "20px 20px",
                }}
              />
            )}

            <div className="relative flex items-start gap-3">
              <p className="text-sm md:text-base leading-relaxed flex-1">{content}</p>
              {role === "assistant" && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopy}
                  className="flex-shrink-0 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100 border border-white/10"
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-white/50" />
                  )}
                </motion.button>
              )}
            </div>

            {/* Follow-up Suggestions */}
            {role === "assistant" && followUpSuggestions && followUpSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap gap-2 pt-3 border-t border-white/[0.05]"
              >
                {followUpSuggestions.map((suggestion, idx) => (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + idx * 0.05 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onSuggestionClick?.(suggestion)}
                    className="relative text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-white/10 hover:border-white/20"
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
