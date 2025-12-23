"use client"

import { useState } from "react"
import { Plus, Trash2, MessageSquare, Zap } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface ChatThread {
  id: string
  title: string
  timestamp: Date
  preview: string
}

interface ChatThreadsProps {
  threads: ChatThread[]
  activeThread: string | null
  onSelectThread: (id: string) => void
  onNewThread: () => void
  onDeleteThread: (id: string) => void
}

export default function ChatThreads({
  threads,
  activeThread,
  onSelectThread,
  onNewThread,
  onDeleteThread,
}: ChatThreadsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-72 bg-black/40 backdrop-blur-xl border-r border-white/[0.05] flex flex-col h-full relative overflow-hidden"
    >
      {/* Subtle inner patterns */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)`,
          backgroundSize: "30px 30px",
        }}
      />

      {/* Header with New Chat button */}
      <div className="p-4 border-b border-white/[0.05] relative">
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewThread}
          className="w-full relative group"
        >
          <div className="absolute -inset-[0.5px] rounded-xl overflow-hidden">
            <motion.div
              className="absolute top-0 left-0 h-[2px] w-[40%] bg-gradient-to-r from-transparent via-white to-transparent opacity-60"
              animate={{ left: ["-40%", "100%"] }}
              transition={{ duration: 2, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY, repeatDelay: 2 }}
            />
            <motion.div
              className="absolute top-0 right-0 h-[40%] w-[2px] bg-gradient-to-b from-transparent via-white to-transparent opacity-60"
              animate={{ top: ["-40%", "100%"] }}
              transition={{
                duration: 2,
                ease: "easeInOut",
                repeat: Number.POSITIVE_INFINITY,
                repeatDelay: 2,
                delay: 0.5,
              }}
            />
            <motion.div
              className="absolute bottom-0 right-0 h-[2px] w-[40%] bg-gradient-to-r from-transparent via-white to-transparent opacity-60"
              animate={{ right: ["-40%", "100%"] }}
              transition={{
                duration: 2,
                ease: "easeInOut",
                repeat: Number.POSITIVE_INFINITY,
                repeatDelay: 2,
                delay: 1,
              }}
            />
            <motion.div
              className="absolute bottom-0 left-0 h-[40%] w-[2px] bg-gradient-to-b from-transparent via-white to-transparent opacity-60"
              animate={{ bottom: ["-40%", "100%"] }}
              transition={{
                duration: 2,
                ease: "easeInOut",
                repeat: Number.POSITIVE_INFINITY,
                repeatDelay: 2,
                delay: 1.5,
              }}
            />
          </div>

          <div className="relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium transition-all group-hover:bg-white/10 group-hover:border-white/20">
            <Plus className="w-4 h-4" />
            New Chat
          </div>
        </motion.button>
      </div>

      {/* Threads List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <AnimatePresence>
          {threads.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 text-white/30">
              <motion.div
                animate={{ y: [0, -8, 0], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
              >
                <MessageSquare className="w-10 h-10 mx-auto mb-3" />
              </motion.div>
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1 text-white/20">Start a new chat above</p>
            </motion.div>
          ) : (
            threads.map((thread, idx) => (
              <motion.div
                key={thread.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: idx * 0.05 }}
                onMouseEnter={() => setHoveredId(thread.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="relative group"
              >
                {activeThread === thread.id && (
                  <motion.div
                    layoutId="active-thread"
                    className="absolute -inset-[0.5px] rounded-xl bg-gradient-to-r from-purple-500/30 via-white/10 to-purple-500/30"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}

                <motion.div
                  whileHover={{ x: 4 }}
                  onClick={() => onSelectThread(thread.id)}
                  className={`relative p-3 rounded-xl cursor-pointer transition-all border ${
                    activeThread === thread.id
                      ? "bg-white/10 border-white/20"
                      : "bg-white/[0.02] border-white/[0.05] hover:bg-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <motion.div
                      animate={activeThread === thread.id ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                    >
                      <Zap
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          activeThread === thread.id ? "text-purple-400" : "text-white/30"
                        }`}
                      />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/90 truncate">{thread.title}</p>
                      <p className="text-xs text-white/40 truncate mt-1">{thread.preview}</p>
                      <p className="text-xs text-white/20 mt-2">{thread.timestamp.toLocaleDateString()}</p>
                    </div>
                  </div>

                  <AnimatePresence>
                    {hoveredId === thread.id && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteThread(thread.id)
                        }}
                        className="absolute top-2 right-2 p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
