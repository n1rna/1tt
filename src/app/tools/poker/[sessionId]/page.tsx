import type { Metadata } from "next";
import { PokerSession } from "@/components/tools/poker-session";

export const metadata: Metadata = {
  title: "Planning Poker Session — 1tt.dev",
  description: "Real-time planning poker session. Vote on story points with your team.",
};

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function PokerSessionPage({ params }: Props) {
  const { sessionId } = await params;
  return (
    <>
      <style>{`body { overflow: hidden; } footer { display: none; }`}</style>
      <PokerSession sessionId={sessionId} />
    </>
  );
}
