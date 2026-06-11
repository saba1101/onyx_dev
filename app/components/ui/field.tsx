import { useState } from "react"
import { motion } from "motion/react"

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

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      <motion.div
        animate={{
          boxShadow: active
            ? "0 0 0 3px hsl(348 85% 54% / 0.16)"
            : "0 0 0 0px hsl(348 85% 54% / 0)",
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="rounded-lg"
      >
        <input
          name={name}
          type={type}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          onFocus={() => set_active(true)}
          onBlur={() => set_active(false)}
          className="w-full rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors duration-200 placeholder:text-muted/50 focus:border-watermelon"
        />
      </motion.div>
    </label>
  )
}
