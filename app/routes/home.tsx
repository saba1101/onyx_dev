import type { Route } from "./+types/home"

export const meta = ({}: Route.MetaArgs) => [
  { title: "Onyx Zero" },
  { name: "description", content: "Onyx Zero" },
]

const Home = () => {
  return (
    <main className="p-8">
      <h1>Onyx Zero</h1>
    </main>
  )
}

export default Home
