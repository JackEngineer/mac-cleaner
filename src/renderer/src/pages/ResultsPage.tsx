import { formatBytes, formatCount, formatDateTime } from '@shared/format'
import { CategoryCard } from '@renderer/components/CategoryCard'
import { EmptyState } from '@renderer/components/EmptyState'
import { MetricCard } from '@renderer/components/MetricCard'
import { StatusPill } from '@renderer/components/StatusPill'
import type { AppController } from '@renderer/state/useAppController'

interface ResultsPageProps {
  controller: AppController
}

export function ResultsPage({ controller }: ResultsPageProps) {
  const {
    scanSummary,
    selectedCategoryIds,
    toggleCategory,
    selectDefaults,
    selectedBytes,
    safeBytes,
    openCleaning,
    hasEmptyTrashSelection,
  } = controller

  if (!scanSummary) {
    return (
      <div className="page-grid">
        <section className="panel">
          <EmptyState title="还没有扫描结果" description="先完成一次扫描，再来看分类和清理建议。" />
        </section>
      </div>
    )
  }

  const actionableCategories = scanSummary.categories.filter((category) => category.actionable)
  const readonlyCategories = scanSummary.categories.filter((category) => !category.actionable)

  return (
    <div className="page-grid results-grid">
      <section className="panel">
        <div className="section-head">
          <h3>扫描结果</h3>
          <p>默认只勾选低风险项，中风险项默认保持关闭。</p>
        </div>

        <div className="results-summary">
          <MetricCard label="总可释放" value={formatBytes(scanSummary.totalBytes)} hint={`扫描于 ${formatDateTime(scanSummary.scannedAt)}`} tone="accent" />
          <MetricCard label="低风险可安全释放" value={formatBytes(scanSummary.safeBytes)} hint="默认勾选的安全项" tone="success" />
          <MetricCard label="当前选中" value={formatBytes(selectedBytes)} hint={`${formatCount(selectedCategoryIds.length, '个分类')} · ${formatCount(scanSummary.skipped.length, '个跳过')}`} tone="warning" />
        </div>

        <div className="results-toolbar">
          <div className="results-toolbar-left">
            <StatusPill tone="muted">{formatCount(actionableCategories.length, '个分类')}</StatusPill>
            {readonlyCategories.length > 0 ? (
              <StatusPill tone="warning">{formatCount(readonlyCategories.length, '个只读项')}</StatusPill>
            ) : null}
            {hasEmptyTrashSelection ? <StatusPill tone="warning">包含废纸篓</StatusPill> : null}
          </div>
          <div className="results-toolbar-right">
            <button className="button secondary" type="button" onClick={selectDefaults}>
              恢复默认勾选
            </button>
          </div>
        </div>

        {actionableCategories.length > 0 ? (
          <div className="category-list">
            {actionableCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                checked={selectedCategoryIds.includes(category.id)}
                disabled={!category.actionable}
                onToggle={() => toggleCategory(category.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="这次没有发现可直接清理的分类"
            description="扫描完成了，但当前范围内没有找到可执行的低风险结果。"
            tone="accent"
          />
        )}

        {readonlyCategories.length > 0 ? (
          <div className="readonly-section">
            <div className="section-head compact">
              <h3>只读提示项</h3>
              <p>这些分类目前只展示，不会进入清理队列。</p>
            </div>

            <div className="category-list">
              {readonlyCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  checked={false}
                  disabled
                  onToggle={() => toggleCategory(category.id)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <aside className="panel results-side">
        <div className="section-head">
          <h3>执行前摘要</h3>
          <p>先确认勾选项，再进入清理页执行操作。</p>
        </div>

        <div className="summary-stack">
          <MetricCard label="已选中空间" value={formatBytes(selectedBytes)} hint="将按分类执行" tone="accent" />
          <MetricCard label="可安全释放" value={formatBytes(safeBytes)} hint="低风险默认项" tone="success" />
        </div>

        {selectedCategoryIds.length === 0 ? (
          <div className="inline-note warning">
            当前没有勾选任何分类。你可以先恢复默认勾选，或者手动挑选需要处理的项目。
          </div>
        ) : null}

        <div className="side-callout">
          {hasEmptyTrashSelection ? (
            <>
              <strong>废纸篓已包含在内</strong>
              <p>进入清理页后，需要确认你理解废纸篓中的项目会被移除。</p>
            </>
          ) : (
            <>
              <strong>当前组合较保守</strong>
              <p>如果想更激进一点，可以手动勾选中风险项后再清理。</p>
            </>
          )}
        </div>

        <button className="button primary full" type="button" onClick={openCleaning} disabled={selectedCategoryIds.length === 0}>
          进入清理页
        </button>

        <details className="skip-details">
          <summary>被跳过的路径</summary>
          <ul>
            {scanSummary.skipped.length > 0 ? (
              scanSummary.skipped.map((item) => (
                <li key={`${item.path}-${item.reason}`}>
                  <span>{item.path}</span>
                  <small>{item.reason}</small>
                </li>
              ))
            ) : (
              <li>
                <span>没有遇到受限路径</span>
              </li>
            )}
          </ul>
        </details>
      </aside>
    </div>
  )
}
