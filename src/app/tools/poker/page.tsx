import type { Metadata } from "next";
import { PokerLanding } from "@/components/tools/poker-landing";

export const metadata: Metadata = {
  title: "Planning Poker — 1tt.dev",
  description:
    "Real-time planning poker for agile teams. Create or join a session to vote on story sizes together using Fibonacci, T-shirt, or custom scales.",
  keywords: [
    "planning poker",
    "agile",
    "scrum",
    "story points",
    "estimation",
    "sprint planning",
    "fibonacci",
    "team velocity",
  ],
};

export default function PokerPage() {
  return (
    <>
      <style>{`body { overflow: hidden; } footer { display: none; }`}</style>
      <PokerLanding />
    </>
  );
}
