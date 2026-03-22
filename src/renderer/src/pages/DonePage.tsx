import { formatBytes, formatCount, formatDateTime } from '@shared/format'
import { EmptyState } from '@renderer/components/EmptyState'
import { MetricCard } from '@renderer/components/MetricCard'
import { StatusPill } from '@renderer/components/StatusPill'
import type { AppController } from '@renderer/state/useAppController'

interface DonePageProps {
  controller: AppController
}

export function DonePage({ controller }: DonePageProps) {
  const { cleanupResult, selectedBytes } = controller

  if (!cleanupResult) {
    return (
      <div className="page-grid">
        <section className="panel">
          <EmptyState title="暂无清理结果" description="完成一次清理后，这里会显示本次处理量和失败项。" />
        </section>
      </div>
    )
  }

  const hasFailures = cleanupResult.failures.length > 0

  return (
    <div className="page-grid">
      <section className="panel done-panel">
        <div className="section-head">
          <h3>清理完成</h3>
          <p>本次已经完成安全清理，下面是结果摘要。</p>
        </div>

        <div className="summary-strip">
          <StatusPill tone={hasFailures ? 'warning' : 'success'}>
            {hasFailures ? '部分完成' : '完成'}
          </StatusPill>
          <StatusPill tone="accent">{formatDateTime(cleanupResult.finishedAt)}</StatusPill>
        </div>

        <div className="results-summary">
          <MetricCard label="本次处理量" value={formatBytes(cleanupResult.releasedBytes)} hint="按选中的分类统计" tone="success" />
          <MetricCard label="尝试处理" value={formatCount(cleanupResult.processedCount, '项')} hint="成功处理的目标数" tone="accent" />
          <MetricCard label="失败项" value={formatCount(cleanupResult.failures.length, '项')} hint="失败会保留在列表里" tone={cleanupResult.failures.length > 0 ? 'warning' : 'neutral'} />
        </div>

        <div className="done-note">
          <strong>{hasFailures ? '这次有少量项目未完成' : '这次清理已经完成'}</strong>
          <p>如果本次主要是“移到废纸篓”，空间可能需要在清空废纸篓后才完全释放。</p>
          <p>已处理的体积约为 {formatBytes(selectedBytes)}，失败项会保留供你重新检查。</p>
        </div>

        {cleanupResult.failures.length > 0 ? (
          <details className="skip-details">
            <summary>失败项</summary>
            <ul>
              {cleanupResult.failures.map((item) => (
                <li key={`${item.path}-${item.reason}`}>
                  <span>{item.path}</span>
                  <small>{item.reason}</small>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </div>
  )
}
