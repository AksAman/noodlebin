import { PageLoader } from "@/components/Loader"
import { docShell } from "@/lib/ui"

export default function Loading() {
  return (
    <div className={docShell}>
      <PageLoader className="min-h-[60vh]" />
    </div>
  )
}
