import Link from "next/link"

export default function NotFound() {
  return (
    <div className="app page">
      <div className="empty">
        <p className="empty-copy">Nothing at this URL.</p>
        <Link href="/">Gallery</Link>
      </div>
    </div>
  )
}
