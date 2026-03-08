import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="1two.dev"
            width={20}
            height={20}
            className="rounded-sm"
          />
          <span className="font-semibold text-foreground">1two.dev</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>

        <nav className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms of Use
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link href="/support" className="hover:text-foreground transition-colors">
            Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}
