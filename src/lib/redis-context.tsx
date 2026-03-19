"use client";

import { createContext, useContext } from "react";
import type { RedisCommandResult } from "./redis";

export interface RedisExecutor {
  executeCommand: (id: string, command: string[]) => Promise<RedisCommandResult>;
  executePipeline: (id: string, commands: string[][]) => Promise<RedisCommandResult[]>;
  getRedisInfo: (id: string) => Promise<RedisCommandResult>;
}

const RedisExecutorContext = createContext<RedisExecutor | null>(null);

export function RedisExecutorProvider({
  executor,
  children,
}: {
  executor: RedisExecutor;
  children: React.ReactNode;
}) {
  return (
    <RedisExecutorContext.Provider value={executor}>
      {children}
    </RedisExecutorContext.Provider>
  );
}

export function useRedisExecutor(): RedisExecutor {
  const ctx = useContext(RedisExecutorContext);
  if (!ctx) {
    throw new Error("useRedisExecutor must be used within a RedisExecutorProvider");
  }
  return ctx;
}
