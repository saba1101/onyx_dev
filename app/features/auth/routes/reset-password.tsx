import { useEffect } from "react"
import { Form, Link, useActionData, useNavigate, useNavigation } from "react-router"
import { motion } from "motion/react"
import type { Route } from "./+types/reset-password"
import { supabase } from "~/lib/supabase"
import { useAuth } from "~/features/auth/lib/auth"
import { AuthShell } from "~/features/auth/components/auth-shell"
import { Field } from "~/features/auth/components/field"
import { use_notify } from "~/hooks/use-notify"

export const meta = () => [{ title: "Reset password — Onyx Dev" }]

export const clientAction = async ({ request }: Route.ClientActionArgs) => {
  const form = await request.formData()
  const password = String(form.get("password") ?? "")
  const confirm = String(form.get("confirm") ?? "")

  if (password.length < 8) return { error: "Password must be at least 8 characters.", done: false }
  if (password !== confirm) return { error: "Passwords don't match.", done: false }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message, done: false }

  return { error: null, done: true }
}

const ResetPassword = () => {
  const { user, loading } = useAuth()
  const feedback = useActionData<typeof clientAction>()
  const navigation = useNavigation()
  const navigate = useNavigate()
  const notify = use_notify()
  const sending = navigation.state === "submitting"

  useEffect(() => {
    if (!feedback?.done) return
    notify({ tone: "success", title: "Password updated", message: "You're all set — signed in with your new password." })
    navigate("/", { replace: true })
  }, [feedback])

  if (loading) return null

  if (!user) {
    return (
      <AuthShell
        title="Link expired"
        subtitle="This password reset link is invalid or has expired."
        footer={
          <span>
            <Link to="/forgot-password" className="font-medium text-flag-red hover:underline">
              Request a new link
            </Link>
          </span>
        }
      >
        <p className="text-xs text-muted">Reset links only work once and expire after a while — request a fresh one to continue.</p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Set new password"
      subtitle="Choose a new password for your account."
      footer={
        <span>
          <Link to="/login" className="font-medium text-flag-red hover:underline">
            Back to sign in
          </Link>
        </span>
      }
    >
      <Form method="post" className="flex flex-col gap-4">
        <Field name="password" label="New password" type="password" autoComplete="new-password" required placeholder="At least 8 characters" />
        <Field name="confirm" label="Confirm password" type="password" autoComplete="new-password" required placeholder="Re-enter password" />

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
          {sending ? "Saving…" : "Save new password"}
        </motion.button>
      </Form>
    </AuthShell>
  )
}

export default ResetPassword
