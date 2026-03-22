const byteUnits = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < byteUnits.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(precision)} ${byteUnits[unitIndex]}`
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '0%'
  }

  return `${value.toFixed(1)}%`
}

export function formatDateTime(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatCount(count: number, suffix = '项'): string {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
  return `${new Intl.NumberFormat('zh-CN').format(safeCount)} ${suffix}`
}

export function formatHealthLabel(health: 'healthy' | 'tight' | 'danger'): string {
  switch (health) {
    case 'healthy':
      return '健康'
    case 'tight':
      return '紧张'
    case 'danger':
      return '危险'
  }
}

