interface MetricCardProps {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
  compact?: boolean
}

export function MetricCard({ label, value, hint, tone = 'neutral', compact = false }: MetricCardProps) {
  return (
    <div className={`metric-card metric-${tone} ${compact ? 'metric-compact' : ''}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </div>
  )
}
