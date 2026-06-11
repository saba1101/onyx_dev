import { useEffect } from "react"
import { Form, Link, redirect, useActionData, useNavigation } from "react-router"
import { motion } from "motion/react"
import type { Route } from "./+types/signup"
import { get_supabase } from "~/lib/supabase.server"
import { block_when_signed_in } from "~/lib/auth.server"
import { AuthShell } from "~/components/ui/auth-shell"
import { Field } from "~/components/ui/field"
import { use_notify } from "~/hooks/use-notify"

export const meta = () => [{ title: "Sign up — Onyx Dev" }]

export const loader = async ({ request }: Route.LoaderArgs) => {
  await block_when_signed_in(request)
  return null
}

export const action = async ({ request }: Route.ActionArgs) => {
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

  const { supabase, headers } = get_supabase(request)
  const { data: created, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name } },
  })

  if (error) {
    return { error: error.message, pending: null }
  }

  if (!created.session) {
    return { error: null, pending: "Account created. Check your email to confirm, then sign in." }
  }

  return redirect("/?welcome=up", { headers })
}

const Signup = () => {
  const feedback = useActionData<typeof action>()
  const navigation = useNavigation()
  const notify = use_notify()
  const sending = navigation.state === "submitting"

  useEffect(() => {
    if (feedback?.pending) {
      notify({ tone: "info", title: "Almost there", message: feedback.pending })
    }
  }, [feedback, notify])

  return (
    <AuthShell
      title="Create account"
      subtitle="Set up your Onyx workspace in seconds."
      footer={
        <span>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-watermelon hover:underline">
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
            className="rounded-lg bg-watermelon/10 px-3 py-2 text-xs text-watermelon"
          >
            {feedback.error}
          </motion.p>
        )}

        {feedback?.pending && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-royal-gold/10 px-3 py-2 text-xs text-charcoal-blue dark:text-royal-gold"
          >
            {feedback.pending}
          </motion.p>
        )}

        <motion.button
          type="submit"
          disabled={sending}
          whileTap={{ scale: 0.98 }}
          className="mt-1 rounded-lg bg-watermelon px-3 py-2 text-sm font-semibold text-mint-cream transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
        >
          {sending ? "Creating…" : "Sign up"}
        </motion.button>
      </Form>
    </AuthShell>
  )
}

export default Signup
