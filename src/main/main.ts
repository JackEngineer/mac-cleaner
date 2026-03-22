import { app, BrowserWindow, ipcMain } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { IPC_CHANNELS, type StartCleanupRequest } from '@shared/ipc'
import type { CleanupProgress, ScanProgress } from '@shared/types'
import { getDiskSnapshot } from './services/diskStats'
import { runCleanup } from './services/cleanupManager'
import { runScan } from './services/scanManager'
import {
  getLastCleanupResult,
  getLastScanSummary,
  getSettings,
  saveLastCleanupResult,
  saveLastScanSummary,
  updateSettings,
} from './services/settingsStore'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function sendScanProgress(progress: ScanProgress) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  mainWindow.webContents.send(IPC_CHANNELS.scanProgress, progress)
}

function sendCleanupProgress(progress: CleanupProgress) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  mainWindow.webContents.send(IPC_CHANNELS.cleanupProgress, progress)
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: '#f5f2ec',
    title: 'Mac Cleaner MVP',
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.mjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null
    }
  })

  window.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    console.error('Renderer failed to load:', errorCode, errorDescription)
  })

  return window
}

async function loadRenderer(window: BrowserWindow): Promise<void> {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (!app.isPackaged && rendererUrl) {
    await window.loadURL(rendererUrl)
    return
  }

  await window.loadFile(join(__dirname, '../renderer/index.html'))
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.getDiskSnapshot, async () => getDiskSnapshot('/'))

  ipcMain.handle(IPC_CHANNELS.getSettings, async () => getSettings())

  ipcMain.handle(IPC_CHANNELS.updateSettings, async (_, patch) => updateSettings(patch))

  ipcMain.handle(IPC_CHANNELS.getLastScanSummary, async () => getLastScanSummary())

  ipcMain.handle(IPC_CHANNELS.getLastCleanupResult, async () => getLastCleanupResult())

  ipcMain.handle(IPC_CHANNELS.startScan, async () => {
    const summary = await runScan({
      homeDir: os.homedir(),
      onProgress: (progress) => {
        sendScanProgress(progress)
      },
    })

    saveLastScanSummary(summary)
    return summary
  })

  ipcMain.handle(IPC_CHANNELS.startCleanup, async (_, request: StartCleanupRequest) => {
    const result = await runCleanup(request, (progress) => {
      sendCleanupProgress(progress)
    })

    saveLastCleanupResult(result)
    return result
  })
}

async function bootstrap(): Promise<void> {
  await app.whenReady()
  registerIpc()
  mainWindow = createWindow()

  await loadRenderer(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      void loadRenderer(mainWindow)
    }
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

void bootstrap()
