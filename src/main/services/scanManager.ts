import path from 'node:path'
import { promises as fs, type Stats } from 'node:fs'
import type {
  ScanCategoryResult,
  ScanProgress,
  ScanSkipEntry,
  ScanSummary,
  ScanTarget,
} from '@shared/types'
import {
  DIRECTORY_SIZE_PROGRESS_STEP,
  MAX_RESULTS_PER_CATEGORY,
} from '@shared/constants'
import {
  buildScanCategories,
  createEmptyCategoryResult,
  isLargeEnough,
  isOldInstallerCandidate,
  normalizeAbsolutePath,
  SCAN_CATEGORY_IDS,
  shouldSkipLargeTraversal,
  type ScanCategoryDefinition,
} from './scanRules'

const MAX_DIRECTORY_SIZE_DEPTH = 6
const MAX_DIRECTORY_SIZE_ENTRIES = 4000
const MAX_RECURSIVE_SCAN_DEPTH = 8
const MAX_RECURSIVE_SCAN_ENTRIES = 12000

interface ScanContext {
  homeDir: string
  onProgress?: (progress: ScanProgress) => void
}

interface CategoryState {
  targets: ScanTarget[]
  discoveredBytes: number
  discoveredCount: number
  note?: string
  truncated: boolean
}

interface FsReadResult<T> {
  value?: T
  reason?: string
}

interface DirectoryEntry {
  name: string
  isDirectory(): boolean
  isFile(): boolean
  isSymbolicLink(): boolean
}

interface DirectoryMeasureBudget {
  visitedEntries: number
}

interface RecursiveWalkBudget {
  visitedEntries: number
}

interface ScanResult {
  targets: ScanTarget[]
  skips: ScanSkipEntry[]
  note?: string
}

function toIsoString(date: Date | number | string | undefined): string | undefined {
  if (date === undefined) {
    return undefined
  }

  const value = date instanceof Date ? date : new Date(date)
  return Number.isNaN(value.getTime()) ? undefined : value.toISOString()
}

function emitProgress(
  onProgress: ScanContext['onProgress'],
  progress: ScanProgress,
): void {
  onProgress?.(progress)
}

async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve))
}

function buildReadErrorReason(error: unknown, targetKind: '文件' | '目录'): string {
  if (typeof error === 'object' && error && 'code' in error) {
    switch ((error as NodeJS.ErrnoException).code) {
      case 'ENOENT':
        return `${targetKind}不存在，已跳过。`
      case 'EACCES':
      case 'EPERM':
        return `权限不足，无法读取${targetKind}。`
      case 'ENOTDIR':
        return `目标不是${targetKind}，已跳过。`
      case 'ELOOP':
        return '检测到符号链接循环，已跳过。'
      default:
        break
    }
  }

  return `${targetKind}不可访问，已跳过。`
}

function pushSkip(skips: ScanSkipEntry[], pathValue: string, reason: string): void {
  if (skips.some((entry) => entry.path === pathValue && entry.reason === reason)) {
    return
  }

  skips.push({
    path: pathValue,
    reason,
  })
}

function markTruncated(state: CategoryState, reason: string): void {
  if (state.truncated) {
    return
  }

  state.truncated = true
  state.note = reason
}

function createResultLimitNote(): string {
  return `仅显示前 ${MAX_RESULTS_PER_CATEGORY} 项，更多结果已保守跳过。`
}

function createEntryBudgetReason(limit: number): string {
  return `目录项超过 ${limit} 个，MVP 为避免误判已停止继续深入。`
}

function createDepthBudgetReason(limit: number): string {
  return `目录层级超过 ${limit} 层，MVP 为避免误删已停止继续深入。`
}

function createRecursiveBudgetReason(limit: number): string {
  return `扫描目录项超过 ${limit} 个，MVP 已停止继续深入。`
}

