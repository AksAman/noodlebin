"use client"

import { Dialog } from "@/components/Dialog"
import { btn, cn, field } from "@/lib/ui"
import { useEffect, useState } from "react"

function embedSnippet(origin: string, slug: string): string {
  return `<iframe src="${origin}/embed/${slug}" width="100%" height="480" style="border:0" title="NodeVault graph"></iframe>`
}

export function SharePost({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  const [origin, setOrigin] = useState("")
  const [copied, setCopied] = useState<"link" | "embed" | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const link = origin ? `${origin}/p/${slug}` : `/p/${slug}`
  const embed = origin ? embedSnippet(origin, slug) : ""

  async function copy(kind: "link" | "embed", text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const area = document.createElement("textarea")
      area.value = text
      area.setAttribute("readonly", "")
      area.style.position = "fixed"
      area.style.left = "-9999px"
      document.body.append(area)
      area.select()
      document.execCommand("copy")
      area.remove()
    }
    setCopied(kind)
  }

  return (
    <>
      <button type="button" className={btn} onClick={() => setOpen(true)}>
        Share
      </button>
      {open ? (
        <Dialog title="Share" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-4 px-5 py-5">
            <div>
              <p className="m-0 text-[13px] font-medium text-fg">Link</p>
              <div className="mt-1.5 flex gap-2">
                <input
                  className={cn(field, "bg-bg font-mono text-[12px]")}
                  readOnly
                  value={link}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <button type="button" className={btn} onClick={() => void copy("link", link)}>
                  {copied === "link" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <div>
              <p className="m-0 text-[13px] font-medium text-fg">Embed</p>
              <textarea
                className={cn(field, "mt-1.5 bg-bg font-mono text-[12px]")}
                readOnly
                rows={3}
                value={embed}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className={cn(btn, "mt-2")}
                onClick={() => void copy("embed", embed)}
                disabled={!embed}
              >
                {copied === "embed" ? "Copied" : "Copy embed"}
              </button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </>
  )
}
