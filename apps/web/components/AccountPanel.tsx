"use client"

import { SignInButtons } from "@/components/SignInButtons"
import { authClient } from "@/lib/auth-client"
import { btnGhost, docShell, page } from "@/lib/ui"
import Link from "next/link"
import { useEffect, useState } from "react"

type Account = { providerId: string }

export function AccountPanel() {
  const { data: session, isPending } = authClient.useSession()
  const [accounts, setAccounts] = useState<Account[]>([])

  useEffect(() => {
    if (!session) return
    void authClient.listAccounts().then((result) => {
      if (result.data) setAccounts(result.data)
    })
  }, [session])

  if (isPending) {
    return (
      <div className={docShell}>
        <div className={cnPage}>Checking sign-in…</div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className={docShell}>
        <div className={cnPage}>
          <h1 className="m-0 font-display text-4xl font-semibold tracking-[-0.03em]">Sign in</h1>
          <p className="mt-3 max-w-[46ch] text-muted">
            Optional. A handle is how graphs are credited to you. You can keep publishing without one.
          </p>
          <div className="mt-6">
            <SignInButtons callbackURL="/account" />
          </div>
        </div>
      </div>
    )
  }

  const handle = session.user.handle
  return (
    <div className={docShell}>
      <div className={cnPage}>
        <h1 className="m-0 font-display text-4xl font-semibold tracking-[-0.03em]">@{handle}</h1>
        <p className="mt-3 max-w-[52ch] text-muted">
          Connecting another provider attaches it to this handle. Signing in with a new provider in a fresh browser creates a
          separate account unless both share a verified email.
        </p>
        <div className="mt-6">
          <SignInButtons mode="link" callbackURL="/account" connected={accounts.map((account) => account.providerId)} />
        </div>
        <div className="mt-8 flex gap-3">
          {handle ? (
            <Link className="text-accent-fg underline-offset-4 hover:underline" href={`/@${handle}`}>
              Your graphs
            </Link>
          ) : null}
          <button type="button" className={btnGhost} onClick={() => void authClient.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

const cnPage = `${page} pt-16 sm:pt-24`
