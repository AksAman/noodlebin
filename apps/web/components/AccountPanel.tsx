"use client"

import { PageLoader } from "@/components/Loader"
import { useServerSession } from "@/components/SessionProvider"
import { SignInButtons } from "@/components/SignInButtons"
import { authClient } from "@/lib/auth-client"
import { btn, btnGhost, cn, docShell } from "@/lib/ui"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type Account = { providerId: string }

export function AccountPanel() {
  const router = useRouter()
  const { data: session, isPending } = useServerSession()
  const [accounts, setAccounts] = useState<Account[]>([])

  useEffect(() => {
    if (isPending) return
    if (!session?.user) router.replace("/sign-in")
  }, [isPending, router, session])

  useEffect(() => {
    if (!session) return
    void authClient.listAccounts().then((result) => {
      if (result.data) setAccounts(result.data)
    })
  }, [session])

  if (!session?.user) {
    return (
      <div className={docShell}>
        <PageLoader className="min-h-[60vh]" label="Taking you to sign in" />
      </div>
    )
  }

  const handle = session.user.handle
  return (
    <div
      className={cn(
        docShell,
        "min-h-[calc(100dvh-35rem)] w-full justify-center px-5 py-16 sm:px-8 md:min-h-[calc(100dvh-10rem)]",
      )}
    >
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 md:grid-cols-2 md:gap-20">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[clamp(2.75rem,1.8rem+3vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.035em]">
            @{handle}
          </h1>
          <p className="mt-4 max-w-[36ch] text-[17px] leading-relaxed text-muted">
            This handle credits your graphs. Connect another provider here. A new one in a fresh browser starts a separate
            account unless both share a verified email.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {handle ? (
              <Link className={btn} href={`/@${handle}`}>
                Your graphs
              </Link>
            ) : null}
            <button type="button" className={btnGhost} onClick={() => void authClient.signOut()}>
              Sign out
            </button>
          </div>
        </div>
        <div className="min-w-0 w-full">
          <SignInButtons mode="link" callbackURL="/account" connected={accounts.map((account) => account.providerId)} />
        </div>
      </div>
    </div>
  )
}
