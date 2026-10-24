import { usesPostgres } from "@/lib/db"
import { ensureSchema } from "@/lib/prisma"

export type PublicProfile = {
  id: string
  name: string
  handle: string
  image: string | null
}

/** The account behind a handle. Null in disk mode and when nobody has claimed it. */
export async function profileByHandle(handle: string): Promise<PublicProfile | null> {
  if (!usesPostgres() || !handle) return null
  const prisma = await ensureSchema()
  const user = await prisma.user.findUnique({
    where: { handle },
    select: { id: true, name: true, handle: true, image: true },
  })
  if (!user?.handle) return null
  return { id: user.id, name: user.name, handle: user.handle, image: user.image }
}
