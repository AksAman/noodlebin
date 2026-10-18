"use client"

import { analyticsEnabled, personProperties } from "@/lib/analytics"
import { authClient, type AuthSession } from "@/lib/auth-client"
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react"
import posthog from "posthog-js"

const SessionContext = createContext<AuthSession | null>(null)

export function SessionProvider({
  session,
  children,
}: {
  session: AuthSession | null
  children: ReactNode
}) {
  authClient.hydrateSession(session)
  return (
    <SessionContext.Provider value={session}>
      <PosthogIdentity />
      {children}
    </SessionContext.Provider>
  )
}

/** Identifies the signed-in person the way Mave does: email as the distinct id. */
function PosthogIdentity() {
  const { data } = useServerSession()
  const identified = useRef(false)
  const email = data?.user.email
  const name = data?.user.name
  const handle = data?.user.handle

  useEffect(() => {
    if (!analyticsEnabled(window.location.pathname)) return
    if (email) {
      try {
        posthog.identify(email, personProperties({ email, name, handle }))
        identified.current = true
      } catch {
        // Analytics must not break the page when the script is blocked.
      }
      return
    }
    if (!identified.current) return
    identified.current = false
    try {
      posthog.reset()
    } catch {
      // Same as above.
    }
  }, [email, handle, name])

  return null
}

/** Server session while the client hook is still pending, then the live client session. */
export function useServerSession() {
  const initialSession = useContext(SessionContext)
  const query = authClient.useSession()
  const data = query.isPending && !query.isRefetching ? initialSession : query.data
  return { ...query, data }
}
