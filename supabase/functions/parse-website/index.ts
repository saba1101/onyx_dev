// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function meta(html: string, name: string): string | null {
  const re = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]*content=["']([^"'<>]{1,600})["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"'<>]{1,600})["'][^>]*name=["']${name}["']`, "i"),
  ]
  for (const r of re) {
    const m = html.match(r)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

function og(html: string, prop: string): string | null {
  const re = [
    new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]*content=["']([^"'<>]{1,600})["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"'<>]{1,600})["'][^>]*property=["']og:${prop}["']`, "i"),
  ]
  for (const r of re) {
    const m = html.match(r)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

function tw(html: string, name: string): string | null {
  const re = [
    new RegExp(`<meta[^>]+name=["']twitter:${name}["'][^>]*content=["']([^"'<>]{1,600})["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"'<>]{1,600})["'][^>]*name=["']twitter:${name}["']`, "i"),
  ]
  for (const r of re) {
    const m = html.match(r)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

function count(html: string, tag: string): number {
  return (html.match(new RegExp(`<${tag}[\\s>]`, "gi")) ?? []).length
}

function detect_techs(html: string, headers: Headers): string[] {
  const h = html.toLowerCase()
  const server = (headers.get("server") ?? "").toLowerCase()
  const powered = (headers.get("x-powered-by") ?? "").toLowerCase()
  const techs: string[] = []

  if (h.includes("__next_data__") || h.includes("/_next/")) techs.push("Next.js")
  if (h.includes("__nuxt") || h.includes("/_nuxt/")) techs.push("Nuxt.js")
  if (h.includes("gatsby") && h.includes("gatsby-")) techs.push("Gatsby")
  if (h.includes("astro-island") || h.includes("/_astro/")) techs.push("Astro")
  if (h.includes("wp-content") || h.includes("wp-includes")) techs.push("WordPress")
  if (h.includes("cdn.shopify.com") || h.includes("shopify.theme")) techs.push("Shopify")
  if (h.includes("wixsite.com") || h.includes("wix-code")) techs.push("Wix")
  if (h.includes("squarespace-cdn") || h.includes("squarespace.com/assets")) techs.push("Squarespace")
  if (h.includes("webflow.com") || h.includes("wf-site")) techs.push("Webflow")
  if (!techs.some(t => ["Next.js","Nuxt.js","Gatsby","Astro"].includes(t)) && (h.includes("react-dom") || h.includes("__react"))) techs.push("React")
  if (h.includes("vue.js") || h.includes("vue.min.js") || h.includes("__vue_app__")) techs.push("Vue.js")
  if (h.includes("ng-version=") || h.includes("[ng-")) techs.push("Angular")
  if (h.includes("svelte") || h.includes("__svelte")) techs.push("Svelte")
  if (h.includes("bootstrap.min.css") || h.includes("bootstrap.css")) techs.push("Bootstrap")
  if (h.includes("tailwindcss") || h.includes("tailwind.css")) techs.push("Tailwind CSS")
  if (h.includes("jquery.min.js") || h.includes("jquery.js")) techs.push("jQuery")
  if (h.includes("googletagmanager.com") || h.includes("google-analytics.com") || h.includes("gtag/js")) techs.push("Google Analytics")
  if (h.includes("fonts.googleapis.com")) techs.push("Google Fonts")
  if (server.includes("nginx")) techs.push("Nginx")
  if (server.includes("apache")) techs.push("Apache")
  if (server.includes("cloudflare") || headers.get("cf-ray")) techs.push("Cloudflare")
  if (powered.includes("php")) techs.push("PHP")
  if (powered.includes("asp.net")) techs.push("ASP.NET")
  if (powered.includes("express")) techs.push("Express")
  if (headers.get("x-vercel-id") || h.includes("vercel.app")) techs.push("Vercel")
  if (headers.get("x-amzn-requestid") || headers.get("x-amz-cf-id")) techs.push("AWS")

  return [...new Set(techs)]
}

function detect_category(title: string | null, desc: string | null, og_type: string | null, keywords: string | null): string {
  const text = [title, desc, og_type, keywords].join(" ").toLowerCase()
  if (og_type === "article" || /\b(blog|news|article|post|journal|editorial)\b/.test(text)) return "Blog / News"
  if (og_type === "product" || /\b(shop|store|cart|buy now|checkout|add to cart|price)\b/.test(text)) return "E-commerce"
  if (/\b(docs|documentation|api reference|sdk|developer guide)\b/.test(text)) return "Documentation"
  if (/\b(portfolio|my work|case study|freelance|hire me|cv|resume)\b/.test(text)) return "Portfolio"
  if (/\b(saas|free trial|sign up|get started|dashboard|platform|software)\b/.test(text)) return "SaaS / App"
  if (/\b(agency|services|enterprise|consulting|solutions|company)\b/.test(text)) return "Business"
  if (/\b(university|school|course|learn|education|tutorial)\b/.test(text)) return "Education"
  return "Website"
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const { url } = await req.json()
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    const target = /^https?:\/\//i.test(url) ? url : `https://${url}`

    const start = Date.now()
    let res: Response
    try {
      res = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; OnyxInspector/1.0)",
          "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
      })
    } catch (e) {
      return new Response(JSON.stringify({ error: `Could not reach ${target}: ${String(e)}` }), {
        status: 422, headers: { ...CORS, "Content-Type": "application/json" },
      })
    }
    const time_ms = Date.now() - start

    const html = await res.text()
    const headers = res.headers

    // Title
    const title_m = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)
    const title = title_m?.[1]?.trim() ?? null

    // Lang + charset
    const lang_m  = html.match(/<html[^>]+lang=["']([a-z]{2,10}(?:-[a-z]{2,10})?)["']/i)
    const cs_m    = html.match(/charset=["']?([a-z0-9-]+)/i)

    // Favicon
    const fav_m = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i)
               ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i)

    // Canonical
    const can_m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
               ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)

    // Strip scripts/styles for word count
    const plain = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    const word_count = plain.split(/\s+/).filter(Boolean).length

    const description = meta(html, "description")
    const keywords    = meta(html, "keywords")
    const author      = meta(html, "author")
    const robots      = meta(html, "robots")
    const og_type     = og(html, "type")
    const techs       = detect_techs(html, headers)

    return new Response(JSON.stringify({
      url: target,
      final_url: res.url,
      status: res.status,
      time_ms,

      title,
      description,
      keywords,
      author,
      lang: lang_m?.[1] ?? null,
      charset: cs_m?.[1]?.toUpperCase() ?? null,
      favicon: fav_m?.[1] ?? null,
      canonical: can_m?.[1] ?? null,
      robots,

      og_title:       og(html, "title"),
      og_description: og(html, "description"),
      og_image:       og(html, "image"),
      og_type,
      og_site_name:   og(html, "site_name"),

      tw_card:        tw(html, "card"),
      tw_title:       tw(html, "title"),
      tw_description: tw(html, "description"),
      tw_image:       tw(html, "image"),

      server:       headers.get("server"),
      powered_by:   headers.get("x-powered-by"),
      content_type: headers.get("content-type"),

      https:   target.startsWith("https"),
      hsts:    !!headers.get("strict-transport-security"),
      x_frame: headers.get("x-frame-options"),
      csp:     !!headers.get("content-security-policy"),

      h1_count:     count(html, "h1"),
      h2_count:     count(html, "h2"),
      h3_count:     count(html, "h3"),
      link_count:   count(html, "a"),
      img_count:    count(html, "img"),
      script_count: count(html, "script"),
      word_count,

      techs,
      category: detect_category(title, description, og_type, keywords),
    }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
