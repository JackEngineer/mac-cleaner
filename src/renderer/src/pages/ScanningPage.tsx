import { formatBytes } from '@shared/format'
import { ProgressBar } from '@renderer/components/ProgressBar'
import type { AppController } from '@renderer/state/useAppController'

interface ScanningPageProps {
  controller: AppController
}

export function ScanningPage({ controller }: ScanningPageProps) {
  const { scanProgress } = controller
  const total = scanProgress?.categoryTotal ?? 0
  const progressValue =
    scanProgress && total > 0
      ? scanProgress.stage === 'finalizing'
        ? 100
        : Math.max(0, Math.min(100, (scanProgress.categoryIndex / total) * 100))
      : 0

  return (
    <div className="page-grid">
      <section className="panel scanning-panel">
        <div className="section-head">
          <h3>{scanProgress?.message ?? '正在扫描磁盘内容。'}</h3>
          <p>扫描只读取文件信息，不会修改任何内容。</p>
        </div>

        <ProgressBar
          value={progressValue}
          label={scanProgress?.categoryName ?? '扫描中'}
          detail={scanProgress?.currentPath ?? '正在按分类读取目录和文件信息'}
        />

        <div className="scan-meta-grid">
          <div>
            <span>当前阶段</span>
            <strong>{scanProgress?.stage === 'finalizing' ? '整理结果' : '读取目录'}</strong>
          </div>
          <div>
            <span>已发现</span>
            <strong>{scanProgress ? `${scanProgress.discoveredCount} 项` : '0 项'}</strong>
          </div>
          <div>
            <span>累计体积</span>
            <strong>{scanProgress ? formatBytes(scanProgress.discoveredBytes) : '0 B'}</strong>
          </div>
        </div>

        <div className="scan-note">
          <strong>扫描范围</strong>
          <p>系统缓存、应用缓存、日志、废纸篓、下载目录和常用用户目录中的大文件。</p>
        </div>
      </section>
    </div>
  )
}
