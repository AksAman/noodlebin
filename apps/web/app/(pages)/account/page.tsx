import { AccountPanel } from "@/components/AccountPanel"
import { getRequestSession } from "@/lib/auth"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function AccountRoute() {
  const session = await getRequestSession()
  if (!session?.user) redirect("/sign-in")
  return <AccountPanel />
}
