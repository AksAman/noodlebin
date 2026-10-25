"use client"

import { Dialog } from "@/components/Dialog"
import { SignInButtons } from "@/components/SignInButtons"
import { authClient } from "@/lib/auth-client"
import { btn, btnGhost } from "@/lib/ui"
import { useEffect, useState } from "react"

/** What only the owner sees on their own profile: manage sign-in methods and sign out. */
export function ProfileOwnerActions({ handle }: { handle: string }) {
  const [open, setOpen] = useState(false)
  const [providers, setProviders] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    void authClient.listAccounts().then((result) => {
      if (result.data) setProviders(result.data.map((account) => account.providerId))
    })
  }, [open])

  return (
    <>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" className={btn} onClick={() => setOpen(true)}>
          Connected accounts
        </button>
        <button
          type="button"
          className={btnGhost}
          onClick={() => void authClient.signOut().then(() => window.location.assign("/"))}
        >
          Sign out
        </button>
      </div>
      {open ? (
        <Dialog
          title="Connected accounts"
          subtitle="Any of these signs you in as the same handle. A new provider in a fresh browser starts a separate account unless both share a verified email."
          onClose={() => setOpen(false)}
        >
          <div className="px-5 py-5">
            <SignInButtons mode="link" callbackURL={`/@${handle}`} connected={providers} />
          </div>
        </Dialog>
      ) : null}
    </>
  )
}
