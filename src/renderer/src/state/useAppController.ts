import { useEffect, useMemo, useState } from 'react'
import type {
  AppSettings,
  AppView,
  CleanupProgress,
  CleanupResult,
  DiskSnapshot,
  ScanCategoryResult,
  ScanProgress,
  ScanSummary,
} from '@shared/types'

function deriveSelectedCategoryIds(summary: ScanSummary | null, settings: AppSettings): string[] {
  if (!summary || !settings.defaultSelectLowRisk) {
    return []
  }

  return summary.categories
    .filter((category) => category.defaultSelected && category.actionable)
    .map((category) => category.id)
}

export function useAppController() {
  const [view, setView] = useState<AppView>('home')
  const [diskSnapshot, setDiskSnapshot] = useState<DiskSnapshot | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null)
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
  const [cleanupProgress, setCleanupProgress] = useState<CleanupProgress | null>(null)
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadInitialState = async () => {
      try {
        const [snapshot, loadedSettings, loadedScanSummary, loadedCleanupResult] = await Promise.all([
          window.macCleaner.getDiskSnapshot(),
          window.macCleaner.getSettings(),
          window.macCleaner.getLastScanSummary(),
          window.macCleaner.getLastCleanupResult(),
        ])

        if (cancelled) {
          return
        }

        setDiskSnapshot(snapshot)
        setSettings(loadedSettings)
        setScanSummary(loadedScanSummary ?? null)
        setCleanupResult(loadedCleanupResult ?? null)
        setSelectedCategoryIds(
          deriveSelectedCategoryIds(loadedScanSummary ?? null, loadedSettings),
        )
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : '初始化失败'
          setNotice(message)
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false)
        }
      }
    }

    const unsubscribeScan = window.macCleaner.onScanProgress((progress) => {
      setScanProgress(progress)
    })
    const unsubscribeCleanup = window.macCleaner.onCleanupProgress((progress) => {
      setCleanupProgress(progress)
    })

    void loadInitialState()

    return () => {
      cancelled = true
      unsubscribeScan()
      unsubscribeCleanup()
    }
  }, [])

  const selectedCategories = useMemo(() => {
    if (!scanSummary) {
      return []
    }

    const selected = new Set(selectedCategoryIds)
    return scanSummary.categories.filter((category) => selected.has(category.id))
  }, [scanSummary, selectedCategoryIds])

  const selectedBytes = useMemo(() => {
    return selectedCategories.reduce((sum, category) => sum + category.totalBytes, 0)
  }, [selectedCategories])

  const actionableCategoryCount = useMemo(() => {
    return scanSummary?.categories.filter((category) => category.actionable).length ?? 0
  }, [scanSummary])

  const readonlyCategoryCount = useMemo(() => {
    return scanSummary?.categories.filter((category) => !category.actionable).length ?? 0
  }, [scanSummary])

  const safeBytes = scanSummary?.safeBytes ?? 0

  const openHome = () => {
    setView('home')
    setNotice(null)
  }

  const openSettings = () => {
    setView('settings')
    setNotice(null)
  }

  const openResults = () => {
    if (scanSummary) {
      setView('results')
      setNotice(null)
    }
  }

  const openCleaning = () => {
    if (scanSummary) {
      setView('cleaning')
      setConfirmEmptyTrash(false)
      setNotice(null)
    }
  }

  const openLastResults = () => {
    if (scanSummary) {
      setSelectedCategoryIds(deriveSelectedCategoryIds(scanSummary, settings ?? getFallbackSettings()))
      setView('results')
      setNotice(null)
    }
  }

  const getSelectedSettings = (): AppSettings => {
    return settings ?? getFallbackSettings()
  }

  const startScan = async () => {
    setNotice(null)
    setCleanupResult(null)
    setCleanupProgress(null)
    setConfirmEmptyTrash(false)
    setScanProgress({
      stage: 'preparing',
      categoryIndex: 0,
      categoryTotal: 0,
      discoveredBytes: 0,
      discoveredCount: 0,
      message: '正在启动扫描。',
    })
    setView('scanning')

    try {
      const summary = await window.macCleaner.startScan()
      const currentSettings = getSelectedSettings()
      setScanSummary(summary)
      setSelectedCategoryIds(deriveSelectedCategoryIds(summary, currentSettings))
      setView('results')
    } catch (error) {
      const message = error instanceof Error ? error.message : '扫描失败'
      setNotice(message)
      setView('home')
    } finally {
      setScanProgress(null)
    }
  }

  const toggleCategory = (categoryId: string) => {
    if (!scanSummary) {
      return
    }

    const category = scanSummary.categories.find((item) => item.id === categoryId)
    if (!category || !category.actionable) {
      return
    }

    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((item) => item !== categoryId)
        : [...current, categoryId],
    )
    setConfirmEmptyTrash(false)
  }

  const selectDefaults = () => {
    if (!scanSummary) {
      return
    }

    const currentSettings = getSelectedSettings()
    setSelectedCategoryIds(deriveSelectedCategoryIds(scanSummary, currentSettings))
    setConfirmEmptyTrash(false)
  }

  const updateSettings = async (patch: Partial<AppSettings>) => {
    setNotice(null)

    try {
      const nextSettings = await window.macCleaner.updateSettings(patch)
      setSettings(nextSettings)
      setNotice('设置已保存。')
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存设置失败'
      setNotice(message)
    }
  }

  const startCleanup = async () => {
    if (!scanSummary) {
      setNotice('请先完成扫描。')
      return
    }

    if (selectedCategoryIds.length === 0) {
      setNotice('请至少选择一个分类。')
      return
    }

    setNotice(null)
    setView('cleaning')
    setCleanupProgress({
      total: selectedCategories.reduce((sum, category) => sum + category.targets.length, 0),
      completed: 0,
      releasedBytes: 0,
      message: '正在准备清理。',
    })

    try {
      const result = await window.macCleaner.startCleanup({
        summary: scanSummary,
        selectedCategoryIds,
        confirmEmptyTrash,
      })

      setCleanupResult(result)
      setConfirmEmptyTrash(false)
      setView('done')
    } catch (error) {
      const message = error instanceof Error ? error.message : '清理失败'
      setNotice(message)
      setView('results')
    } finally {
      setCleanupProgress(null)
    }
  }

  const resetCleanupConfirmation = () => {
    setConfirmEmptyTrash(false)
  }

  const hasEmptyTrashSelection = useMemo(() => {
    return selectedCategories.some((category) => category.cleanupAction === 'empty-trash')
  }, [selectedCategories])

  return {
    view,
    setView,
    diskSnapshot,
    settings,
    scanSummary,
    cleanupResult,
    selectedCategoryIds,
    selectedCategories,
    selectedBytes,
    safeBytes,
    actionableCategoryCount,
    readonlyCategoryCount,
    scanProgress,
    cleanupProgress,
    confirmEmptyTrash,
    setConfirmEmptyTrash,
    isBootstrapping,
    notice,
    hasEmptyTrashSelection,
    openHome,
    openSettings,
    openResults,
    openCleaning,
    openLastResults,
    startScan,
    startCleanup,
    toggleCategory,
    selectDefaults,
    updateSettings,
    resetCleanupConfirmation,
    reloadDiskSnapshot: async () => {
      const nextSnapshot = await window.macCleaner.getDiskSnapshot()
      setDiskSnapshot(nextSnapshot)
      return nextSnapshot
    },
  }
}

export type AppController = ReturnType<typeof useAppController>

function getFallbackSettings(): AppSettings {
  return {
    defaultSelectLowRisk: true,
    defaultDeletionMode: 'trash',
    allowPermanentDelete: false,
  }
}
