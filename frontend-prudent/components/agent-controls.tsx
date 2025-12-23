"use client"

import { useState } from "react"
import { ChevronDown, Settings, Sparkles, Database, Globe, Layers } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface AgentControlsProps {
  activeAgent: string
  onAgentChange: (agent: string) => void
  scope: "internal" | "web" | "hybrid"
  onScopeChange: (scope: "internal" | "web" | "hybrid") => void
  strictCitations: boolean
  onStrictCitationsChange: (strict: boolean) => void
}

const AGENTS = [
  { id: "knowledge", label: "Internal Knowledge", icon: Database, color: "text-purple-400" },
  { id: "mortgage", label: "Mortgage Tutor", icon: Sparkles, color: "text-blue-400" },
  { id: "industry", label: "Industry Current Affairs", icon: Globe, color: "text-green-400" },
]

const SCOPES = [
  { id: "internal", label: "Internal", icon: Database },
  { id: "web", label: "Web", icon: Globe },
  { id: "hybrid", label: "Hybrid", icon: Layers },
]

export default function AgentControls({
  activeAgent,
  onAgentChange,
  scope,
  onScopeChange,
  strictCitations,
  onStrictCitationsChange,
}: AgentControlsProps) {
  const [agentOpen, setAgentOpen] = useState(false)

  const activeAgentData = AGENTS.find((a) => a.id === activeAgent)

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="px-6 py-4 bg-black/40 border-b border-white/[0.05] backdrop-blur-xl relative z-40"
    >
      {/* Subtle patterns */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(135deg, white 0.5px, transparent 0.5px)`,
          backgroundSize: "20px 20px",
        }}
      />

      <div className="relative flex items-center justify-between gap-4 flex-wrap">
        {/* Agent Selector with traveling light */}
        <div className="relative z-50">
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setAgentOpen(!agentOpen)}
            className="relative group"
          >
            <div className="absolute -inset-[0.5px] rounded-xl overflow-hidden">
              <motion.div
                className="absolute top-0 left-0 h-[1.5px] w-[30%] bg-gradient-to-r from-transparent via-white to-transparent opacity-50"
                animate={{ left: ["-30%", "100%"] }}
                transition={{ duration: 3, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
              />
            </div>

            <div className="relative flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              >
                {activeAgentData && <activeAgentData.icon className={`w-4 h-4 ${activeAgentData.color}`} />}
              </motion.div>
              <span className="text-sm font-medium text-white/90">{activeAgentData?.label}</span>
              <motion.div animate={{ rotate: agentOpen ? 180 : 0 }}>
                <ChevronDown className="w-4 h-4 text-white/40" />
              </motion.div>
            </div>
          </motion.button>

          <AnimatePresence>
            {agentOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="absolute top-full mt-2 left-0 bg-black/90 border border-white/10 rounded-xl shadow-2xl z-[100] min-w-56 backdrop-blur-xl overflow-hidden"
              >
                {AGENTS.map((agent, idx) => (
                  <motion.button
                    key={agent.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ x: 4, backgroundColor: "rgba(255,255,255,0.05)" }}
                    onClick={() => {
                      onAgentChange(agent.id)
                      setAgentOpen(false)
                    }}
                    className={`w-full text-left px-4 py-3 text-sm transition-all flex items-center gap-3 border-b border-white/[0.05] last:border-0 ${
                      activeAgent === agent.id ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                    }`}
                  >
                    <agent.icon className={`w-4 h-4 ${agent.color}`} />
                    {agent.label}
                    {activeAgent === agent.id && (
                      <motion.div layoutId="active-check" className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400" />
                    )}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Scope Toggles */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10"
        >
          {SCOPES.map((s) => (
            <motion.button
              key={s.id}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onScopeChange(s.id as "internal" | "web" | "hybrid")}
              className={`relative px-3 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-2 ${
                scope === s.id ? "text-white" : "text-white/40 hover:text-white/60"
              }`}
            >
              {scope === s.id && (
                <motion.div
                  layoutId="scope-bg"
                  className="absolute inset-0 bg-purple-500/30 rounded-lg border border-purple-500/30"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </span>
            </motion.button>
          ))}
        </motion.div>

        {/* Strict Citations Toggle */}
        <motion.label
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.02, y: -1 }}
          className={`relative flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all cursor-pointer ${
            strictCitations
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-white/10 bg-white/5 hover:bg-white/10 text-white/60"
          }`}
        >
          {/* Custom checkbox */}
          <div
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
              strictCitations ? "border-amber-400 bg-amber-400" : "border-white/30"
            }`}
          >
            {strictCitations && (
              <motion.svg
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-2.5 h-2.5 text-black"
                viewBox="0 0 12 12"
              >
                <path
                  fill="currentColor"
                  d="M10.28 2.28L4.5 8.06 1.72 5.28a.75.75 0 00-1.06 1.06l3.5 3.5a.75.75 0 001.06 0l6.5-6.5a.75.75 0 00-1.06-1.06z"
                />
              </motion.svg>
            )}
          </div>
          <input
            type="checkbox"
            checked={strictCitations}
            onChange={(e) => onStrictCitationsChange(e.target.checked)}
            className="sr-only"
          />
          <span className="text-sm font-medium flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5" />
            Strict Citations
          </span>
        </motion.label>
      </div>

      {/* Status indicator */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-3 text-xs text-white/30 flex items-center gap-2"
      >
        <motion.span
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
          className={`w-1.5 h-1.5 rounded-full ${strictCitations ? "bg-amber-400" : "bg-green-400"}`}
        />
        {strictCitations
          ? "Strict mode: Only source-backed answers will be provided"
          : "Normal mode: Synthesized answers from available sources"}
      </motion.p>
    </motion.div>
  )
}
