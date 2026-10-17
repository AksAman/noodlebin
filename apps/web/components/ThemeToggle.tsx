"use client"

import { THEME_KEY } from "@/lib/theme"
import { cn } from "@/lib/ui"
import { useEffect, useState, type JSX } from "react"

type Choice = "system" | "light" | "dark"

const choices: Array<{ id: Choice; label: string; icon: JSX.Element }> = [
  {
    id: "system",
    label: "Match system theme",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
        <rect x="2" y="3" width="12" height="8.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6 13.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "light",
    label: "Light theme",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
        <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "dark",
    label: "Dark theme",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
        <path
          d="M13.2 9.6A5.5 5.5 0 0 1 6.4 2.8a5.5 5.5 0 1 0 6.8 6.8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
]

function apply(choice: Choice) {
  const root = document.documentElement
  if (choice === "system") root.removeAttribute("data-theme")
  else root.setAttribute("data-theme", choice)
}

export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("system")

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY)
      if (stored === "light" || stored === "dark") setChoice(stored)
    } catch {
      /* storage unavailable */
    }
  }, [])

  const select = (next: Choice) => {
    setChoice(next)
    apply(next)
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, next)
    } catch {
      /* storage unavailable */
    }
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="flex items-center rounded-full border border-line p-0.5">
      {choices.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={choice === c.id}
          aria-label={c.label}
          title={c.label}
          onClick={() => select(c.id)}
          className={cn(
            "grid size-7 cursor-pointer place-items-center rounded-full border-0 transition-colors duration-150",
            choice === c.id ? "bg-sunken text-fg" : "bg-transparent text-subtle hover:text-fg",
          )}
        >
          {c.icon}
        </button>
      ))}
    </div>
  )
}