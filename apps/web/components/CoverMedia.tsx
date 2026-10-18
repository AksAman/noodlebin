import { cn } from "@/lib/ui"

/** Still covers stay images. An MP4 cover plays muted, with no player chrome. */
export function CoverMedia({
  url,
  video = false,
  className,
}: {
  url: string
  video?: boolean
  className?: string
}) {
  if (video) {
    return (
      <video
        className={cn("pointer-events-none bg-sunken", className)}
        src={url}
        muted
        playsInline
        loop
        autoPlay
        preload="metadata"
      />
    )
  }
  return <img className={className} src={url} alt="" loading="lazy" />
}
