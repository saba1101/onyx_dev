import { useEffect } from "react"
import { Form, Link, Navigate, useActionData, useNavigation } from "react-router"
import { motion } from "motion/react"
import type { Route } from "./+types/signup"
import { supabase } from "~/lib/supabase"
import { useAuth } from "~/lib/auth"
import { AuthShell } from "~/components/ui/auth-shell"
import { Field } from "~/components/ui/field"
import { use_notify } from "~/hooks/use-notify"

export const meta = () => [{ title: "Sign up — Onyx Dev" }]

export const clientAction = async ({ request }: Route.ClientActionArgs) => {
  const form = await request.formData()
  const email = String(form.get("email") ?? "").trim()
  const password = String(form.get("password") ?? "")
  const full_name = String(form.get("full_name") ?? "").trim()

  if (!email || !password) {
    return { error: "Email and password are required.", pending: null }
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", pending: null }
  }

  const { data: created, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name } },
  })

  if (error) return { error: error.message, pending: null }

  if (!created.session) {
    return { error: null, pending: "Account created. Check your email to confirm, then sign in." }
  }

  return { error: null, pending: null }
}

const Signup = () => {
  const { user, loading } = useAuth()
  const feedback = useActionData<typeof clientAction>()
  const navigation = useNavigation()
  const notify = use_notify()
  const sending = navigation.state === "submitting"

  useEffect(() => {
    if (feedback?.pending) {
      notify({ tone: "info", title: "Almost there", message: feedback.pending })
    }
  }, [feedback])

  if (loading) return null
  if (user) return <Navigate to="/?welcome=up" replace />

  return (
    <AuthShell
      title="Create account"
      subtitle="Set up your Onyx workspace in seconds."
      footer={
        <span>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-flag-red hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <Form method="post" className="flex flex-col gap-4">
        <Field name="full_name" label="Name" autoComplete="name" placeholder="Jane Doe" />
        <Field name="email" label="Email" type="email" autoComplete="email" required placeholder="you@onyx.dev" />
        <Field name="password" label="Password" type="password" autoComplete="new-password" required placeholder="At least 8 characters" />

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

        {feedback?.pending && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-royal-gold/10 px-3 py-2 text-xs text-carbon-black dark:text-royal-gold"
          >
            {feedback.pending}
          </motion.p>
        )}

        <motion.button
          type="submit"
          disabled={sending}
          whileTap={{ scale: 0.98 }}
          className="mt-1 rounded-lg bg-flag-red px-3 py-2 text-sm font-semibold text-platinum transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
        >
          {sending ? "Creating…" : "Sign up"}
        </motion.button>
      </Form>
    </AuthShell>
  )
}

export default Signup
