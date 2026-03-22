import { formatBytes, formatCount } from '@shared/format'
import type { ScanCategoryResult } from '@shared/types'
import { StatusPill } from './StatusPill'

interface CategoryCardProps {
  category: ScanCategoryResult
  checked: boolean
  disabled?: boolean
  onToggle: () => void
}

function getRiskLabel(riskLevel: ScanCategoryResult['riskLevel']): string {
  switch (riskLevel) {
    case 'low':
      return '低风险'
    case 'medium':
      return '中风险'
    case 'high':
      return '高风险'
  }
}

function getRiskTone(riskLevel: ScanCategoryResult['riskLevel']): 'success' | 'warning' | 'danger' {
  switch (riskLevel) {
    case 'low':
      return 'success'
    case 'medium':
      return 'warning'
    case 'high':
      return 'danger'
  }
}

export function CategoryCard({ category, checked, disabled = false, onToggle }: CategoryCardProps) {
  const cardTone = category.riskLevel === 'low' ? 'safe' : category.riskLevel === 'medium' ? 'caution' : 'danger'
  const selectionLabel = disabled
    ? '只读'
    : checked
      ? '已选中'
      : category.defaultSelected
        ? '建议保留默认'
        : '未选中'
  const actionLabel =
    category.cleanupAction === 'empty-trash'
      ? '从废纸篓中移除'
      : category.cleanupAction === 'move-to-trash'
        ? '移到废纸篓'
        : '仅展示'

  return (
    <label className={`category-card category-${cardTone} ${checked ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <div className="category-card-meta">
        <StatusPill tone={disabled ? 'muted' : checked ? 'accent' : 'neutral'}>{selectionLabel}</StatusPill>
        <span>{actionLabel}</span>
      </div>

      <div className="category-card-head">
        <div className="category-card-title">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onToggle}
            aria-label={`选择 ${category.name}`}
          />
          <div>
            <div className="category-name-row">
              <h3>{category.name}</h3>
              <StatusPill tone={getRiskTone(category.riskLevel)}>{getRiskLabel(category.riskLevel)}</StatusPill>
            </div>
            <p>{category.description}</p>
          </div>
        </div>
        <div className="category-size">{formatBytes(category.totalBytes)}</div>
      </div>

      <div className="category-card-foot">
        <span>{formatCount(category.itemCount, '项')}</span>
        <span>{disabled ? '当前不进入清理队列' : actionLabel}</span>
      </div>

      {category.note ? <div className="category-note">{category.note}</div> : null}
    </label>
  )
}
