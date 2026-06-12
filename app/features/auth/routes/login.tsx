import { Form, Link, Navigate, useActionData, useNavigation } from "react-router"
import { motion } from "motion/react"
import type { Route } from "./+types/login"
import { supabase } from "~/lib/supabase"
import { useAuth } from "~/features/auth/lib/auth"
import { AuthShell } from "~/features/auth/components/auth-shell"
import { Field } from "~/features/auth/components/field"

export const meta = () => [{ title: "Sign in — Onyx Dev" }]

export const clientAction = async ({ request }: Route.ClientActionArgs) => {
  const form = await request.formData()
  const email = String(form.get("email") ?? "").trim()
  const password = String(form.get("password") ?? "")

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  return { error: null }
}

const Login = () => {
  const { user, loading } = useAuth()
  const feedback = useActionData<typeof clientAction>()
  const navigation = useNavigation()
  const sending = navigation.state === "submitting"

  if (loading) return null
  if (user) return <Navigate to="/?welcome=in" replace />

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
