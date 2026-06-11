import { Form, Link, redirect, useActionData, useNavigation } from "react-router"
import { motion } from "motion/react"
import type { Route } from "./+types/login"
import { get_supabase } from "~/lib/supabase.server"
import { block_when_signed_in } from "~/lib/auth.server"
import { AuthShell } from "~/components/ui/auth-shell"
import { Field } from "~/components/ui/field"

export const meta = () => [{ title: "Sign in — Onyx Dev" }]

export const loader = async ({ request }: Route.LoaderArgs) => {
  await block_when_signed_in(request)
  return null
}

export const action = async ({ request }: Route.ActionArgs) => {
  const form = await request.formData()
  const email = String(form.get("email") ?? "").trim()
  const password = String(form.get("password") ?? "")

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  const { supabase, headers } = get_supabase(request)
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  return redirect("/?welcome=in", { headers })
}

const Login = () => {
  const feedback = useActionData<typeof action>()
  const navigation = useNavigation()
  const sending = navigation.state === "submitting"

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Enter your details to continue."
      footer={
        <span>
          Need an account?{" "}
          <Link to="/signup" className="font-medium text-flag-red hover:underline">
            Sign up
          </Link>
        </span>
      }
    >
      <Form method="post" className="flex flex-col gap-4">
        <Field name="email" label="Email" type="email" autoComplete="email" required placeholder="you@onyx.dev" />
        <Field name="password" label="Password" type="password" autoComplete="current-password" required placeholder="••••••••" />

        {feedback?.error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="rounded-lg bg-flag-red/10 px-3 py-2 text-xs text-flag-red"
          >
            {feedback.error}
          </motion.p>
        )}

        <motion.button
          type="submit"
          disabled={sending}
          whileTap={{ scale: 0.98 }}
          className="mt-1 rounded-lg bg-flag-red px-3 py-2 text-sm font-semibold text-platinum transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
        >
          {sending ? "Signing in…" : "Sign in"}
        </motion.button>
      </Form>
    </AuthShell>
  )
}

export default Login
