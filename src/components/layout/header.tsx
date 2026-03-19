"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Search, Github, BookOpen, Menu, X, ShoppingCart } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { getCartId } from "@/lib/shop/cart";
import { medusa } from "@/lib/shop/client";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isShop = pathname?.startsWith("/shop");
  const [cartCount, setCartCount] = useState(0);

  const refreshCartCount = useCallback(async () => {
    const cartId = getCartId();
    if (!cartId) { setCartCount(0); return; }
    try {
      const data = await medusa.store.cart.retrieve(cartId);
      const items = (data as unknown as { cart: { items: { quantity: number }[] } }).cart?.items ?? [];
      setCartCount(items.reduce((sum, i) => sum + i.quantity, 0));
    } catch {
      setCartCount(0);
    }
  }, []);

  // Refresh cart count when on shop pages
  useEffect(() => {
    if (!isShop) return;
    refreshCartCount();
    // Listen for cart updates from other components
    const handler = () => refreshCartCount();
    window.addEventListener("cart-updated", handler);
    return () => window.removeEventListener("cart-updated", handler);
  }, [isShop, refreshCartCount, pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  return (
    <header className="z-50 w-full border-b bg-background/80 backdrop-blur-sm shrink-0">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <Image
            src="/logo.svg"
            alt="1tt.dev"
            width={28}
            height={28}
            className="rounded-md"
          />
          <span>1tt.dev</span>
        </Link>

        {/* Search bar — desktop */}
        <button
          onClick={() => document.dispatchEvent(new CustomEvent("open-tool-launcher"))}
          className="ml-4 hidden sm:flex flex-1 max-w-sm items-center gap-2 rounded-lg border border-input bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search tools...</span>
          <kbd className="pointer-events-none select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground inline-flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          {/* Search icon — mobile only */}
          <button
            onClick={() => document.dispatchEvent(new CustomEvent("open-tool-launcher"))}
            aria-label="Search tools"
            className="sm:hidden inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Cart icon — shop pages only */}
          {isShop && (
            <Link
              href="/shop/cart"
              aria-label="Shopping cart"
              className="relative inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
            >
              <ShoppingCart className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          )}

          {/* Desktop-only nav */}
          <Link
            href="/guides"
            aria-label="Guides"
            className="hidden sm:inline-flex items-center justify-center rounded-md text-sm font-medium h-8 w-8 hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
          >
            <BookOpen className="h-4 w-4" />
          </Link>
          <a
            href="https://github.com/n1rna/1tt"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            className="hidden sm:inline-flex items-center justify-center rounded-md text-sm font-medium h-8 w-8 hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
          >
            <Github className="h-4 w-4" />
          </a>
          <div className="hidden sm:block">
            <UserMenu />
          </div>

          {/* Theme toggle — always visible */}
          <ThemeToggle />

          {/* Burger menu — mobile only */}
          <div ref={menuRef} className="relative sm:hidden">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            {mobileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border bg-popover shadow-lg z-50">
                <div className="p-1">
                  <Link
                    href="/guides"
                    className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-md hover:bg-accent transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    Guides
                  </Link>
                  <a
                    href="https://github.com/n1rna/1tt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-md hover:bg-accent transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    <Github className="h-4 w-4 text-muted-foreground" />
                    GitHub
                  </a>
                </div>
                <div className="border-t p-1">
                  <UserMenu variant="inline" onNavigate={() => setMobileOpen(false)} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