async function readDirectoryEntries(directoryPath: string): Promise<FsReadResult<DirectoryEntry[]>> {
  try {
    return {
      value: (await fs.readdir(directoryPath, {
        withFileTypes: true,
        encoding: 'utf8',
      })) as DirectoryEntry[],
    }
  } catch (error) {
    return {
      reason: buildReadErrorReason(error, '目录'),
    }
  }
}

async function readEntryStats(entryPath: string): Promise<FsReadResult<Stats>> {
  try {
    return {
      value: await fs.lstat(entryPath),
    }
  } catch (error) {
    return {
      reason: buildReadErrorReason(error, '文件'),
    }
  }
}

async function measureDirectorySize(
  directoryPath: string,
  skips: ScanSkipEntry[],
  budget: DirectoryMeasureBudget,
  depth = 0,
): Promise<number | undefined> {
  if (depth > MAX_DIRECTORY_SIZE_DEPTH) {
    pushSkip(skips, directoryPath, createDepthBudgetReason(MAX_DIRECTORY_SIZE_DEPTH))
    return undefined
  }

  const entriesResult = await readDirectoryEntries(directoryPath)
  if (!entriesResult.value) {
    pushSkip(skips, directoryPath, entriesResult.reason ?? '目录不可访问，已跳过。')
    return undefined
  }

  let total = 0
  let processed = 0

  for (const entry of entriesResult.value) {
    budget.visitedEntries += 1
    if (budget.visitedEntries > MAX_DIRECTORY_SIZE_ENTRIES) {
      pushSkip(skips, directoryPath, createEntryBudgetReason(MAX_DIRECTORY_SIZE_ENTRIES))
      return undefined
    }

    const entryPath = path.join(directoryPath, entry.name)
    const statsResult = await readEntryStats(entryPath)
    const stats = statsResult.value
    if (!stats || stats.isSymbolicLink()) {
      continue
    }

    if (stats.isDirectory()) {
      const nestedSize = await measureDirectorySize(entryPath, skips, budget, depth + 1)
      if (nestedSize === undefined) {
        return undefined
      }

      total += nestedSize
    } else if (stats.isFile()) {
      total += stats.size
    }

    processed += 1
    if (processed % DIRECTORY_SIZE_PROGRESS_STEP === 0) {
      await yieldToEventLoop()
    }
  }

  return total
}

function createTarget(
  category: ScanCategoryDefinition,
  entryPath: string,
  stats: Stats,
  sizeBytes: number,
): ScanTarget {
  return {
    path: entryPath,
    name: path.basename(entryPath),
    sizeBytes,
    type: stats.isDirectory() ? 'directory' : 'file',
    cleanupAction: category.cleanupAction,
    riskLevel: category.riskLevel,
    categoryId: category.id,
    modifiedAt: toIsoString(stats.mtime),
  }
}

function pushTarget(
  state: CategoryState,
  target: ScanTarget,
  onProgress: ScanContext['onProgress'],
  categoryIndex: number,
  categoryTotal: number,
  categoryName: string,
): boolean {
  if (state.targets.length >= MAX_RESULTS_PER_CATEGORY) {
    markTruncated(state, createResultLimitNote())
    return false
  }

  state.targets.push(target)
  state.discoveredBytes += target.sizeBytes
  state.discoveredCount += 1

  emitProgress(onProgress, {
    stage: 'scanning',
    categoryIndex,
    categoryTotal,
    categoryName,
    categoryId: target.categoryId,
    currentPath: target.path,
    discoveredBytes: state.discoveredBytes,
    discoveredCount: state.discoveredCount,
    message: `已发现 ${target.name}`,
  })

  return true
}

function normalizeRootPaths(rootPaths: string[]): string[] {
  return rootPaths
    .map((rootPath) => normalizeAbsolutePath(rootPath))
    .filter((rootPath): rootPath is string => Boolean(rootPath))
}

