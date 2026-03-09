"use client";

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: TurnstileOptions
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string | undefined;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileOptions {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "invisible" | "flexible";
  appearance?: "always" | "execute" | "interaction-only";
  execution?: "render" | "execute";
  callback?: (token: string) => void;
  "error-callback"?: (error: unknown) => void;
  "expired-callback"?: () => void;
}

interface TurnstileProps {
  siteKey: string;
  onToken: (token: string) => void;
  onError?: (error: unknown) => void;
  onExpired?: () => void;
  /** @default "auto" */
  theme?: "light" | "dark" | "auto";
  /** @default "invisible" */
  size?: "normal" | "compact" | "invisible" | "flexible";
}

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";

function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve();
      return;
    }

    const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
    if (existing) {
      // Script already injected — wait for onload callback
      const prev = window.onTurnstileLoad;
      window.onTurnstileLoad = () => {
        prev?.();
        resolve();
      };
      return;
    }

    window.onTurnstileLoad = resolve;

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Renders a Cloudflare Turnstile widget in managed/invisible mode.
 * The widget auto-solves and calls `onToken` with the resulting token.
 * Call the `reset()` function returned via ref to get a fresh token.
 */
export function Turnstile({ siteKey, onToken, onError, onExpired, theme = "auto", size = "invisible" }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const initWidget = useCallback(async () => {
    if (!containerRef.current) return;
    await loadTurnstileScript();
    if (!window.turnstile || !containerRef.current) return;

    // Remove existing widget if re-initialising
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        // ignore
      }
      widgetIdRef.current = null;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme,
      size,
      appearance: size === "invisible" ? "interaction-only" : "always",
      callback: onToken,
      "error-callback": onError,
      "expired-callback": onExpired,
    });
  }, [siteKey, theme, size, onToken, onError, onExpired]);

  useEffect(() => {
    initWidget();
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} />;
}

/**
 * Hook that manages Turnstile state and exposes a `getToken()` helper.
 * Usage: const { widgetRef, token, resetTurnstile } = useTurnstile()
 */
export function useTurnstile() {
  const tokenRef = useRef<string | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToken = useCallback((token: string) => {
    tokenRef.current = token;
  }, []);

  const handleExpired = useCallback(() => {
    tokenRef.current = null;
  }, []);

  /** Returns the current token, waiting up to `timeoutMs` ms for one to arrive. */
  const getToken = useCallback(
    (timeoutMs = 15_000): Promise<string> => {
      return new Promise((resolve, reject) => {
        if (tokenRef.current) {
          resolve(tokenRef.current);
          return;
        }
        const start = Date.now();
        const poll = setInterval(() => {
          if (tokenRef.current) {
            clearInterval(poll);
            resolve(tokenRef.current);
          } else if (Date.now() - start > timeoutMs) {
            clearInterval(poll);
            reject(new Error("Turnstile token timeout"));
          }
        }, 100);
      });
    },
    []
  );

  const reset = useCallback(() => {
    tokenRef.current = null;
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        // ignore
      }
    }
  }, []);

  return {
    containerRef,
    widgetIdRef,
    handleToken,
    handleExpired,
    getToken,
    reset,
  };
}
