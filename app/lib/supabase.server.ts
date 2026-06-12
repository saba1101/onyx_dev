import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr"

export const get_supabase = (request: Request) => {
  const headers = new Headers()

  const supabase = createServerClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_ANON_KEY ?? "",
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
