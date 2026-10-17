import { Noodle } from "@/components/Loader"

export default function Loading() {
  return (
    <div role="status" aria-label="Loading graph" data-theme="dark" className="flex h-dvh items-center justify-center bg-canvas">
      <Noodle size="lg" className="loader-reveal" />
    </div>
  )
}
