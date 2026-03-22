import Store from 'electron-store'
import type { AppSettings, CleanupResult, ScanSummary } from '@shared/types'

interface PersistedState {
  settings: AppSettings
  lastScanSummary?: ScanSummary
  lastCleanupResult?: CleanupResult
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultSelectLowRisk: true,
  defaultDeletionMode: 'trash',
  allowPermanentDelete: false,
}

let store: Store<PersistedState> | undefined

function getStore(): Store<PersistedState> {
  if (!store) {
    store = new Store<PersistedState>({
      name: 'mac-cleaner',
      defaults: {
        settings: DEFAULT_SETTINGS,
      },
    })
  }

  return store
}

function sanitizeSettings(settings: Partial<AppSettings> | undefined): AppSettings {
  const current = getSettings()
  const merged: AppSettings = {
    ...current,
    ...settings,
    defaultDeletionMode: 'trash',
    allowPermanentDelete: false,
  }

  return merged
}

export function getSettings(): AppSettings {
  return getStore().get('settings', DEFAULT_SETTINGS)
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const nextSettings = sanitizeSettings(patch)
  getStore().set('settings', nextSettings)
  return nextSettings
}

export function getLastScanSummary(): ScanSummary | undefined {
  return getStore().get('lastScanSummary')
}

export function saveLastScanSummary(summary: ScanSummary): ScanSummary {
  getStore().set('lastScanSummary', summary)
  return summary
}

export function getLastCleanupResult(): CleanupResult | undefined {
  return getStore().get('lastCleanupResult')
}

export function saveLastCleanupResult(result: CleanupResult): CleanupResult {
  getStore().set('lastCleanupResult', result)
  return result
}

export function getDefaultSettings(): AppSettings {
  return DEFAULT_SETTINGS
}

