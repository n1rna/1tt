"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Script from "next/script";
import { Cookie } from "lucide-react";

const GA_ID = "G-C38Y0T4C5V";
const CONSENT_KEY = "cookie-consent";

type ConsentValue = "accepted" | "denied";

export function CookieConsent() {
  const [consent, setConsent] = useState<ConsentValue | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY) as ConsentValue | null;
    if (stored === "accepted" || stored === "denied") {
      setConsent(stored);
    } else {
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setConsent("accepted");
    setVisible(false);
  }

  function handleDeny() {
    localStorage.setItem(CONSENT_KEY, "denied");
    setConsent("denied");
    setVisible(false);
  }

  return (
    <>
      {consent === "accepted" && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}

      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[600px]"
          >
            <div className="bg-card/80 backdrop-blur-md border border-border rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <Cookie className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground leading-snug">
                  We use{" "}
                  <span className="text-foreground font-medium">
                    Google Analytics
                  </span>{" "}
                  for anonymous usage stats to improve our tools. No personal
                  data is collected.
                </p>
              </div>
              <div className="flex gap-2 shrink-0 sm:ml-2">
                <button
                  onClick={handleDeny}
                  className="flex-1 sm:flex-none text-sm px-4 py-1.5 rounded-lg border border-input hover:bg-accent transition-colors cursor-pointer"
                >
                  Deny
                </button>
                <button
                  onClick={handleAccept}
                  className="flex-1 sm:flex-none text-sm px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Accept
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
