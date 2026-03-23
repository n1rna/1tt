import { Container, getContainer } from "@cloudflare/containers";
import { DurableObject } from "cloudflare:workers";

interface Env {
  API_CONTAINER: DurableObjectNamespace<ApiContainer>;
  SCHEDULER_QUEUE: Queue;
  DATABASE_URL: string;
  ALLOWED_ORIGINS: string;
  TURNSTILE_SECRET_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  INTERNAL_SECRET: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  LLM_API_KEY: string;
  LLM_PROVIDER: string;
  LLM_BASE_URL: string;
  LLM_MODEL: string;
  POLAR_ACCESS_TOKEN: string;
  POLAR_WEBHOOK_SECRET: string;
  POLAR_ORGANIZATION_ID: string;
  POLAR_ENVIRONMENT: string;
  POLAR_PRO_PRODUCT_ID: string;
  POLAR_MAX_PRODUCT_ID: string;
  NEON_API_KEY: string;
  NEON_ORG_ID: string;
  TURSO_API_TOKEN: string;
  TURSO_ORG_SLUG: string;
  TURSO_GROUP: string;
  TUNNEL_PUBLIC_URL: string;
  UPSTASH_EMAIL: string;
  UPSTASH_API_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  EMAIL_WEBHOOK_SECRET: string;
  EMAIL_WORKER_URL: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
}

// Message types that the container can process.
interface InternalMessage {
  type: string;
  data?: unknown;
}

export class ApiContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "5m";
  enableInternet = true;

  constructor(ctx: DurableObject["ctx"], env: Env) {
    super(ctx, env);
    this.envVars = {
      DATABASE_URL: env.DATABASE_URL ?? "",
      ALLOWED_ORIGINS: env.ALLOWED_ORIGINS ?? "",
      TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY ?? "",
      R2_ACCOUNT_ID: env.R2_ACCOUNT_ID ?? "",
      R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID ?? "",
      R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY ?? "",
      R2_BUCKET_NAME: env.R2_BUCKET_NAME ?? "",
      INTERNAL_SECRET: env.INTERNAL_SECRET ?? "",
      CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID ?? "",
      CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN ?? "",
      LLM_API_KEY: env.LLM_API_KEY ?? "",
      LLM_PROVIDER: env.LLM_PROVIDER ?? "",
      LLM_BASE_URL: env.LLM_BASE_URL ?? "",
      LLM_MODEL: env.LLM_MODEL ?? "",
      POLAR_ACCESS_TOKEN: env.POLAR_ACCESS_TOKEN ?? "",
      POLAR_WEBHOOK_SECRET: env.POLAR_WEBHOOK_SECRET ?? "",
      POLAR_ORGANIZATION_ID: env.POLAR_ORGANIZATION_ID ?? "",
      POLAR_ENVIRONMENT: env.POLAR_ENVIRONMENT ?? "",
      POLAR_PRO_PRODUCT_ID: env.POLAR_PRO_PRODUCT_ID ?? "",
      POLAR_MAX_PRODUCT_ID: env.POLAR_MAX_PRODUCT_ID ?? "",
      NEON_API_KEY: env.NEON_API_KEY ?? "",
      NEON_ORG_ID: env.NEON_ORG_ID ?? "",
      TURSO_API_TOKEN: env.TURSO_API_TOKEN ?? "",
      TURSO_ORG_SLUG: env.TURSO_ORG_SLUG ?? "",
      TURSO_GROUP: env.TURSO_GROUP ?? "",
      TUNNEL_PUBLIC_URL: env.TUNNEL_PUBLIC_URL ?? "",
      UPSTASH_EMAIL: env.UPSTASH_EMAIL ?? "",
      UPSTASH_API_KEY: env.UPSTASH_API_KEY ?? "",
      TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN ?? "",
      TELEGRAM_WEBHOOK_SECRET: env.TELEGRAM_WEBHOOK_SECRET ?? "",
      EMAIL_WEBHOOK_SECRET: env.EMAIL_WEBHOOK_SECRET ?? "",
      EMAIL_WORKER_URL: env.EMAIL_WORKER_URL ?? "https://1tt-email-inbound.1twodev.workers.dev",
      RESEND_API_KEY: env.RESEND_API_KEY ?? "",
      RESEND_FROM_EMAIL: env.RESEND_FROM_EMAIL ?? "1tt Life <life@1tt.dev>",
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID ?? "",
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET ?? "",
      GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI ?? "",
      PORT: "8080",
    };
  }

  override onStart() {
    console.log("API container started");
  }

  override onStop() {
    console.log("API container stopped");
  }

  override onError(error: unknown) {
    console.error("API container error:", error);
  }
}

/** Send a typed message to the Go container. */
async function sendMessage(
  stub: Container<Env>,
  secret: string,
  msg: InternalMessage
): Promise<Response> {
  return stub.fetch(
    new Request("http://internal/api/v1/internal/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify(msg),
    })
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const stub = getContainer(env.API_CONTAINER);

    try {
      await stub.startAndWaitForPorts();
    } catch (e) {
      return new Response(`Container startup failed: ${e}`, { status: 503 });
    }

    return stub.fetch(request);
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const stub = getContainer(env.API_CONTAINER);

    try {
      await stub.startAndWaitForPorts();
    } catch (e) {
      console.error("Scheduled: container startup failed:", e);
      return;
    }

    const secret = env.INTERNAL_SECRET ?? "";

    // Daily cleanup at 3 AM UTC
    if (event.cron === "0 3 * * *") {
      const res = await sendMessage(stub, secret, { type: "cleanup" });
      console.log(`Cleanup: ${res.status} ${await res.text()}`);
    }

    // Life scheduler every 15 minutes — check which cycles are due and enqueue them
    if (event.cron === "*/15 * * * *") {
      const res = await sendMessage(stub, secret, {
        type: "life_scheduler_check",
      });

      if (!res.ok) {
        console.error(`Scheduler check failed: ${res.status} ${await res.text()}`);
        return;
      }

      const body = (await res.json()) as {
        cycles: { user_id: string; cycle: string }[];
      };
      const cycles = body.cycles ?? [];

      if (cycles.length === 0) {
        console.log("Scheduler: no cycles due");
        return;
      }

      // Enqueue each user/cycle as a separate queue message
      for (const cycle of cycles) {
        await env.SCHEDULER_QUEUE.send({
          type: "life_scheduler_run",
          data: { user_id: cycle.user_id, cycle: cycle.cycle },
        });
      }

      console.log(`Scheduler: enqueued ${cycles.length} cycle(s)`);
    }
  },

  // Queue consumer — processes one message at a time
  async queue(
    batch: MessageBatch<InternalMessage>,
    env: Env
  ): Promise<void> {
    const stub = getContainer(env.API_CONTAINER);

    try {
      await stub.startAndWaitForPorts();
    } catch (e) {
      console.error("Queue: container startup failed:", e);
      batch.retryAll();
      return;
    }

    const secret = env.INTERNAL_SECRET ?? "";

    for (const msg of batch.messages) {
      try {
        const res = await sendMessage(stub, secret, msg.body);
        const text = await res.text();

        if (res.ok) {
          console.log(`Queue [${msg.body.type}]: ${res.status} ${text}`);
          msg.ack();
        } else {
          console.error(`Queue [${msg.body.type}]: ${res.status} ${text}`);
          msg.retry();
        }
      } catch (e) {
        console.error(`Queue [${msg.body.type}]: error:`, e);
        msg.retry();
      }
    }
  },
};
