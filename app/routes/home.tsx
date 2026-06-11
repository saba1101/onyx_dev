import type { Route } from "./+types/home"

export const meta = ({}: Route.MetaArgs) => [
  { title: "Onyx Dev" },
  { name: "description", content: "Onyx Dev" },
]

const swatches = [
  { name: "watermelon", className: "bg-watermelon" },
  { name: "royal-gold", className: "bg-royal-gold" },
  { name: "mint-cream", className: "bg-mint-cream" },
  { name: "ink-black", className: "bg-ink-black" },
  { name: "charcoal-blue", className: "bg-charcoal-blue" },
]

const Home = () => {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold text-primary">Onyx Dev</h1>
      <p className="mt-2 text-muted">Toggle the theme from the bottom-right.</p>

      <div className="mt-8 rounded-2xl border border-line bg-card p-6">
        <h2 className="text-lg font-semibold">Palette</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {swatches.map((swatch) => (
            <div key={swatch.name} className="text-center">
              <div
                className={`${swatch.className} h-16 w-full rounded-xl border border-line`}
              />
              <span className="mt-2 block text-xs text-muted">
                {swatch.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

export default Home
