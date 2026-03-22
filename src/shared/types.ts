export type AppView = 'home' | 'scanning' | 'results' | 'cleaning' | 'done' | 'settings'

export type RiskLevel = 'low' | 'medium' | 'high'

export type CleanupAction = 'move-to-trash' | 'empty-trash' | 'skip'

export type DeletionPreference = 'trash' | 'permanent'

export type DiskHealth = 'healthy' | 'tight' | 'danger'

export interface DiskSnapshot {
  volumePath: string
  totalBytes: number
  usedBytes: number
  freeBytes: number
  usagePercent: number
  health: DiskHealth
  measuredAt: string
}

export interface AppSettings {
  defaultSelectLowRisk: boolean
  defaultDeletionMode: DeletionPreference
  allowPermanentDelete: boolean
}

export interface ScanTarget {
  path: string
  name: string
  sizeBytes: number
  type: 'file' | 'directory'
  cleanupAction: CleanupAction
  riskLevel: RiskLevel
  categoryId: string
  modifiedAt?: string
}

export interface ScanSkipEntry {
  path: string
  reason: string
}

export interface ScanCategoryResult {
  id: string
  name: string
  description: string
  riskLevel: RiskLevel
  cleanupAction: CleanupAction
  defaultSelected: boolean
  actionable: boolean
  totalBytes: number
  itemCount: number
  note?: string
  targets: ScanTarget[]
}

export interface ScanSummary {
  scannedAt: string
  totalBytes: number
  safeBytes: number
  categories: ScanCategoryResult[]
  skipped: ScanSkipEntry[]
  defaultSelectedCategoryIds: string[]
}

export interface ScanProgress {
  stage: 'preparing' | 'scanning' | 'finalizing'
  categoryId?: string
  categoryName?: string
  categoryIndex: number
  categoryTotal: number
  currentPath?: string
  discoveredBytes: number
  discoveredCount: number
  message: string
}

export interface CleanupProgress {
  total: number
  completed: number
  currentPath?: string
  releasedBytes: number
  message: string
}

export interface CleanupFailure {
  path: string
  reason: string
}

export interface CleanupResult {
  startedAt: string
  finishedAt: string
  releasedBytes: number
  processedCount: number
  skippedCount: number
  failures: CleanupFailure[]
}

