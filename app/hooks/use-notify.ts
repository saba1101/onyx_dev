import { createContext, useContext } from "react"

export type notice_tone = "success" | "error" | "info"

export type notice = {
  id: number
  tone: notice_tone
  title: string
  message?: string
}

export type notice_input = {
  title: string
  message?: string
  tone?: notice_tone
}

export const notify_context = createContext<((input: notice_input) => void) | null>(null)

export const use_notify = () => {
  const push = useContext(notify_context)
  if (!push) throw new Error("use_notify must be used inside NotificationProvider")
  return push
}
