import type { ReactNode } from 'react'
import { formatBytes, formatDateTime, formatHealthLabel, formatPercent } from '@shared/format'
import type { AppSettings, AppView, CleanupResult, DiskSnapshot, ScanSummary } from '@shared/types'
import { MetricCard } from './MetricCard'
import { StatusPill } from './StatusPill'

interface AppShellProps {
  view: AppView
  title: string
  subtitle?: string
  diskSnapshot: DiskSnapshot | null
  settings: AppSettings | null
  scanSummary: ScanSummary | null
  cleanupResult: CleanupResult | null
  notice: string | null
  isBootstrapping: boolean
  onOpenHome: () => void
  onOpenSettings: () => void
  onRefreshDisk: () => void
  onOpenResults: () => void
  onOpenLastResults: () => void
  children: ReactNode
  actions?: ReactNode
}

export function AppShell({
  view,
  title,
  subtitle,
  diskSnapshot,
  settings,
  scanSummary,
  cleanupResult,
  notice,
  isBootstrapping,
  onOpenHome,
  onOpenSettings,
  onRefreshDisk,
  onOpenResults,
  onOpenLastResults,
  actions,
  children,
}: AppShellProps) {
  const healthTone = !diskSnapshot
    ? 'neutral'
    : diskSnapshot.health === 'healthy'
      ? 'success'
      : diskSnapshot.health === 'tight'
        ? 'warning'
        : 'danger'
  const noticeTone = inferNoticeTone(notice)
  const hasScanSummary = Boolean(scanSummary)
  const isHome = view === 'home'
  const isSettings = view === 'settings'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">MC</div>
          <div>
            <div className="brand-name">Mac Cleaner</div>
            <div className="brand-subtitle">安全清理 MVP</div>
          </div>
        </div>

        <div className="sidebar-banner">
          <StatusPill tone="accent">本地运行</StatusPill>
          <span>默认只处理低风险目录，不直接永久删除。</span>
        </div>

        <button className="sidebar-refresh" type="button" onClick={onRefreshDisk}>
          刷新磁盘概览
        </button>

        <div className="sidebar-panel">
          <div className="sidebar-panel-label">磁盘健康</div>
          <div className="sidebar-health-row">
            <StatusPill tone={healthTone}>{diskSnapshot ? formatHealthLabel(diskSnapshot.health) : '读取中'}</StatusPill>
            {diskSnapshot ? <span>{formatPercent(diskSnapshot.usagePercent)} 已用</span> : <span>--</span>}
          </div>
          <div className="sidebar-volume">
            {diskSnapshot ? `${formatBytes(diskSnapshot.usedBytes)} / ${formatBytes(diskSnapshot.totalBytes)}` : '正在读取...'}
          </div>
          <div className="sidebar-volume-sub">
            {diskSnapshot ? `可用 ${formatBytes(diskSnapshot.freeBytes)}` : '请稍候'}
          </div>
        </div>

        {scanSummary ? (
          <div className="sidebar-panel">
            <div className="sidebar-panel-label">上次扫描</div>
            <MetricCard
              label="预计可安全释放"
              value={formatBytes(scanSummary.safeBytes)}
              hint={`扫描于 ${formatDateTime(scanSummary.scannedAt)}`}
              tone="accent"
            />
            <div className="sidebar-inline-actions">
              <button className="button secondary" type="button" onClick={onOpenLastResults}>
                查看结果
              </button>
              <button className="button secondary" type="button" onClick={onOpenResults} disabled={!hasScanSummary}>
                回到结果
              </button>
            </div>
          </div>
        ) : (
          <div className="sidebar-panel">
            <div className="sidebar-panel-label">上次扫描</div>
            <div className="sidebar-muted">暂无结果，先开始一次扫描。</div>
          </div>
        )}

        {cleanupResult ? (
          <div className="sidebar-panel">
            <div className="sidebar-panel-label">最近清理</div>
            <MetricCard
              label="本次处理量"
              value={formatBytes(cleanupResult.releasedBytes)}
              hint={`完成于 ${formatDateTime(cleanupResult.finishedAt)}`}
              tone={cleanupResult.failures.length > 0 ? 'warning' : 'success'}
            />
          </div>
        ) : null}

        <nav className="sidebar-nav" aria-label="主导航">
          <button className={`nav-button ${isHome ? 'is-active' : ''}`} type="button" onClick={onOpenHome}>
            首页
          </button>
          <button className={`nav-button ${isSettings ? 'is-active' : ''}`} type="button" onClick={onOpenSettings}>
            设置
          </button>
        </nav>
      </aside>

      <main className="content">
        <header className="page-header">
          <div className="page-header-copy">
            <div className="page-eyebrow">
              <StatusPill tone="muted">{getViewLabel(view)}</StatusPill>
              {diskSnapshot ? (
                <span className="page-eyebrow-meta">
                  {formatPercent(diskSnapshot.usagePercent)} 已用
                </span>
              ) : null}
            </div>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="page-actions">{actions}</div>
        </header>

        {notice ? (
          <div className={`notice-banner notice-${noticeTone}`} role="status" aria-live="polite">
            {notice}
          </div>
        ) : null}
        {isBootstrapping ? <div className="boot-panel">正在读取磁盘和本地状态…</div> : children}
      </main>
    </div>
  )
}

function getViewLabel(view: AppView): string {
  switch (view) {
    case 'home':
      return '首页'
    case 'scanning':
      return '扫描中'
    case 'results':
      return '扫描结果'
    case 'cleaning':
      return '清理执行中'
    case 'done':
      return '清理完成'
    case 'settings':
      return '设置'
  }
}

function inferNoticeTone(notice: string | null): 'accent' | 'warning' | 'danger' {
  if (!notice) {
    return 'accent'
  }

  if (notice.includes('失败') || notice.includes('错误')) {
    return 'danger'
  }

  if (notice.includes('请') || notice.includes('确认') || notice.includes('至少')) {
    return 'warning'
  }

  return 'accent'
}
