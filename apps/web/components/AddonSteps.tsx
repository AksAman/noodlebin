"use client"

import { Kbd, useModKey } from "@/components/Keys"

export function AddonSteps() {
  const mod = useModKey()
  const steps = [
    {
      title: "Install",
      body: (
        <>
          Drag the zip into any Blender window. Or open Edit › Preferences › Get Extensions, use the ⌄ menu in the top right,
          and pick Install from Disk.
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
