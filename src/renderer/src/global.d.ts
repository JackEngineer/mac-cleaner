import type { MacCleanerAPI } from '@shared/ipc'

declare global {
  interface Window {
    macCleaner: MacCleanerAPI
  }
}

export {}

