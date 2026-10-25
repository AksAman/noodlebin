import { getRequestSession } from "@/lib/auth"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/** Your account is your profile. This stays only so old links and sign-in callbacks land there. */
export default async function AccountRoute() {
  const session = await getRequestSession()
  if (!session?.user) redirect("/sign-in")
  const handle = session.user.handle
  redirect(handle ? `/@${handle}` : "/")
}
