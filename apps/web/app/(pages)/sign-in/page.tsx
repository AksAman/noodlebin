import { SignInPanel } from "@/components/SignInPanel"
import { getRequestSession } from "@/lib/auth"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Sign in · NodeVault",
  description: "Sign in to credit graphs to your handle.",
}

export default async function SignInRoute() {
  const session = await getRequestSession()
  if (session?.user) redirect("/account")
  return <SignInPanel />
}
