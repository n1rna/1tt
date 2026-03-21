"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();

  // Hide footer entirely on full-screen pages
  const isFullScreen = /^\/account\/(postgres|redis|sqlite|storage|elasticsearch)\/[^/]+/.test(pathname);
  if (isFullScreen) return null;

  const isToolPage = pathname.startsWith("/tools/");

  if (isToolPage) {
    return (
      <footer className="border-t shrink-0">
        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground/60">
          <div className="flex items-center gap-1.5">
            <Image
              src="/logo.svg"
              alt="1tt.dev"
              width={12}
              height={12}
              className="rounded-sm opacity-60"
            />
            <span>1tt.dev</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/terms" className="hover:text-muted-foreground transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-muted-foreground transition-colors">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="1tt.dev"
            width={20}
            height={20}
            className="rounded-sm"
          />
          <span className="font-semibold text-foreground">1tt.dev</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>

        <nav className="flex items-center gap-4">
          <Link href="/shop" className="hover:text-foreground transition-colors">
            Shop
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms of Use
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
