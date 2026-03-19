"use client";

import { useEffect } from "react";
import { AuthGate } from "@/components/layout/auth-gate";
import { RedisStudioInner } from "@/components/account/redis-studio";
import { setTunnelExecutor, type RedisCommandResult } from "@/lib/redis";
import { queryTunnel } from "@/lib/tunnel";

function RedisTunnelStudioInner({ token }: { token: string }) {
  // Set the tunnel executor so all Redis commands go through the tunnel
  useEffect(() => {
    setTunnelExecutor(async (command: string[]): Promise<RedisCommandResult> => {
      try {
        const res = await queryTunnel(token, { command });
        return { result: res.result ?? res };
      } catch (err) {
        return { result: null, error: err instanceof Error ? err.message : "Tunnel command failed" };
      }
    });

    return () => {
      // Clean up on unmount so hosted Redis pages work normally
      setTunnelExecutor(null);
    };
  }, [token]);

  // Use "tunnel" as a fake dbId — it won't be used for API calls
  // since the tunnel executor intercepts everything
  return <RedisStudioInner dbId={`tunnel:${token}`} />;
}

export function RedisTunnelStudio({ token }: { token: string }) {
  return (
    <AuthGate>
      <RedisTunnelStudioInner token={token} />
    </AuthGate>
  );
}
