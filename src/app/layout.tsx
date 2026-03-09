import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { QueryProvider } from "@/components/layout/query-provider";
import { ToolLauncher } from "@/components/layout/tool-launcher";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CookieConsent } from "@/components/layout/cookie-consent";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://1two.dev";

export const metadata: Metadata = {
  title: {
    default: "1two.dev — Tools that just work",
    template: "%s — 1two.dev",
  },
  description:
    "The tools you actually need — JWT parser, JSON formatter, Base64 encoder, diff viewer, cron builder, timestamp converter, color picker, UUID generator, DNS lookup, and more. Free, fast, no sign-up.",
  metadataBase: new URL(SITE_URL),
  keywords: [
    "developer tools",
    "online tools",
    "web tools",
    "devtools",
    "jwt decoder",
    "json formatter",
    "base64 encoder",
    "diff tool",
    "cron builder",
    "timestamp converter",
    "uuid generator",
    "color palette",
    "keyboard tester",
    "webcam test",
    "microphone test",
    "markdown editor",
  ],
  authors: [{ name: "1two.dev" }],
  creator: "1two.dev",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "1two.dev",
    title: "1two.dev — Tools that just work",
    description:
      "The tools you actually need — JWT parser, JSON formatter, Base64 encoder, diff viewer, cron builder, timestamp converter, color picker, UUID generator, DNS lookup, and more. Free, fast, no sign-up.",
  },
  twitter: {
    card: "summary_large_image",
    title: "1two.dev — Tools that just work",
    description:
      "The tools you actually need — free, fast, no sign-up. JWT parser, JSON formatter, Base64 encoder, diff viewer, cron builder, and more.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <TooltipProvider>
              <ToolLauncher />
              <div className="flex flex-col h-screen">
                <Header />
                <main className="flex-1 min-h-0 overflow-y-scroll">
                  {children}
                </main>
                <Footer />
              </div>
              <CookieConsent />
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