function shouldStopRecursiveWalk(
  directoryPath: string,
  skips: ScanSkipEntry[],
  budget: RecursiveWalkBudget,
  depth: number,
): boolean {
  if (depth > MAX_RECURSIVE_SCAN_DEPTH) {
    pushSkip(skips, directoryPath, createDepthBudgetReason(MAX_RECURSIVE_SCAN_DEPTH))
    return true
  }

  if (budget.visitedEntries > MAX_RECURSIVE_SCAN_ENTRIES) {
    pushSkip(skips, directoryPath, createRecursiveBudgetReason(MAX_RECURSIVE_SCAN_ENTRIES))
    return true
  }

  return false
}

async function scanTopLevelCategory(
  category: ScanCategoryDefinition,
  rootPaths: string[],
  ctx: ScanContext,
  categoryIndex: number,
  categoryTotal: number,
): Promise<ScanResult> {
  const state: CategoryState = {
    targets: [],
    discoveredBytes: 0,
    discoveredCount: 0,
    truncated: false,
  }
  const skips: ScanSkipEntry[] = []

  for (const rootPath of normalizeRootPaths(rootPaths)) {
    const entriesResult = await readDirectoryEntries(rootPath)
    if (!entriesResult.value) {
      pushSkip(skips, rootPath, entriesResult.reason ?? '目录不可访问或不存在，已跳过。')
      continue
    }

    for (const entry of entriesResult.value) {
      const entryPath = path.join(rootPath, entry.name)
      const statsResult = await readEntryStats(entryPath)
      const stats = statsResult.value
      if (!stats || stats.isSymbolicLink()) {
        continue
      }

      let sizeBytes = 0
      if (stats.isDirectory()) {
        const measuredSize = await measureDirectorySize(
          entryPath,
          skips,
          { visitedEntries: 0 },
        )
        if (measuredSize === undefined) {
          continue
        }

        sizeBytes = measuredSize
      } else if (stats.isFile()) {
        sizeBytes = stats.size
      }

      if (sizeBytes <= 0) {
        continue
      }

      const target = createTarget(category, entryPath, stats, sizeBytes)
      const shouldContinue = pushTarget(
        state,
        target,
        ctx.onProgress,
        categoryIndex,
        categoryTotal,
        category.name,
      )

      if (!shouldContinue) {
        return { targets: state.targets, skips, note: state.note }
      }

      await yieldToEventLoop()
    }
  }

  return {
    targets: state.targets,
    skips,
    note: state.note,
  }
}

