"use client";

import { useServerSession } from "@/components/SessionProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/ui"
import { BRAND_NAME } from "@/lib/brand";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Mark() {
  return (
    <svg viewBox="0 0 34 16" aria-hidden="true" className="h-4 w-[34px]">
      {/* noodle link */}
      <path
        d="M4.5 4.5C13 4.5 15 11.5 23 11.5"
        fill="none"
        stroke="var(--tree-shader)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* output socket */}
      <circle cx="4.5" cy="4.5" r="3" fill="var(--accent)" />
      {/* bin body */}
      <rect x="21" y="9.5" width="6" height="5" fill="none" stroke="var(--tree-geometry)" strokeWidth="1.5" strokeLinejoin="round" />
      {/* bin rim */}
      <line x1="20" y1="9.5" x2="29" y2="9.5" stroke="var(--tree-geometry)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const { data: session } = useServerSession();
  const handle = session?.user.handle;
  const onOwnProfile = Boolean(handle) && (pathname === `/@${handle}` || pathname === `/author/${handle}`);
  const onGallery =
    !onOwnProfile &&
    (pathname === "/" ||
      pathname.startsWith("/@") ||
      pathname.startsWith("/author"));
  const items = [
    { href: "/", label: "Gallery", active: onGallery },
    { href: "/paste", label: "Paste", active: pathname === "/paste" },
    { href: "/addon", label: "Add-on", active: pathname === "/addon" },
  ];
  const renderLinks = () =>
    items.map((item) => (
      <Link
        key={item.href}
        className={cn(
          "rounded-md px-2.5 py-2 no-underline transition-colors duration-150 md:py-1.5",
          item.active ? "text-fg" : "text-muted hover:text-fg",
        )}
        aria-current={item.active ? "page" : undefined}
        href={item.href}
      >
        {item.label}
      </Link>
    ));
  return (
    <nav
      aria-label="Site"
      className="sticky top-0 z-10 shrink-0 border-b border-line bg-bg text-[14px]"
    >
      <div className="flex h-14 items-center gap-2 px-4 sm:px-8">
        <Link
          className="flex min-w-0 shrink-0 items-center gap-2 text-fg no-underline"
          href="/"
        >
          <Mark />
          <span className="font-display text-[17px] font-semibold tracking-[-0.02em] max-[23rem]:sr-only">
            {BRAND_NAME}
          </span>
        </Link>
        <div className="ml-3 hidden items-center md:flex">{renderLinks()}</div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {handle ? (
            <Link
              className={cn(
                "min-w-0 max-w-[6.5rem] truncate no-underline sm:max-w-[10rem] md:max-w-[14rem]",
                onOwnProfile ? "text-fg" : "text-muted hover:text-fg",
              )}
              href={`/@${handle}`}
              title={`@${handle}`}
              aria-current={onOwnProfile ? "page" : undefined}
            >
              @{handle}
            </Link>
          ) : (
            <Link
              className="shrink-0 rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-fg no-underline hover:border-fg"
              href="/sign-in"
              aria-current={pathname === "/sign-in" ? "page" : undefined}
            >
              Sign in
            </Link>
          )}
          <div className="shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-0.5 px-2 pb-2 sm:px-6 md:hidden">
        {renderLinks()}
      </div>
    </nav>
  );
}
