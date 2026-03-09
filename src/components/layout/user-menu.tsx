"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { SignInDialog } from "./sign-in-dialog";

export function UserMenu() {
  const { data: session, isPending } = useSession();
  const [signInOpen, setSignInOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (isPending) {
    return (
      <Button variant="outline" size="sm" disabled>
        <User className="h-3.5 w-3.5" />
      </Button>
    );
  }

  if (!session) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setSignInOpen(true)}>
          Sign in
        </Button>
        <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
      </>
    );
  }

  const user = session.user;

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center justify-center h-8 w-8 rounded-full overflow-hidden border hover:ring-2 hover:ring-ring transition-all"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt={user.name || ""} className="h-8 w-8 object-cover" />
        ) : (
          <User className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border bg-popover shadow-lg z-50">
          <div className="px-3 py-2 border-b">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <div className="p-1">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-destructive"
              onClick={() => { signOut(); setMenuOpen(false); }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
