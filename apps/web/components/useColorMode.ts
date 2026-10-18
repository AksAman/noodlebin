"use client"

import { useEffect, useState } from "react"

/** Light or dark, following the site theme toggle and the system preference. */
export function useColorMode(): "light" | "dark" | undefined {
  const [mode, setMode] = useState<"light" | "dark" | undefined>(undefined)

  useEffect(() => {
    const update = () => {
      const explicit = document.documentElement.getAttribute("data-theme")
      if (explicit === "light" || explicit === "dark") {
        setMode(explicit)
        return
      }
      setMode(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    }
    update()
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", update)
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
    return () => {
      media.removeEventListener("change", update)
      observer.disconnect()
    }
  }, [])

  return mode
}
