import { AddonDownload, AddonSteps } from "@/components/AddonSteps"
import { addon } from "@/lib/addon"
import { BRAND_NAME } from "@/lib/brand"
import { btnAccent, cn, docShell, page } from "@/lib/ui"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: `Get the Blender add-on · ${BRAND_NAME}`,
  description: `Install the ${BRAND_NAME} add-on to copy node trees out of Blender and paste them back in.`,
}

export default function AddonRoute() {
  return (
    <div className={docShell}>
      <div className={cn(page, "pb-20 pt-14 sm:pt-20")}>
        <h1 className="m-0 max-w-[16ch] font-display text-[clamp(2.5rem,1.6rem+3.6vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-fg">
          Get the Blender add-on.
        </h1>
        <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-muted">
          {BRAND_NAME} is two halves: this site, and a small add-on that copies node trees out of Blender and pastes them back in
          with their values, links, frames, and groups. Works in Blender {addon.minBlender} and newer.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <AddonDownload className={cn(btnAccent, "px-5 py-3 text-[15px]")} href={addon.extensionsUrl}>
            Install from Blender Extensions
          </AddonDownload>
          <span className="text-[13px] text-subtle">
            Search for {BRAND_NAME} in Get Extensions. That install is the one Blender updates.
          </span>
        </div>
        <p className="mt-4 text-[13px] text-subtle">
          Manual zip:{" "}
          <a className="text-muted underline-offset-4 hover:underline" href={addon.releasesUrl}>
            GitHub Releases
          </a>
          . Install from Disk does not receive updates.
        </p>

        <AddonSteps />

        <p className="mt-12 text-[14px] text-muted">
          Installed?{" "}
          <Link className="text-accent-fg underline-offset-4 hover:underline" href="/">
            Find a graph to steal
          </Link>{" "}
          or{" "}
          <Link className="text-accent-fg underline-offset-4 hover:underline" href="/paste">
            paste one of yours
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
