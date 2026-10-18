"use client"

import { capture } from "@/lib/analytics"
import { InlineLoader, Noodle } from "@/components/Loader"
import { SOCIALS, authClient, type SocialProvider } from "@/lib/auth-client"
import { btnAccent, cn, errorBox, field } from "@/lib/ui"
import { useState, type ReactNode } from "react"

const socialButton =
  "inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-line-strong bg-bg px-3 text-[13px] font-medium text-fg transition-colors duration-150 hover:border-fg disabled:cursor-default disabled:opacity-55"

export function SignInButtons({
  callbackURL,
  onBefore,
  mode = "sign-in",
  connected = [],
}: {
  callbackURL: string
  onBefore?: () => void
  mode?: "sign-in" | "link"
  connected?: string[]
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<SocialProvider | "email" | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [creating, setCreating] = useState(true)

  async function go(provider: SocialProvider) {
    setError(null)
    setPending(provider)
    onBefore?.()
    capture("signed_in", { method: provider, action: mode === "link" ? "link" : "sign_in" }, true)
    try {
      const result =
        mode === "link"
          ? await authClient.linkSocial({ provider, callbackURL })
          : await authClient.signIn.social({ provider, callbackURL })
      if (result?.error) {
        setPending(null)
        setError(result.error.message || "Could not open the sign-in page.")
      }
    } catch (err) {
      setPending(null)
      setError(err instanceof Error ? err.message : "Could not open the sign-in page.")
    }
  }

  async function submitEmail() {
    setError(null)
    setPending("email")
    onBefore?.()
    const address = email.trim()
    const name = address.split("@")[0] || "user"
    try {
      const result = creating
        ? await authClient.signUp.email({ email: address, password, name })
        : await authClient.signIn.email({ email: address, password })
      if (result.error) {
        setPending(null)
        setError(result.error.message || "Could not sign in.")
        return
      }
      capture("signed_in", { method: "email", action: creating ? "sign_up" : "sign_in" }, true)
      if (window.location.pathname !== callbackURL) window.location.assign(callbackURL)
      else setPending(null)
    } catch (err) {
      setPending(null)
      setError(err instanceof Error ? err.message : "Could not sign in.")
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {SOCIALS.map((social) => {
        const already = connected.includes(social.id)
        return (
          <button
            key={social.id}
            type="button"
            className={socialButton}
            disabled={pending !== null || already}
            onClick={() => void go(social.id)}
          >
            {pending === social.id ? <Noodle size="sm" mono /> : <ProviderMark id={social.id} />}
            {already ? `${social.label} connected` : mode === "link" ? `Connect ${social.label}` : `Continue with ${social.label}`}
          </button>
        )
      })}
      {mode === "sign-in" ? (
        <div
          className="mt-2 flex flex-col gap-2 border-t border-line pt-3"
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.stopPropagation()
            event.preventDefault()
            if (pending === null) void submitEmail()
          }}
        >
          <label className="flex flex-col gap-1 text-[12px] text-muted">
            Email
            <input
              className={field}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-muted">
            Password
            <input
              className={field}
              type="password"
              autoComplete={creating ? "new-password" : "current-password"}
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={cn(btnAccent, "h-10 w-full")}
            disabled={pending !== null || !email.trim() || password.length < 8}
            onClick={() => void submitEmail()}
          >
            {pending === "email" ? (
              <InlineLoader mono label={creating ? "Creating account" : "Signing in"} className="justify-center" />
            ) : creating ? (
              "Create account"
            ) : (
              "Sign in with email"
            )}
          </button>
          <button
            type="button"
            className="cursor-pointer self-start text-[12px] text-muted underline-offset-4 hover:text-fg hover:underline"
            onClick={() => {
              setError(null)
              setCreating((value) => !value)
            }}
          >
            {creating ? "Already have an account? Sign in" : "Need an account? Create one"}
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className={cn(errorBox, "m-0")}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

function ProviderMark({ id }: { id: SocialProvider }) {
  const marks: Record<SocialProvider, ReactNode> = {
    google: (
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
        <path fill="#EA4335" d="M8 3.2a4.8 4.8 0 0 1 3.05 1.1l1.7-1.7A7.2 7.2 0 0 0 1.6 6.4l2 .9A4.8 4.8 0 0 1 8 3.2Z" />
        <path fill="#4285F4" d="M14.4 8.2c0-.5-.04-.9-.12-1.3H8v2.5h3.6a3.1 3.1 0 0 1-1.3 2l2 1.5a7.2 7.2 0 0 0 2.1-4.7Z" />
        <path fill="#FBBC05" d="M3.6 9.3a4.8 4.8 0 0 1 0-2.6l-2-.9a7.2 7.2 0 0 0 0 4.4l2-.9Z" />
        <path fill="#34A853" d="M8 15.2a7.2 7.2 0 0 0 4.9-1.8l-2-1.5a4.3 4.3 0 0 1-6.4-2.2l-2 .9A7.2 7.2 0 0 0 8 15.2Z" />
      </svg>
    ),
    twitter: (
      <svg viewBox="0 0 16 16" className="size-3.5 fill-current" aria-hidden="true">
        <path d="M9.3 7.1 14.2 1.5h-1.2L8.8 6.3 5.3 1.5H1.6l5.1 7.4L1.6 14.5h1.2l4.5-5.2 3.6 5.2h3.7L9.3 7.1Zm-1.6 1.8-.5-.7-4.1-5.9h1.8l3.3 4.7.5.7 4.3 6.2H11L7.7 8.9Z" />
      </svg>
    ),
    discord: (
      <svg viewBox="0 0 16 16" className="size-4 fill-[#5865F2]" aria-hidden="true">
        <path d="M12.7 3.2A11 11 0 0 0 10 2.5l-.2.4a10 10 0 0 1 2.5.8 12 12 0 0 0-8.6 0 10 10 0 0 1 2.5-.8L6 2.5a11 11 0 0 0-2.7.7C1.4 6.1.9 8.9 1.1 11.7a11 11 0 0 0 3.4 1.7l.7-1.1a7 7 0 0 1-1.1-.5l.3-.2a8 8 0 0 0 6.8 0l.3.2c-.3.2-.7.4-1.1.5l.7 1.1a11 11 0 0 0 3.4-1.7c.4-3.2-.5-6-1.8-8.5ZM6.1 10.3c-.7 0-1.2-.6-1.2-1.4s.5-1.4 1.2-1.4 1.2.6 1.2 1.4-.5 1.4-1.2 1.4Zm3.8 0c-.7 0-1.2-.6-1.2-1.4s.5-1.4 1.2-1.4 1.2.6 1.2 1.4-.5 1.4-1.2 1.4Z" />
      </svg>
    ),
  }
  return marks[id]
}
