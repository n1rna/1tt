"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  KeyRound,
  Braces,
  Binary,
  GitCompareArrows,
  ArrowLeft,
} from "lucide-react";
import { BackgroundBeams } from "@/components/ui/background-beams";

const FEATURED_TOOLS = [
  { slug: "jwt", name: "JWT Parser", Icon: KeyRound },
  { slug: "json", name: "JSON Tool", Icon: Braces },
  { slug: "b64", name: "Base64", Icon: Binary },
  { slug: "diff", name: "Diff Tool", Icon: GitCompareArrows },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-4">
      <BackgroundBeams />

      <motion.div
        className="relative z-10 flex flex-col items-center gap-5 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* 404 hero */}
        <motion.div variants={itemVariants} className="select-none">
          <span
            className="block font-sans text-[clamp(5rem,18vw,9rem)] font-bold leading-none tracking-tighter"
            style={{
              background:
                "linear-gradient(135deg, var(--foreground) 0%, var(--muted-foreground) 60%, var(--foreground) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter:
                "drop-shadow(0 0 40px color-mix(in srgb, var(--primary) 20%, transparent))",
            }}
          >
            404
          </span>
        </motion.div>

        {/* Subtitle */}
        <motion.div variants={itemVariants} className="flex flex-col gap-1">
          <p className="font-sans text-lg font-semibold text-foreground">
            This tool doesn&apos;t exist&hellip; yet.
          </p>
          <p className="font-sans text-sm text-muted-foreground">
            Try one of these instead, or press{" "}
            <kbd className="inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
              <span className="text-xs">&#8984;</span>P
            </kbd>{" "}
            to search.
          </p>
        </motion.div>

        {/* Featured tools — compact inline list */}
        <motion.div
          variants={itemVariants}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {FEATURED_TOOLS.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-sm backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-accent/60"
            >
              <tool.Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-medium text-foreground">{tool.name}</span>
            </Link>
          ))}
        </motion.div>

        {/* Go home link */}
        <motion.div variants={itemVariants}>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-sans text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
