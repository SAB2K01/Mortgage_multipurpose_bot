"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Eye, EyeOff, Mail, Lock, Gem } from "lucide-react"


// Mock user database with roles
const MOCK_USERS = [
  {
    id: 1,
    email: "sabari@prudent.ai",
    password: "zjtwq7wpf8",
    name: "Admin User",
    role: "admin",
    avatar: "👨‍💼",
  },
  {
    id: 2,
    email: "employee@company.com",
    password: "password123",
    name: "Employee",
    role: "employee",
    avatar: "👩‍💻",
  },
]

export default function SignIn() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    // Simulate authentication
    setTimeout(() => {
      const user = MOCK_USERS.find((u) => u.email === email && u.password === password)

      if (user) {
        localStorage.setItem(
          "current_user",
          JSON.stringify({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
          }),
        )
        router.push("/dashboard")
      } else {
        setError("Invalid email or password")
      }
      setLoading(false)
    }, 800)
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row w-full bg-background">
      {/* Left Side - Sign In Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="bg-card border border-border rounded-lg p-6 sm:p-8 shadow-sm space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 pl-10 pr-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 pl-10 pr-10 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-input"
                  />
                  <span className="text-muted-foreground">Remember me</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Right Side - Hero Section */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 items-center justify-center p-8">
        <div className="absolute inset-0">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500/20 rounded-full mix-blend-screen filter blur-3xl animate-pulse" />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-cyan-500/20 rounded-full mix-blend-screen filter blur-3xl animate-pulse animation-delay-2000" />
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-500/20 rounded-full mix-blend-screen filter blur-3xl animate-pulse animation-delay-4000" />
        </div>

        <div className="relative z-10 flex items-center justify-center w-full">
          {/* Logo card */}
          <div className="bg-white rounded-xl px-6 py-4 shadow-sm flex items-center gap-4">
            {/* Diamond icon (matches screenshot style) */}
            <svg width="44" height="44" viewBox="0 0 48 48" className="shrink-0" aria-hidden="true">
              {/* Filled diamond */}
              <path d="M24 4L44 18L24 44L4 18L24 4Z" fill="#6D5AF6" />
              {/* Small inner facet to mimic the screenshot cut */}
              <path d="M24 14L34 20L24 34L14 20L24 14Z" fill="#FFFFFF" opacity="0.18" />
            </svg>

            {/* Text: Prudent AI (AI in purple) */}
            <div className="flex items-baseline">
              <span className="text-[34px] leading-none font-extrabold tracking-tight text-[#111827]">
                Prudent
              </span>
              <span className="ml-2 text-[34px] leading-none font-extrabold tracking-tight text-[#6D5AF6]">
                AI
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
