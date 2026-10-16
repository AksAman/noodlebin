import { cn } from "@/lib/ui"
import Link from "next/link"

export function AuthorCredit({
  name,
  slug,
  className,
}: {
  name: string
  slug: string | null
  className?: string
}) {
  if (!slug) return <span className={className}>{name}</span>
  return (
    <Link className={cn("text-fg underline-offset-4 hover:underline", className)} href={`/@${slug}`}>
      {name}
    </Link>
  )
}
