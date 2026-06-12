import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr"

const get_env = (key: "SUPABASE_URL" | "SUPABASE_ANON_KEY"): string => {
  // Prefer Cloudflare bindings (set per-request in workers/app.ts),
  // fall back to process.env for local Node.js dev.
  return globalThis.__cf_env?.[key] ?? process.env[key] ?? ""
}

export const get_supabase = (request: Request) => {
  const headers = new Headers()

  const supabase = createServerClient(
    get_env("SUPABASE_URL"),
    get_env("SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("Cookie") ?? "").map(
            (cookie) => ({ name: cookie.name, value: cookie.value ?? "" })
          )
        },
        setAll(cookies) {
          for (const { name, value, options } of cookies) {
            headers.append("Set-Cookie", serializeCookieHeader(name, value, options))
          }
        },
      },
    }
  )

  return { supabase, headers }
}
