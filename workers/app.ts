import { createRequestHandler } from "react-router";

// @ts-expect-error - virtual module provided by @cloudflare/vite-plugin at build time
import * as serverBuild from "virtual:react-router/server-build";

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __cf_env: Env | undefined;
}

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

const requestHandler = createRequestHandler(serverBuild, import.meta.env.MODE);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Make Cloudflare bindings available to server-side modules (e.g. supabase.server.ts)
    // that can't access the load context directly.
    globalThis.__cf_env = env;

    try {
      return await requestHandler(request, { cloudflare: { env, ctx } });
    } catch (error) {
      console.error("[worker] unhandled error:", error);
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
