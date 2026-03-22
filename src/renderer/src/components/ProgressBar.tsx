interface ProgressBarProps {
  value: number
  label?: string
  detail?: string
}

export function ProgressBar({ value, label, detail }: ProgressBarProps) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0

  return (
    <div className="progress-shell" aria-label={label ?? '进度'} role="status" aria-live="polite">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${safeValue}%` }} />
      </div>
      <div className="progress-meta">
        <span>{detail ?? label ?? '进行中'}</span>
        <span>{safeValue.toFixed(0)}%</span>
      </div>
    </div>
  )
}
