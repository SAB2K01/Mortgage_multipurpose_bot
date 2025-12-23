"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, Menu, X, Shield, FileText } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import KnowledgeAgentEnhanced from "@/components/knowledge-agent-enhanced"

interface User {
  id: number
  email: string
  name: string
  role: "admin" | "employee"
  avatar: string
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Initial load: check localStorage for user
  useEffect(() => {
    setMounted(true)

    try {
      const userData = typeof window !== "undefined" ? localStorage.getItem("current_user") : null

      if (!userData) {
        router.push("/signin")
      } else {
        const parsed = JSON.parse(userData) as User
        setUser(parsed)
      }
    } catch (err) {
      // If anything goes wrong (corrupt JSON etc.), force logout
      console.error("Failed to read user from localStorage:", err)
      if (typeof window !== "undefined") {
        localStorage.removeItem("current_user")
        localStorage.removeItem("access_token")
      }
      router.push("/signin")
    }
  }, [router])

  const handleLogout = () => {
    console.log("[v0] Sign out clicked")

    // Clear all auth data from localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("current_user")
      localStorage.removeItem("access_token")
      console.log("[v0] Cleared localStorage")
    }

    // Clear user state
    setUser(null)
    console.log("[v0] Cleared user state")

    // Redirect to signin page
    window.location.href = "/signin"
  }

  if (!mounted || !user) return null

  return (
    <div className="min-h-screen w-screen bg-black relative overflow-hidden">
      {/* Background - matches signin page exactly */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-500/40 via-purple-700/50 to-black" />

      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      {/* Top radial glow */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[120vh] h-[60vh] rounded-b-[50%] bg-purple-400/20 blur-[80px]" />
      <motion.div
        className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[100vh] h-[60vh] rounded-b-full bg-purple-300/20 blur-[60px]"
        animate={{
          opacity: [0.15, 0.3, 0.15],
          scale: [0.98, 1.02, 0.98],
        }}
        transition={{
          duration: 8,
          repeat: Number.POSITIVE_INFINITY,
          repeatType: "mirror",
        }}
      />
      <motion.div
        className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-[90vh] h-[90vh] rounded-t-full bg-purple-400/20 blur-[60px]"
        animate={{
          opacity: [0.3, 0.5, 0.3],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 6,
          repeat: Number.POSITIVE_INFINITY,
          repeatType: "mirror",
          delay: 1,
        }}
      />

      {/* Animated glow spots */}
      <div className="absolute left-1/4 top-1/4 w-96 h-96 bg-white/5 rounded-full blur-[100px] animate-pulse opacity-40" />
      <div className="absolute right-1/4 bottom-1/4 w-96 h-96 bg-white/5 rounded-full blur-[100px] animate-pulse delay-1000 opacity-40" />

      <div className="relative z-10 flex h-screen">
        {/* Collapsible User Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-72 border-r border-white/[0.05] flex flex-col bg-black/40 backdrop-blur-xl relative overflow-hidden"
            >
              {/* Subtle patterns */}
              <div
                className="absolute inset-0 opacity-[0.02]"
                style={{
                  backgroundImage: `linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)`,
                  backgroundSize: "30px 30px",
                }}
              />

              {/* Header with logo */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 border-b border-white/[0.05] relative"
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", duration: 0.8 }}
                    className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-purple-500/20 to-transparent"
                  >
                    <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
                      K
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
                  </motion.div>
                  <div>
                    <motion.h1
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80"
                    >
                      Knowledge Agent
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="text-xs text-white/40"
                    >
                      Internal Documentation
                    </motion.p>
                  </div>
                </div>
              </motion.div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Access Level Card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-2"
                >
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1">Access Level</p>
                  {user.role === "admin" ? (
                    <>
                      <motion.div
                        whileHover={{ scale: 1.02, x: 4 }}
                        className="flex items-center gap-2 text-xs p-3 rounded-lg bg-green-500/10 text-green-300 border border-green-500/20"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        All documentation
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.02, x: 4 }}
                        className="flex items-center gap-2 text-xs p-3 rounded-lg bg-green-500/10 text-green-300 border border-green-500/20"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Internal communications
                      </motion.div>
                    </>
                  ) : (
                    <>
                      <motion.div
                        whileHover={{ scale: 1.02, x: 4 }}
                        className="flex items-center gap-2 text-xs p-3 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Public documentation
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.02, x: 4 }}
                        className="flex items-center gap-2 text-xs p-3 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Project guidelines
                      </motion.div>
                    </>
                  )}
                </motion.div>
              </div>

              {/* Logout */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="p-4 border-t border-white/[0.05]"
              >
                <motion.button
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-all text-sm font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full">
          {/* Top Bar */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-b border-white/[0.05] bg-black/40 backdrop-blur-xl px-4 py-3 flex items-center justify-between"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2.5 hover:bg-white/5 rounded-lg text-white/50 hover:text-white transition-all border border-white/10"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.button>

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-3"
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-purple-500/20"
              >
                {user.avatar}
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Agent Content */}
          <div className="flex-1 overflow-hidden">
            <KnowledgeAgentEnhanced user={user} />
          </div>
        </div>
      </div>
    </div>
  )
}
