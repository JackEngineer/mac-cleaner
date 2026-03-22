import type { AppSettings, CleanupProgress, CleanupResult, DiskSnapshot, ScanProgress, ScanSummary } from './types'

export const IPC_CHANNELS = {
  getDiskSnapshot: 'mac-cleaner:get-disk-snapshot',
  getSettings: 'mac-cleaner:get-settings',
  updateSettings: 'mac-cleaner:update-settings',
  getLastScanSummary: 'mac-cleaner:get-last-scan-summary',
  getLastCleanupResult: 'mac-cleaner:get-last-cleanup-result',
  startScan: 'mac-cleaner:start-scan',
  startCleanup: 'mac-cleaner:start-cleanup',
  scanProgress: 'mac-cleaner:scan-progress',
  cleanupProgress: 'mac-cleaner:cleanup-progress',
} as const

export interface StartCleanupRequest {
  summary: ScanSummary
  selectedCategoryIds: string[]
  confirmEmptyTrash: boolean
}

export interface MacCleanerAPI {
  getDiskSnapshot: () => Promise<DiskSnapshot>
  getSettings: () => Promise<AppSettings>
  updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
  getLastScanSummary: () => Promise<ScanSummary | undefined>
  getLastCleanupResult: () => Promise<CleanupResult | undefined>
  startScan: () => Promise<ScanSummary>
  startCleanup: (request: StartCleanupRequest) => Promise<CleanupResult>
  onScanProgress: (listener: (progress: ScanProgress) => void) => () => void
  onCleanupProgress: (listener: (progress: CleanupProgress) => void) => () => void
}

