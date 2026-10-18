import { cn } from "@/lib/ui"

/** Still covers stay images. An MP4 cover plays in place, muted, so a gallery card can show motion. */
export function CoverMedia({
  url,
  video = false,
  className,
  autoPlay = false,
}: {
  url: string
  video?: boolean
  className?: string
  autoPlay?: boolean
}) {
  if (video) {
    return (
      <video
        className={cn("bg-sunken", className)}
        src={url}
        muted
        playsInline
        loop={autoPlay}
        autoPlay={autoPlay}
        controls={!autoPlay}
        preload="metadata"
      />
    )
  }
  return <img className={className} src={url} alt="" loading="lazy" />
}
