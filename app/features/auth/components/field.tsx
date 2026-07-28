import { useState } from "react"
import { motion } from "motion/react"
import { EyeIcon, EyeOffIcon } from "~/components/ui/icons"

type field_props = {
  name: string
  label: string
  type?: string
  autoComplete?: string
  required?: boolean
  placeholder?: string
}

export const Field = ({ name, label, type = "text", autoComplete, required, placeholder }: field_props) => {
  const [active, set_active] = useState(false)
  const [show_password, set_show_password] = useState(false)
  const is_password = type === "password"
  const input_type = is_password ? (show_password ? "text" : "password") : type

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      <motion.div
        animate={{
          boxShadow: active
            ? "0 0 0 3px hsl(355 81% 47% / 0.16)"
            : "0 0 0 0px hsl(355 81% 47% / 0)",
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative rounded-lg"
      >
        <input
          name={name}
          type={input_type}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          onFocus={() => set_active(true)}
          onBlur={() => set_active(false)}
          className={`w-full rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors duration-200 placeholder:text-muted/50 focus:border-flag-red ${is_password ? "pr-9" : ""}`}
        />
        {is_password && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => set_show_password(v => !v)}
            title={show_password ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:text-ink"
          >
            {show_password ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
          </button>
        )}
      </motion.div>
    </label>
  )
}
