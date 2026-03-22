import { formatBytes, formatCount } from '@shared/format'
import { EmptyState } from '@renderer/components/EmptyState'
import { ProgressBar } from '@renderer/components/ProgressBar'
import { StatusPill } from '@renderer/components/StatusPill'
import type { AppController } from '@renderer/state/useAppController'

interface CleaningPageProps {
  controller: AppController
}

export function CleaningPage({ controller }: CleaningPageProps) {
  const {
    selectedCategories,
    selectedBytes,
    cleanupProgress,
    hasEmptyTrashSelection,
    confirmEmptyTrash,
    setConfirmEmptyTrash,
    startCleanup,
    notice,
  } = controller

  const canStart = !cleanupProgress && (!hasEmptyTrashSelection || confirmEmptyTrash)
  const progressValue =
    cleanupProgress && cleanupProgress.total > 0
      ? Math.max(0, Math.min(100, (cleanupProgress.completed / cleanupProgress.total) * 100))
      : 0
  const disabledReason = hasEmptyTrashSelection && !confirmEmptyTrash
    ? '需要先确认废纸篓中的项目会被移除。'
    : selectedCategories.length === 0
      ? '当前还没有可执行的勾选分类。'
      : null

  if (selectedCategories.length === 0 && !cleanupProgress) {
    return (
      <div className="page-grid">
        <section className="panel">
          <EmptyState
            title="还没有可执行的清理内容"
            description="先回到结果页勾选分类，再进入清理页执行操作。"
          />
        </section>
      </div>
    )
  }

  return (
    <div className="page-grid">
      <section className="panel cleaning-panel">
        <div className="section-head">
          <h3>{cleanupProgress ? cleanupProgress.message : '准备执行安全清理。'}</h3>
          <p>清理默认会把普通项目移入废纸篓，废纸篓项目会在确认后移除。</p>
        </div>

        <div className="summary-strip">
          <StatusPill tone="accent">{formatCount(selectedCategories.length, '个分类')}</StatusPill>
          <StatusPill tone="success">{formatBytes(selectedBytes)}</StatusPill>
          {hasEmptyTrashSelection ? <StatusPill tone="warning">包含废纸篓</StatusPill> : null}
        </div>

        {hasEmptyTrashSelection ? (
          <label className="confirm-row">
            <input
              type="checkbox"
              checked={confirmEmptyTrash}
              onChange={(event) => setConfirmEmptyTrash(event.target.checked)}
            />
            <span>我理解废纸篓中的项目会被从废纸篓中移除。</span>
          </label>
        ) : null}

        <ProgressBar
          value={progressValue}
          label={cleanupProgress ? cleanupProgress.currentPath ?? '执行中' : '等待开始'}
          detail={cleanupProgress?.message ?? '执行前会先检查当前选择和废纸篓确认状态'}
        />

        <div className="cleaning-meta-grid">
          <div>
            <span>已完成</span>
            <strong>{cleanupProgress ? `${cleanupProgress.completed}/${cleanupProgress.total}` : '0/0'}</strong>
          </div>
          <div>
            <span>已移出量</span>
            <strong>{cleanupProgress ? formatBytes(cleanupProgress.releasedBytes) : '0 B'}</strong>
          </div>
          <div>
            <span>当前状态</span>
            <strong>{cleanupProgress ? '处理中' : '等待确认'}</strong>
          </div>
        </div>

        <div className="selected-category-block">
          <strong>本次将处理的分类</strong>
          <div className="selected-chip-row">
            {selectedCategories.map((category) => (
              <StatusPill
                key={category.id}
                tone={category.cleanupAction === 'empty-trash' ? 'warning' : 'accent'}
              >
                {category.name}
              </StatusPill>
            ))}
          </div>
        </div>

        {disabledReason ? <div className="inline-note warning">{disabledReason}</div> : null}
        {notice ? <div className="inline-note">{notice}</div> : null}

        <div className="action-row">
          <button className="button primary" type="button" onClick={() => void startCleanup()} disabled={!canStart}>
            开始清理
          </button>
        </div>
      </section>
    </div>
  )
}
