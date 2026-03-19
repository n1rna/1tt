import { Container, getContainer } from "@cloudflare/containers";
import { DurableObject } from "cloudflare:workers";

interface Env {
  API_CONTAINER: DurableObjectNamespace<ApiContainer>;
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const stub = getContainer(env.API_CONTAINER);

    // Ensure the container is running before forwarding
    try {
      await stub.startAndWaitForPorts();
    } catch (e) {
      return new Response(`Container startup failed: ${e}`, { status: 503 });
    }

    return stub.fetch(request);
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const stub = getContainer(env.API_CONTAINER);

    try {
      await stub.startAndWaitForPorts();
    } catch (e) {
      console.error("Cleanup: container startup failed:", e);
      return;
    }

    const res = await stub.fetch(
      new Request("http://internal/api/v1/internal/cleanup", {
        method: "POST",
        headers: { "X-Internal-Secret": env.INTERNAL_SECRET ?? "" },
      })
    );

    const body = await res.text();
    console.log(`Cleanup: ${res.status} ${body}`);
  },
};
