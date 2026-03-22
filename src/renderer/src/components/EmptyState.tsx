import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  compact?: boolean
  tone?: 'neutral' | 'accent' | 'warning'
  action?: ReactNode
}

export function EmptyState({
  title,
  description,
  compact = false,
  tone = 'neutral',
  action,
}: EmptyStateProps) {
  return (
    <div className={`empty-state empty-state-${tone} ${compact ? 'compact' : ''}`}>
      <strong>{title}</strong>
      <p>{description}</p>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  )
}
