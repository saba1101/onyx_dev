import { createRequestHandler } from "react-router";

// @ts-expect-error - virtual module provided by @cloudflare/vite-plugin at build time
import * as serverBuild from "virtual:react-router/server-build";

const requestHandler = createRequestHandler(serverBuild, import.meta.env.MODE);

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
