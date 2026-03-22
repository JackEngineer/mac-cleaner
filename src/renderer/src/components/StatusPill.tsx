import type { ReactNode } from 'react'

type StatusTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'muted'

interface StatusPillProps {
  tone?: StatusTone
  children: ReactNode
}

export function StatusPill({ tone = 'neutral', children }: StatusPillProps) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}
