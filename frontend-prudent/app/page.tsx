"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HomeRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Always send user to the login screen when app starts at "/"
    router.replace("/signin")
  }, [router])

  return null
}
