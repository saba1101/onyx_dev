import { Form, Link, Navigate, useActionData, useNavigation } from "react-router"
import { motion } from "motion/react"
import type { Route } from "./+types/forgot-password"
import { supabase } from "~/lib/supabase"
import { useAuth } from "~/features/auth/lib/auth"
import { AuthShell } from "~/features/auth/components/auth-shell"
import { Field } from "~/features/auth/components/field"

export const meta = () => [{ title: "Forgot password — Onyx Dev" }]

export const clientAction = async ({ request }: Route.ClientActionArgs) => {
  const form = await request.formData()
  const email = String(form.get("email") ?? "").trim()

  if (!email) return { error: "Email is required.", sent: false }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) return { error: error.message, sent: false }

  return { error: null, sent: true }
}

const ForgotPassword = () => {
  const { user, loading } = useAuth()
  const feedback = useActionData<typeof clientAction>()
  const navigation = useNavigation()
  const sending = navigation.state === "submitting"

  if (loading) return null
  if (user) return <Navigate to="/" replace />

  return (
    <AuthShell
      title="Forgot password"
      subtitle="Enter your email and we'll send you a link to reset it."
      footer={
        <span>
          Remembered it?{" "}
          <Link to="/login" className="font-medium text-flag-red hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      {feedback?.sent ? (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-light-green/10 px-3 py-2 text-xs text-light-green"
        >
          Check your inbox for a link to reset your password.
        </motion.p>
      ) : (
        <Form method="post" className="flex flex-col gap-4">
          <Field name="email" label="Email" type="email" autoComplete="email" required placeholder="you@onyx.dev" />

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
            {sending ? "Sending…" : "Send reset link"}
          </motion.button>
        </Form>
      )}
    </AuthShell>
  )
}

export default ForgotPassword
