import { motion } from "motion/react"

type ToggleProps = {
  checked: boolean
  onChange: (value: boolean) => void
}

export const Toggle = ({ checked, onChange }: ToggleProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative h-[22px] w-10 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flag-red focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
      checked ? "bg-flag-red" : "bg-line"
    }`}
  >
    <motion.span
      className="absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm"
      animate={{ left: checked ? "21px" : "3px" }}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
    />
  </button>
)
