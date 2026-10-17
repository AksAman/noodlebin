import { SignInPanel } from "@/components/SignInPanel"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Sign in · NodeVault",
  description: "Sign in to credit graphs to your handle.",
}

export default function SignInRoute() {
  return <SignInPanel />
}
