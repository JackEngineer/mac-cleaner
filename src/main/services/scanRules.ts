import path from 'node:path'
import type { CleanupAction, RiskLevel, ScanCategoryResult } from '@shared/types'
import {
  INSTALLER_EXTENSIONS,
  LARGE_FILE_SKIP_DIR_NAMES,
  LARGE_FILE_THRESHOLD_BYTES,
  LARGE_FILE_SCAN_ROOTS,
  OLD_INSTALLER_AGE_DAYS,
} from '@shared/constants'

export const SCAN_CATEGORY_IDS = {
  systemCache: 'system-cache',
  appCache: 'app-cache',
  logs: 'logs',
  trash: 'trash',
  downloadsInstallers: 'downloads-installers',
  downloadsLarge: 'downloads-large',
  largeFiles: 'large-files',
  highRisk: 'high-risk-placeholder',
} as const

export interface ScanCategoryDefinition {
  id: string
  name: string
  description: string
  riskLevel: RiskLevel
  cleanupAction: CleanupAction
  defaultSelected: boolean
  actionable: boolean
  roots: string[]
  note?: string
}

function resolveHomePath(homeDir: string, ...segments: string[]): string {
  return path.join(homeDir, ...segments)
}

export function normalizeAbsolutePath(targetPath: string): string | undefined {
  const trimmed = targetPath.trim()
  if (!trimmed || !path.isAbsolute(trimmed)) {
    return undefined
  }

  return path.resolve(trimmed)
}

export function isPathInsideRoot(
  rootPath: string,
  targetPath: string,
  options?: { allowRoot?: boolean },
): boolean {
  const normalizedRoot = normalizeAbsolutePath(rootPath)
  const normalizedTarget = normalizeAbsolutePath(targetPath)
  if (!normalizedRoot || !normalizedTarget) {
    return false
  }

  const relativePath = path.relative(normalizedRoot, normalizedTarget)
  if (relativePath === '') {
    return options?.allowRoot ?? false
  }

  return relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`)
}

export function isPathInsideAnyRoot(
  rootPaths: string[],
  targetPath: string,
  options?: { allowRoot?: boolean },
): boolean {
  return rootPaths.some((rootPath) => isPathInsideRoot(rootPath, targetPath, options))
}

function sanitizeRoots(rootPaths: string[]): string[] {
  return Array.from(
    new Set(
      rootPaths
        .map((rootPath) => normalizeAbsolutePath(rootPath))
        .filter((rootPath): rootPath is string => Boolean(rootPath)),
    ),
  )
}

function createCategory(
  definition: Omit<ScanCategoryDefinition, 'defaultSelected'>,
): ScanCategoryDefinition {
  return {
    ...definition,
    defaultSelected: definition.riskLevel === 'low',
    roots: sanitizeRoots(definition.roots),
  }
}

export function buildScanCategories(homeDir: string): ScanCategoryDefinition[] {
  return [
    createCategory({
      id: SCAN_CATEGORY_IDS.systemCache,
      name: '系统缓存',
      description: '系统级缓存目录中的可回收内容，默认只做保守清理。',
      riskLevel: 'low',
      cleanupAction: 'move-to-trash',
      actionable: true,
      roots: ['/Library/Caches'],
    }),
    createCategory({
      id: SCAN_CATEGORY_IDS.appCache,
      name: '应用缓存',
      description: '用户级缓存目录中的应用缓存，通常可以安全移除。',
      riskLevel: 'low',
      cleanupAction: 'move-to-trash',
      actionable: true,
      roots: [resolveHomePath(homeDir, 'Library', 'Caches')],
    }),
    createCategory({
      id: SCAN_CATEGORY_IDS.logs,
      name: '日志文件',
      description: '系统和用户日志，适合先看再清理。',
      riskLevel: 'low',
      cleanupAction: 'move-to-trash',
      actionable: true,
      roots: ['/Library/Logs', resolveHomePath(homeDir, 'Library', 'Logs')],
    }),
    createCategory({
      id: SCAN_CATEGORY_IDS.trash,
      name: '废纸篓',
      description: '已放入废纸篓的内容，清理后会从废纸篓中移除。',
      riskLevel: 'low',
      cleanupAction: 'empty-trash',
      actionable: true,
      roots: [resolveHomePath(homeDir, '.Trash')],
    }),
    createCategory({
      id: SCAN_CATEGORY_IDS.downloadsInstallers,
      name: '下载目录旧安装包',
      description: '下载目录中超过 30 天的安装包、镜像和压缩包。',
      riskLevel: 'medium',
      cleanupAction: 'move-to-trash',
      actionable: true,
      roots: [resolveHomePath(homeDir, 'Downloads')],
    }),
    createCategory({
      id: SCAN_CATEGORY_IDS.downloadsLarge,
      name: '下载目录大文件',
      description: '下载目录中超过 500 MB 的大文件，建议先确认用途。',
      riskLevel: 'medium',
      cleanupAction: 'move-to-trash',
      actionable: true,
      roots: [resolveHomePath(homeDir, 'Downloads')],
    }),
    createCategory({
      id: SCAN_CATEGORY_IDS.largeFiles,
      name: '大文件',
      description: '桌面、文稿、影片、音乐和图片中的大文件，先做基础版。',
      riskLevel: 'medium',
      cleanupAction: 'move-to-trash',
      actionable: true,
      roots: LARGE_FILE_SCAN_ROOTS.map((segment) => resolveHomePath(homeDir, segment)),
    }),
    {
      id: SCAN_CATEGORY_IDS.highRisk,
      name: '高风险清理',
      description: 'MVP 暂不开放真实扫描和删除，只保留占位说明。',
      riskLevel: 'high',
      cleanupAction: 'skip',
      defaultSelected: false,
      actionable: false,
      roots: [],
      note: '高风险项在当前版本中不会被扫描或删除。',
    },
  ]
}

export function isOldInstallerCandidate(entryName: string, modifiedAtMs: number, nowMs: number): boolean {
  const lower = entryName.toLowerCase()
  const ageMs = nowMs - modifiedAtMs
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  if (ageDays < OLD_INSTALLER_AGE_DAYS) {
    return false
  }

  if (lower.endsWith('.app') || lower.endsWith('.pkg') || lower.endsWith('.mpkg')) {
    return true
  }

  if (lower.endsWith('.tar.gz')) {
    return true
  }

  return Array.from(INSTALLER_EXTENSIONS).some((extension) => lower.endsWith(extension))
}

export function isLargeEnough(sizeBytes: number): boolean {
  return sizeBytes >= LARGE_FILE_THRESHOLD_BYTES
}

export function shouldSkipLargeTraversal(entryName: string): boolean {
  if (entryName.startsWith('.') && entryName !== '.config') {
    return true
  }

  return LARGE_FILE_SKIP_DIR_NAMES.has(entryName)
}

export function createEmptyCategoryResult(definition: ScanCategoryDefinition): ScanCategoryResult {
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    riskLevel: definition.riskLevel,
    cleanupAction: definition.cleanupAction,
    defaultSelected: definition.defaultSelected,
    actionable: definition.actionable,
    totalBytes: 0,
    itemCount: 0,
    targets: [],
    note: definition.note,
  }
}
