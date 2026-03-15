"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession, signIn } from "@/lib/auth-client";
import { Github } from "lucide-react";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function LoginContent() {
  const { data: session, isPending } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirect = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (session && !isPending) {
      router.replace(redirect);
    }
  }, [session, isPending, redirect, router]);

  if (isPending || session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full px-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">Sign in to 1two.dev</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Sign in to access your account, sync preferences, and unlock all tools.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            className="flex items-center justify-center gap-3 w-full px-4 py-2.5 text-sm font-medium rounded-lg border bg-card hover:bg-accent transition-colors"
            onClick={() => signIn.social({ provider: "github", callbackURL: redirect })}
          >
            <Github className="h-5 w-5" />
            Continue with GitHub
          </button>
          <button
            className="flex items-center justify-center gap-3 w-full px-4 py-2.5 text-sm font-medium rounded-lg border bg-card hover:bg-accent transition-colors"
            onClick={() => signIn.social({ provider: "google", callbackURL: redirect })}
          >
            <GoogleIcon className="h-5 w-5" />
            Continue with Google
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground/60 text-center">
          By continuing, you agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
