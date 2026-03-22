import { formatBytes, formatDateTime, formatHealthLabel, formatPercent } from '@shared/format'
import { EmptyState } from '@renderer/components/EmptyState'
import { MetricCard } from '@renderer/components/MetricCard'
import { StatusPill } from '@renderer/components/StatusPill'
import type { AppController } from '@renderer/state/useAppController'

interface HomePageProps {
  controller: AppController
}

export function HomePage({ controller }: HomePageProps) {
  const {
    diskSnapshot,
    scanSummary,
    cleanupResult,
    selectedBytes,
    safeBytes,
    actionableCategoryCount,
    readonlyCategoryCount,
  } = controller
  const healthTone = !diskSnapshot
    ? 'neutral'
    : diskSnapshot.health === 'healthy'
      ? 'success'
      : diskSnapshot.health === 'tight'
        ? 'warning'
        : 'danger'

  return (
    <div className="page-grid home-grid">
      <section className="hero-panel">
        <div className="hero-copy-block">
          <div className="hero-copy">
            <StatusPill tone={healthTone}>
              {diskSnapshot ? formatHealthLabel(diskSnapshot.health) : '读取中'}
            </StatusPill>
            <h2>先看懂占用，再安全清理。</h2>
            <p>
              这是一个保守的 Mac 清理工具原型，只扫描常见低风险目录，默认不会做永久删除。
            </p>
          </div>

          <div className="hero-callout">
            <strong>{scanSummary ? '可以继续处理上次结果' : '建议先做一次扫描'}</strong>
            <p>
              {scanSummary
                ? `上次扫描发现 ${formatBytes(scanSummary.totalBytes)} 可释放空间，其中 ${formatBytes(scanSummary.safeBytes)} 属于低风险项。`
                : '首次使用时会先读取磁盘概览，再生成可清理分类。'}
            </p>
          </div>
        </div>

        <div className="hero-stats">
          <MetricCard
            label="总容量"
            value={diskSnapshot ? formatBytes(diskSnapshot.totalBytes) : '--'}
            hint={diskSnapshot ? `已用 ${formatPercent(diskSnapshot.usagePercent)}` : '正在读取磁盘'}
          />
          <MetricCard
            label="已用空间"
            value={diskSnapshot ? formatBytes(diskSnapshot.usedBytes) : '--'}
            hint={diskSnapshot ? `可用 ${formatBytes(diskSnapshot.freeBytes)}` : '请稍候'}
            tone="warning"
          />
          <MetricCard
            label="可用空间"
            value={diskSnapshot ? formatBytes(diskSnapshot.freeBytes) : '--'}
            hint={diskSnapshot ? formatDateTime(diskSnapshot.measuredAt) : '正在同步'}
            tone="success"
          />
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>磁盘概览</h3>
          <p>健康状态基于当前系统盘已用比例。</p>
        </div>

        <div className="overview-bar">
          <div className="overview-used" style={{ width: diskSnapshot ? `${Math.min(100, diskSnapshot.usagePercent)}%` : '0%' }} />
        </div>

        <div className="overview-metrics">
          <div>
            <span>健康状态</span>
            <strong>{diskSnapshot ? formatHealthLabel(diskSnapshot.health) : '读取中'}</strong>
          </div>
          <div>
            <span>预计可安全释放</span>
            <strong>{formatBytes(safeBytes)}</strong>
          </div>
          <div>
            <span>本次已移出</span>
            <strong>{cleanupResult ? formatBytes(cleanupResult.releasedBytes) : '--'}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>最近结果</h3>
          <p>如果已经扫描过，会在这里显示最近一次可安全释放的空间。</p>
        </div>

        {scanSummary ? (
          <div className="results-summary">
            <MetricCard
              label="可执行分类"
              value={`${actionableCategoryCount} 个`}
              hint={`上次扫描于 ${formatDateTime(scanSummary.scannedAt)}`}
            />
            <MetricCard
              label="总可释放"
              value={formatBytes(scanSummary.totalBytes)}
              hint={`跳过 ${scanSummary.skipped.length} 个受限路径`}
              tone="accent"
            />
            <MetricCard
              label="低风险可安全释放"
              value={formatBytes(scanSummary.safeBytes)}
              hint={`默认会勾选 ${controller.selectedCategories.length} 个分类`}
              tone="success"
            />
          </div>
        ) : (
          <EmptyState
            title="还没有扫描结果"
            description="点击“开始扫描”后会显示分类结果和可清理空间。"
          />
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>清理策略</h3>
          <p>默认只处理低风险项，不会直接永久删除文件。</p>
        </div>

        <div className="policy-grid">
          <MetricCard
            label="当前已选中"
            value={formatBytes(selectedBytes)}
            hint="以当前勾选分类为准"
            compact
          />
          <MetricCard
            label="高风险占位"
            value={`${readonlyCategoryCount} 个`}
            hint="只展示，不进入清理"
            tone="warning"
            compact
          />
        </div>

        <ol className="guide-list">
          <li>点击开始扫描，先看磁盘占用。</li>
          <li>在结果页检查分类，默认勾选低风险项。</li>
          <li>进入清理页后再执行实际操作。</li>
        </ol>
      </section>
    </div>
  )
}
