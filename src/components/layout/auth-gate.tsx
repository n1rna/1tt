"use client";

import { useSession, signIn } from "@/lib/auth-client";
import { Github, Chrome, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <>{children}</>;
  }

  if (!session) {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none opacity-40 blur-[2px]">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-lg max-w-sm text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Sign in required</h3>
              <p className="text-xs text-muted-foreground mt-1">
                This tool requires an account. Sign in to get started.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => signIn.social({ provider: "github" })}
              >
                <Github className="h-4 w-4" />
                Continue with GitHub
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => signIn.social({ provider: "google" })}
              >
                <Chrome className="h-4 w-4" />
                Continue with Google
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
