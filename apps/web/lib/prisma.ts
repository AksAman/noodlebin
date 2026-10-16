import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"
import { env } from "@/env"
import { schemaStatements } from "@/lib/schemaSql"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; schema?: Promise<void> }

export function getPrisma(): PrismaClient {
  const url = env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set.")
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    })
  }
  return globalForPrisma.prisma
}

/** Creates the posts and auth tables when this database does not have them yet. */
export async function ensureSchema(): Promise<PrismaClient> {
  const prisma = getPrisma()
  if (!globalForPrisma.schema) {
    globalForPrisma.schema = (async () => {
      for (const statement of schemaStatements) {
        await prisma.$executeRawUnsafe(statement)
      }
    })()
  }
  await globalForPrisma.schema
  return prisma
}
