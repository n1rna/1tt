import { Container, getContainer } from "@cloudflare/containers";

interface Env {
  API_CONTAINER: DurableObjectNamespace<ApiContainer>;
  DATABASE_URL: string;
  ALLOWED_ORIGINS: string;
  TURNSTILE_SECRET_KEY: string;
}

export class ApiContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "5m";
  enableInternet = true;

  override get envVars() {
    return {
      DATABASE_URL: this.env.DATABASE_URL ?? "",
      ALLOWED_ORIGINS: this.env.ALLOWED_ORIGINS ?? "",
      TURNSTILE_SECRET_KEY: this.env.TURNSTILE_SECRET_KEY ?? "",
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
};
