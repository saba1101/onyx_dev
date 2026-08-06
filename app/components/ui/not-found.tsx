import { Link } from "react-router";
import { motion } from "motion/react";
import { GlobeIcon, HomeIcon } from "~/components/ui/icons";

const ease_out = [0.22, 1, 0.36, 1] as const;

export const NotFoundPage = () => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, ease: ease_out }}
    className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center"
  >
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-flag-red/10 text-flag-red">
      <GlobeIcon size={28} />
    </div>
    <div>
      <h1 className="text-6xl font-bold tracking-tight text-ink">404</h1>
      <p className="mt-2 text-sm text-muted">
        This page doesn't exist or has been moved.
      </p>
    </div>
    <Link
      to="/"
      className="inline-flex items-center gap-2 rounded-xl bg-flag-red px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-80"
    >
      <HomeIcon size={15} />
      Back to home
    </Link>
  </motion.div>
);
