import { AppShell } from '@renderer/components/AppShell'
import type { AppController } from '@renderer/state/useAppController'
import { useAppController } from '@renderer/state/useAppController'
import { HomePage } from './pages/HomePage'
import { ScanningPage } from './pages/ScanningPage'
import { ResultsPage } from './pages/ResultsPage'
import { CleaningPage } from './pages/CleaningPage'
import { DonePage } from './pages/DonePage'
import { SettingsPage } from './pages/SettingsPage'

function renderPage(controller: AppController) {
  switch (controller.view) {
    case 'home':
      return <HomePage controller={controller} />
    case 'scanning':
      return <ScanningPage controller={controller} />
    case 'results':
      return <ResultsPage controller={controller} />
    case 'cleaning':
      return <CleaningPage controller={controller} />
    case 'done':
      return <DonePage controller={controller} />
    case 'settings':
      return <SettingsPage controller={controller} />
    default:
      return null
  }
}

function getTitle(controller: AppController): { title: string; subtitle?: string } {
  switch (controller.view) {
    case 'home':
      return {
        title: '磁盘概览',
        subtitle: '先看占用，再决定要不要清理。',
      }
    case 'scanning':
      return {
        title: '扫描中',
        subtitle: '正在按规则读取可清理项目。',
      }
    case 'results':
      return {
        title: '扫描结果',
        subtitle: '默认只勾选低风险项，先保守处理。',
      }
    case 'cleaning':
      return {
        title: '清理执行中',
        subtitle: '会先确认废纸篓项，再执行安全清理。',
      }
    case 'done':
      return {
        title: '清理完成',
        subtitle: '查看本次处理量和失败项。',
      }
    case 'settings':
      return {
        title: '设置',
        subtitle: '默认勾选和删除方式都在这里。',
      }
    default:
      return {
        title: 'Mac Cleaner MVP',
      }
  }
}

function getActions(controller: AppController) {
  switch (controller.view) {
    case 'home':
      return (
        <>
          <button className="button primary" type="button" onClick={() => void controller.startScan()}>
            开始扫描
          </button>
          {controller.scanSummary ? (
            <button className="button secondary" type="button" onClick={controller.openResults}>
              查看结果
            </button>
          ) : null}
        </>
      )
    case 'scanning':
      return <span className="inline-badge">扫描进行中</span>
    case 'results':
      return (
        <>
          <button className="button secondary" type="button" onClick={controller.openHome}>
            返回首页
          </button>
          <button className="button primary" type="button" onClick={controller.openCleaning} disabled={!controller.selectedCategories.length}>
            进入清理页
          </button>
        </>
      )
    case 'cleaning':
      return (
        <button className="button secondary" type="button" onClick={controller.openResults}>
          返回结果
        </button>
      )
    case 'done':
      return (
        <>
          <button className="button secondary" type="button" onClick={controller.openHome}>
            返回首页
          </button>
          <button className="button primary" type="button" onClick={() => void controller.startScan()}>
            再次扫描
          </button>
        </>
      )
    case 'settings':
      return (
        <>
          <button className="button secondary" type="button" onClick={controller.openHome}>
            返回首页
          </button>
          <button className="button primary" type="button" onClick={() => void controller.startScan()}>
            开始扫描
          </button>
        </>
      )
    default:
      return null
  }
}

export function App() {
  const controller = useAppController()
  const { title, subtitle } = getTitle(controller)

  return (
    <AppShell
      view={controller.view}
      title={title}
      subtitle={subtitle}
      diskSnapshot={controller.diskSnapshot}
      settings={controller.settings}
      scanSummary={controller.scanSummary}
      cleanupResult={controller.cleanupResult}
      notice={controller.notice}
      isBootstrapping={controller.isBootstrapping}
      onOpenHome={controller.openHome}
      onOpenSettings={controller.openSettings}
      onRefreshDisk={() => {
        void controller.reloadDiskSnapshot()
      }}
      onOpenResults={controller.openResults}
      onOpenLastResults={controller.openLastResults}
      actions={getActions(controller)}
    >
      {renderPage(controller)}
    </AppShell>
  )
}
