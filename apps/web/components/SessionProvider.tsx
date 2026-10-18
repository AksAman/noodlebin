"use client"

import { authClient, type AuthSession } from "@/lib/auth-client"
import { createContext, useContext, type ReactNode } from "react"

const SessionContext = createContext<AuthSession | null>(null)

export function SessionProvider({
  session,
  children,
}: {
  session: AuthSession | null
  children: ReactNode
}) {
  authClient.hydrateSession(session)
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

/** Server session while the client hook is still pending, then the live client session. */
export function useServerSession() {
  const initialSession = useContext(SessionContext)
  const query = authClient.useSession()
  const data = query.isPending && !query.isRefetching ? initialSession : query.data
  return { ...query, data }
}
