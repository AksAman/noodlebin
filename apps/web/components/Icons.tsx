import type { ReactNode } from "react"

function Icon({ className, children }: { className?: string | undefined; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className ?? "size-3.5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export function ShareIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M8 10V2.5M5 5l3-3 3 3" />
      <path d="M3 9v3.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V9" />
    </Icon>
  )
}

export function EditIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M10.5 3.5l2 2M2.5 13.5l.5-2.8 7.7-7.7a1.4 1.4 0 0 1 2 0l.6.6a1.4 1.4 0 0 1 0 2L5.3 13l-2.8.5z" />
    </Icon>
  )
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M2.5 4.5h11M6 4.5V3a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1.5M4 4.5l.6 8a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8M6.75 7v4M9.25 7v4" />
    </Icon>
  )
}
