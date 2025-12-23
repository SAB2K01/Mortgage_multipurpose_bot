"use client"

import { useMemo, useState } from "react"
import { ChevronDown, FileText, Shield, Lock, ExternalLink, Lightbulb, BookOpen } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface Source {
  id: string
  title: string
  section: string
  source: string
  accessLevel: "public" | "internal"
  snippet: string
  fullText: string
  [key: string]: any
}

interface SourcesPanelProps {
  sources: Source[]
}

function isLikelyUrl(s: string) {
  return /^https?:\/\/\S+/i.test(s || "")
}

export default function SourcesPanel({ sources }: SourcesPanelProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  // Make sure we always render clean values (no undefined)
  const normalized = useMemo(() => {
    return (sources || []).map((s) => ({
      ...s,
      id: (s?.id || "").toString(),
      title: (s?.title || "Source").toString(),
      section: (s?.section || "").toString(),
      source: (s?.source || "").toString(),
      accessLevel: (s?.accessLevel === "public" ? "public" : "internal") as "public" | "internal",
      snippet: (s?.snippet || "").toString(),
      fullText: (s?.fullText || s?.snippet || "").toString(),
    }))
  }, [sources])

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-80 bg-black/40 backdrop-blur-xl border-l border-white/[0.05] flex flex-col h-full relative overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)`,
          backgroundSize: "30px 30px",
        }}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 border-b border-white/[0.05] relative"
      >
        <h3 className="font-semibold text-white/90 flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
          >
            <Lightbulb className="w-4 h-4 text-amber-400" />
          </motion.div>
          Sources & Citations
        </h3>
        <motion.p className="text-xs text-white/40 mt-1 flex items-center gap-2">
          <motion.span
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            className="w-1.5 h-1.5 rounded-full bg-green-500"
          />
          {normalized.length > 0 ? `${normalized.length} source(s) found` : "Ask a question to see citations"}
        </motion.p>
      </motion.div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {normalized.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 px-6 text-white/30">
            <motion.div
              animate={{ y: [0, -8, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
            >
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-40" />
            </motion.div>
            <p className="text-sm">No sources yet</p>
            <p className="text-xs mt-2 text-white/20">Sources will appear here when you ask questions</p>
          </motion.div>
        ) : (
          <div className="p-3 space-y-2">
            <AnimatePresence>
              {normalized.map((source, idx) => {
                // ✅ Always unique key (prevents React duplicate key warning)
                const stableKey = `${source.id || source.source || "src"}-${idx}`

                const openTarget = isLikelyUrl(source.source) ? source.source : ""
                const sectionText = [source.section, source.source].filter(Boolean).join(" • ")

                return (
                  <motion.div
                    key={stableKey}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="relative group"
                  >
                    <div className="absolute -inset-[0.5px] rounded-xl overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                      <motion.div
                        className="absolute top-0 left-0 h-[1px] w-[30%] bg-gradient-to-r from-transparent via-purple-400 to-transparent"
                        animate={{ left: ["-30%", "100%"] }}
                        transition={{ duration: 2.5, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
                      />
                    </div>

                    <div className="relative rounded-xl border border-white/[0.05] bg-white/[0.02] overflow-hidden transition-all group-hover:bg-white/[0.04] group-hover:border-white/10">
                      <motion.button
                        whileHover={{ x: 2 }}
                        onClick={() => setExpandedKey(expandedKey === stableKey ? null : stableKey)}
                        className="w-full p-4 text-left flex items-start justify-between gap-2"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <motion.div
                            animate={expandedKey === stableKey ? { rotate: 180 } : { rotate: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-purple-400" />
                          </motion.div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white/90 truncate">{source.title}</p>
                            <p className="text-xs text-white/40 mt-1 truncate">
                              {sectionText || "Source"}
                            </p>
                          </div>
                        </div>
                        <motion.div animate={{ rotate: expandedKey === stableKey ? 180 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronDown className="w-4 h-4 flex-shrink-0 text-white/30" />
                        </motion.div>
                      </motion.button>

                      <AnimatePresence>
                        {expandedKey === stableKey && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.28 }}
                            className="border-t border-white/[0.05]"
                          >
                            <div className="p-4 space-y-3 bg-white/[0.02]">
                              {/* Access Level Badge */}
                              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
                                {source.accessLevel === "internal" ? (
                                  <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 text-xs font-medium border border-amber-500/20"
                                  >
                                    <Shield className="w-3 h-3" />
                                    Internal Only
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/10 text-green-300 text-xs font-medium border border-green-500/20"
                                  >
                                    <Lock className="w-3 h-3" />
                                    Public
                                  </motion.div>
                                )}
                              </motion.div>

                              {/* Snippet */}
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.08 }}
                                className="text-xs text-white/60 bg-black/30 p-3 rounded-lg leading-relaxed border border-white/[0.05]"
                              >
                                {source.snippet ? `"${source.snippet}"` : <span className="text-white/30">No snippet</span>}
                              </motion.div>

                              {/* Action Buttons */}
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.12 }}
                                className="flex gap-2"
                              >
                                <motion.button
                                  whileHover={{ scale: 1.03, y: -1 }}
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => {
                                    if (!openTarget) return
                                    window.open(openTarget, "_blank", "noopener,noreferrer")
                                  }}
                                  disabled={!openTarget}
                                  className={`flex-1 px-3 py-2 text-xs rounded-lg transition-all font-medium flex items-center justify-center gap-1.5 border ${
                                    openTarget
                                      ? "bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-purple-500/20"
                                      : "bg-white/5 text-white/30 border-white/10 cursor-not-allowed"
                                  }`}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Open
                                </motion.button>

                                <motion.button
                                  whileHover={{ scale: 1.03, y: -1 }}
                                  whileTap={{ scale: 0.97 }}
                                  className="flex-1 px-3 py-2 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition-all font-medium border border-white/10"
                                >
                                  Compare
                                </motion.button>
                              </motion.div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  )
}