async function scanInstallerFiles(
  category: ScanCategoryDefinition,
  rootPath: string,
  ctx: ScanContext,
  categoryIndex: number,
  categoryTotal: number,
  seenPaths: Set<string>,
): Promise<ScanResult> {
  const state: CategoryState = {
    targets: [],
    discoveredBytes: 0,
    discoveredCount: 0,
    truncated: false,
  }
  const skips: ScanSkipEntry[] = []
  const now = Date.now()
  const normalizedRoot = normalizeAbsolutePath(rootPath)
  const budget: RecursiveWalkBudget = {
    visitedEntries: 0,
  }

  if (!normalizedRoot) {
    pushSkip(skips, rootPath, '扫描根目录无效，已跳过。')
    return {
      targets: state.targets,
      skips,
      note: state.note,
    }
  }

  const walk = async (directoryPath: string, depth: number): Promise<void> => {
    if (state.targets.length >= MAX_RESULTS_PER_CATEGORY) {
      markTruncated(state, createResultLimitNote())
      return
    }

    if (shouldStopRecursiveWalk(directoryPath, skips, budget, depth)) {
      return
    }

    const entriesResult = await readDirectoryEntries(directoryPath)
    if (!entriesResult.value) {
      pushSkip(skips, directoryPath, entriesResult.reason ?? '目录不可访问，已跳过。')
      return
    }

    for (const entry of entriesResult.value) {
      budget.visitedEntries += 1
      if (shouldStopRecursiveWalk(directoryPath, skips, budget, depth)) {
        markTruncated(state, createRecursiveBudgetReason(MAX_RECURSIVE_SCAN_ENTRIES))
        return
      }

      const entryPath = path.join(directoryPath, entry.name)
      if (seenPaths.has(entryPath)) {
        continue
      }

      const statsResult = await readEntryStats(entryPath)
      const stats = statsResult.value
      if (!stats || stats.isSymbolicLink()) {
        continue
      }

      if (stats.isDirectory()) {
        if (isOldInstallerCandidate(entry.name, stats.mtimeMs, now)) {
          const measuredSize = await measureDirectorySize(
            entryPath,
            skips,
            { visitedEntries: 0 },
          )
          if (measuredSize === undefined || measuredSize <= 0) {
            continue
          }

          const target = createTarget(category, entryPath, stats, measuredSize)
          seenPaths.add(entryPath)
          const shouldContinue = pushTarget(
            state,
            target,
            ctx.onProgress,
            categoryIndex,
            categoryTotal,
            category.name,
          )
          if (!shouldContinue) {
            return
          }

          continue
        }

        if (shouldSkipLargeTraversal(entry.name)) {
          continue
        }

        await walk(entryPath, depth + 1)
        continue
      }

      if (stats.isFile() && isOldInstallerCandidate(entry.name, stats.mtimeMs, now)) {
        const target = createTarget(category, entryPath, stats, stats.size)
        seenPaths.add(entryPath)
        const shouldContinue = pushTarget(
          state,
          target,
          ctx.onProgress,
          categoryIndex,
          categoryTotal,
          category.name,
        )
        if (!shouldContinue) {
          return
        }
      }
    }
  }

  await walk(normalizedRoot, 0)
  return {
    targets: state.targets,
    skips,
    note: state.note,
  }
}

async function scanLargeFiles(
  category: ScanCategoryDefinition,
  roots: string[],
  ctx: ScanContext,
  categoryIndex: number,
  categoryTotal: number,
  seenPaths: Set<string>,
): Promise<ScanResult> {
  const state: CategoryState = {
    targets: [],
    discoveredBytes: 0,
    discoveredCount: 0,
    truncated: false,
  }
  const skips: ScanSkipEntry[] = []
  const budget: RecursiveWalkBudget = {
    visitedEntries: 0,
  }

  const walk = async (directoryPath: string, depth: number): Promise<void> => {
    if (state.targets.length >= MAX_RESULTS_PER_CATEGORY) {
      markTruncated(state, createResultLimitNote())
      return
    }

    if (shouldStopRecursiveWalk(directoryPath, skips, budget, depth)) {
      return
    }

    const entriesResult = await readDirectoryEntries(directoryPath)
    if (!entriesResult.value) {
      pushSkip(skips, directoryPath, entriesResult.reason ?? '目录不可访问，已跳过。')
      return
    }

    for (const entry of entriesResult.value) {
      budget.visitedEntries += 1
      if (shouldStopRecursiveWalk(directoryPath, skips, budget, depth)) {
        markTruncated(state, createRecursiveBudgetReason(MAX_RECURSIVE_SCAN_ENTRIES))
        return
      }

      const entryPath = path.join(directoryPath, entry.name)
      if (seenPaths.has(entryPath)) {
        continue
      }

      const statsResult = await readEntryStats(entryPath)
      const stats = statsResult.value
      if (!stats || stats.isSymbolicLink()) {
        continue
      }

      if (stats.isDirectory()) {
        if (shouldSkipLargeTraversal(entry.name)) {
          continue
        }

        await walk(entryPath, depth + 1)
        continue
      }

      if (stats.isFile() && isLargeEnough(stats.size)) {
        const target = createTarget(category, entryPath, stats, stats.size)
        seenPaths.add(entryPath)
        const shouldContinue = pushTarget(
          state,
          target,
          ctx.onProgress,
          categoryIndex,
          categoryTotal,
          category.name,
        )
        if (!shouldContinue) {
          return
        }
      }
    }
  }

  for (const rootPath of normalizeRootPaths(roots)) {
    await walk(rootPath, 0)
  }

  return {
    targets: state.targets,
    skips,
    note: state.note,
  }
}

