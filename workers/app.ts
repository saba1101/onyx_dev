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

const requestHandler = createRequestHandler(serverBuild, import.meta.env.MODE);

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Cloudflare Workers don't auto-populate process.env from bindings,
    // so we do it manually here before the request handler runs.
    process.env.SUPABASE_URL = env.SUPABASE_URL;
    process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;

    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
