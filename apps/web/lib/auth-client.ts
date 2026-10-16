"use client"

import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        handle: { type: "string" },
      },
    }),
  ],
})

export type SocialProvider = "google" | "twitter" | "discord"

export const SOCIALS: { id: SocialProvider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "twitter", label: "X" },
  { id: "discord", label: "Discord" },
]