function toCategoryResult(
  definition: ScanCategoryDefinition,
  targets: ScanTarget[],
  note?: string,
): ScanCategoryResult {
  const totalBytes = targets.reduce((sum, target) => sum + target.sizeBytes, 0)
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    riskLevel: definition.riskLevel,
    cleanupAction: definition.cleanupAction,
    defaultSelected: definition.defaultSelected,
    actionable: definition.actionable,
    totalBytes,
    itemCount: targets.length,
    targets,
    note,
  }
}

export async function runScan(ctx: ScanContext): Promise<ScanSummary> {
  const categories = buildScanCategories(ctx.homeDir)
  const seenPaths = new Set<string>()
  const results: ScanCategoryResult[] = []
  const skipped: ScanSkipEntry[] = []
  const categoryTotal = categories.length
  let totalBytes = 0
  let safeBytes = 0

  emitProgress(ctx.onProgress, {
    stage: 'preparing',
    categoryIndex: 0,
    categoryTotal,
    discoveredBytes: 0,
    discoveredCount: 0,
    message: '正在准备扫描规则。',
  })

  for (const [index, definition] of categories.entries()) {
    emitProgress(ctx.onProgress, {
      stage: 'scanning',
      categoryIndex: index + 1,
      categoryTotal,
      categoryId: definition.id,
      categoryName: definition.name,
      discoveredBytes: 0,
      discoveredCount: 0,
      message: `正在扫描 ${definition.name}`,
    })

    if (definition.id === SCAN_CATEGORY_IDS.highRisk) {
      results.push(createEmptyCategoryResult(definition))
      continue
    }

    let scanResult: ScanResult

    if (
      definition.id === SCAN_CATEGORY_IDS.systemCache
      || definition.id === SCAN_CATEGORY_IDS.appCache
      || definition.id === SCAN_CATEGORY_IDS.logs
      || definition.id === SCAN_CATEGORY_IDS.trash
    ) {
      scanResult = await scanTopLevelCategory(
        definition,
        definition.roots,
        ctx,
        index + 1,
        categoryTotal,
      )
    } else if (definition.id === SCAN_CATEGORY_IDS.downloadsInstallers) {
      const [rootPath] = definition.roots
      scanResult = rootPath
        ? await scanInstallerFiles(definition, rootPath, ctx, index + 1, categoryTotal, seenPaths)
        : {
            targets: [],
            skips: [{ path: '', reason: '扫描根目录缺失，已跳过。' }],
          }
    } else if (
      definition.id === SCAN_CATEGORY_IDS.downloadsLarge
      || definition.id === SCAN_CATEGORY_IDS.largeFiles
    ) {
      scanResult = await scanLargeFiles(
        definition,
        definition.roots,
        ctx,
        index + 1,
        categoryTotal,
        seenPaths,
      )
    } else {
      scanResult = {
        targets: [],
        skips: [],
      }
    }

    skipped.push(...scanResult.skips)
    const result = toCategoryResult(definition, scanResult.targets, scanResult.note)
    results.push(result)

    totalBytes += result.totalBytes
    if (result.riskLevel === 'low' && result.actionable) {
      safeBytes += result.totalBytes
    }
  }

  emitProgress(ctx.onProgress, {
    stage: 'finalizing',
    categoryIndex: categoryTotal,
    categoryTotal,
    discoveredBytes: totalBytes,
    discoveredCount: results.reduce((sum, item) => sum + item.itemCount, 0),
    message: '正在整理扫描结果。',
  })

  return {
    scannedAt: new Date().toISOString(),
    totalBytes,
    safeBytes,
    categories: results,
    skipped,
    defaultSelectedCategoryIds: results
      .filter((category) => category.defaultSelected && category.actionable)
      .map((category) => category.id),
  }
}
