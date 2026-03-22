import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings } from '@shared/types'
import { IPC_CHANNELS, type MacCleanerAPI } from '@shared/ipc'

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T) => {
    listener(payload)
  }

  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: MacCleanerAPI = {
  getDiskSnapshot: async () => ipcRenderer.invoke(IPC_CHANNELS.getDiskSnapshot),
  getSettings: async () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  updateSettings: async (patch: Partial<AppSettings>) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateSettings, patch),
  getLastScanSummary: async () => ipcRenderer.invoke(IPC_CHANNELS.getLastScanSummary),
  getLastCleanupResult: async () => ipcRenderer.invoke(IPC_CHANNELS.getLastCleanupResult),
  startScan: async () => ipcRenderer.invoke(IPC_CHANNELS.startScan),
  startCleanup: async (request) => ipcRenderer.invoke(IPC_CHANNELS.startCleanup, request),
  onScanProgress: (listener) => subscribe(IPC_CHANNELS.scanProgress, listener),
  onCleanupProgress: (listener) => subscribe(IPC_CHANNELS.cleanupProgress, listener),
}

contextBridge.exposeInMainWorld('macCleaner', api)

