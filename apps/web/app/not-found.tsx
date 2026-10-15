import { cn, shell } from "@/lib/ui"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className={cn(shell, "h-auto min-h-full")}>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[radial-gradient(circle,#4e4e4e_1.5px,#171717_2px)] bg-[size:40px_40px] p-8">
        <p className="max-w-md text-center text-xl leading-snug">Nothing at this URL.</p>
        <Link className="text-[#ccc]" href="/">
          Gallery
        </Link>
      </div>
    </div>
  )
}
