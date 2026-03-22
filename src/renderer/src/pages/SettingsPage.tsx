import type { AppController } from '@renderer/state/useAppController'
import { EmptyState } from '@renderer/components/EmptyState'
import { StatusPill } from '@renderer/components/StatusPill'

interface SettingsPageProps {
  controller: AppController
}

export function SettingsPage({ controller }: SettingsPageProps) {
  const { settings, updateSettings, scanSummary } = controller

  if (!settings) {
    return (
      <div className="page-grid">
        <section className="panel">
          <EmptyState title="设置读取中" description="正在从本地存储读取配置。" />
        </section>
      </div>
    )
  }

  return (
    <div className="page-grid settings-grid">
      <section className="panel">
        <div className="section-head">
          <h3>基础设置</h3>
          <p>所有设置都会保存在本地，不会上传到网络。</p>
        </div>

        <div className="settings-list">
          <label className="setting-row">
            <div>
              <strong>默认勾选低风险项</strong>
              <p>扫描结果出现低风险分类时，会自动帮你选中。</p>
            </div>
            <div className="setting-control">
              <StatusPill tone={settings.defaultSelectLowRisk ? 'success' : 'muted'}>
                {settings.defaultSelectLowRisk ? '已开启' : '已关闭'}
              </StatusPill>
              <input
                type="checkbox"
                checked={settings.defaultSelectLowRisk}
                onChange={(event) => void updateSettings({ defaultSelectLowRisk: event.target.checked })}
              />
            </div>
          </label>

          <div className="setting-row setting-column">
            <div>
              <strong>默认删除方式</strong>
              <p>当前版本只开放“移到废纸篓”，永久删除先保留为禁用项。</p>
            </div>

            <div className="radio-stack">
              <label>
                <input
                  type="radio"
                  name="delete-mode"
                  checked={settings.defaultDeletionMode === 'trash'}
                  onChange={() => void updateSettings({ defaultDeletionMode: 'trash' })}
                />
                <span>移到废纸篓</span>
              </label>
              <label className="is-disabled">
                <input
                  type="radio"
                  name="delete-mode"
                  checked={settings.defaultDeletionMode === 'permanent'}
                  disabled
                  onChange={() => void updateSettings({ defaultDeletionMode: 'permanent' })}
                />
                <span>永久删除（暂未开放）</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>权限说明</h3>
          <p>这部分不是“申请权限”，而是告诉你为什么某些路径会被跳过。</p>
        </div>

        <div className="permission-card">
          <StatusPill tone="warning">保守模式</StatusPill>
          <p>系统缓存和日志目录可能会因为 macOS 隐私限制而无法完整读取；遇到受限路径时，扫描会自动跳过，不会中断。</p>
          <p>高风险系统清理在 MVP 中不做真实删除，只保留占位说明。</p>
        </div>

        {scanSummary?.skipped.length ? (
          <details className="skip-details open">
            <summary>最近一次扫描中被跳过的路径</summary>
            <ul>
              {scanSummary.skipped.slice(0, 8).map((item) => (
                <li key={`${item.path}-${item.reason}`}>
                  <span>{item.path}</span>
                  <small>{item.reason}</small>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <div className="empty-state compact">
            <strong>暂无跳过记录</strong>
            <p>如果后续遇到受限目录，这里会出现路径说明。</p>
          </div>
        )}
      </section>
    </div>
  )
}
