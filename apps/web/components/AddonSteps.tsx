"use client"

import { capture } from "@/lib/analytics"
import { Kbd, useModKey } from "@/components/Keys"
import type { ReactNode } from "react"

export function AddonDownload({ className, href, children }: { className: string; href: string; children: ReactNode }) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer" onClick={() => capture("addon_downloaded")}>
      {children}
    </a>
  )
}

export function AddonSteps() {
  const mod = useModKey()
  const steps = [
    {
      title: "Install",
      body: (
        <>
          Open Edit › Preferences › Get Extensions, search for NodeVault, and install it. Blender offers newer versions
          from that same repository. A zip from GitHub is only a manual install.
        </>
      ),
    },
    {
      title: "Copy out",
      body: (
        <>
          Select nodes in any node editor and press <Kbd>{`${mod} ⇧ C`}</Kbd>. Paste them on NodeVault to view or share.
        </>
      ),
    },
    {
      title: "Paste in",
      body: (
        <>
          Hit Copy for Blender on any graph, then press <Kbd>{`${mod} ⇧ V`}</Kbd> in the matching editor. The NodeVault tab in
          the sidebar (<Kbd>N</Kbd>) has the same actions.
        </>
      ),
    },
  ]
  return (
    <ol className="mt-14 grid max-w-4xl list-none gap-x-8 gap-y-6 p-0 sm:grid-cols-3">
      {steps.map((step, i) => (
        <li key={step.title} className="border-t border-line-strong pt-4 text-[15px] leading-relaxed text-muted">
          <span className="mb-2 flex items-baseline gap-2.5">
            <span className="font-display text-[22px] font-medium text-accent-fg tabular-nums">{i + 1}</span>
            <span className="font-medium text-fg">{step.title}</span>
          </span>
          {step.body}
        </li>
      ))}
    </ol>
  )
}
