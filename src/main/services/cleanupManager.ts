import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import trash from 'trash'
import type {
  CleanupFailure,
  CleanupProgress,
  CleanupResult,
  ScanSummary,
  ScanTarget,
} from '@shared/types'
import {
  buildScanCategories,
  isPathInsideAnyRoot,
  normalizeAbsolutePath,
} from './scanRules'

interface CleanupRequest {
  summary: ScanSummary
  selectedCategoryIds: string[]
  confirmEmptyTrash: boolean
}

interface CleanupPlan {
  targets: ScanTarget[]
  rejectedTargets: CleanupFailure[]
  requiresEmptyTrashConfirmation: boolean
}

function buildRemovalError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '未知错误'
}

function getCleanupDefinitionMap() {
  return new Map(
    buildScanCategories(os.homedir()).map((definition) => [definition.id, definition]),
  )
}

function validatePlannedTarget(
  summary: ScanSummary,
  definitions: ReturnType<typeof getCleanupDefinitionMap>,
  target: ScanTarget,
): { target?: ScanTarget; rejection?: CleanupFailure } {
  const normalizedPath = normalizeAbsolutePath(target.path)
  if (!normalizedPath) {
    return {
      rejection: {
        path: target.path,
        reason: '目标路径无效，已跳过。',
      },
    }
  }

  const definition = definitions.get(target.categoryId)
  const category = summary.categories.find((entry) => entry.id === target.categoryId)
  if (!definition || !category || !category.actionable || !definition.actionable) {
    return {
      rejection: {
        path: normalizedPath,
        reason: '目标分类不允许清理，已跳过。',
      },
    }
  }

  if (definition.riskLevel === 'high' || category.riskLevel === 'high' || target.riskLevel === 'high') {
    return {
      rejection: {
        path: normalizedPath,
        reason: '高风险项目在当前版本中不会执行清理。',
      },
    }
  }

  if (target.cleanupAction !== category.cleanupAction || category.cleanupAction !== definition.cleanupAction) {
    return {
      rejection: {
        path: normalizedPath,
        reason: '清理动作与分类定义不一致，已跳过。',
      },
    }
  }

  if (!isPathInsideAnyRoot(definition.roots, normalizedPath)) {
    return {
      rejection: {
        path: normalizedPath,
        reason: '目标路径超出允许的清理范围，已跳过。',
      },
    }
  }

  const trashRoot = path.join(os.homedir(), '.Trash')
  if (target.cleanupAction === 'empty-trash' && !isPathInsideAnyRoot([trashRoot], normalizedPath)) {
    return {
      rejection: {
        path: normalizedPath,
        reason: '仅允许清空当前用户废纸篓中的项目。',
      },
    }
  }

  if (target.cleanupAction === 'move-to-trash' && isPathInsideAnyRoot([trashRoot], normalizedPath, { allowRoot: true })) {
    return {
      rejection: {
        path: normalizedPath,
        reason: '目标已位于废纸篓中，已跳过。',
      },
    }
  }

  return {
    target: {
      ...target,
      path: normalizedPath,
      name: target.name || path.basename(normalizedPath),
    },
  }
}

export function planCleanupTargets(request: CleanupRequest): CleanupPlan {
  const definitions = getCleanupDefinitionMap()
  const selectedCategories = request.summary.categories.filter((category) =>
    request.selectedCategoryIds.includes(category.id) && category.actionable,
  )

  const targets: ScanTarget[] = []
  const rejectedTargets: CleanupFailure[] = []
  const seenPaths = new Set<string>()

  for (const category of selectedCategories) {
    for (const target of category.targets) {
      const validation = validatePlannedTarget(request.summary, definitions, target)
      if (validation.rejection) {
        rejectedTargets.push(validation.rejection)
        continue
      }

      if (!validation.target || seenPaths.has(validation.target.path)) {
        continue
      }

      seenPaths.add(validation.target.path)
      targets.push(validation.target)
    }
  }

  const requiresEmptyTrashConfirmation = targets.some(
    (target) => target.cleanupAction === 'empty-trash',
  )

  return {
    targets,
    rejectedTargets,
    requiresEmptyTrashConfirmation,
  }
}

async function inspectCleanupTarget(target: ScanTarget): Promise<string | undefined> {
  try {
    const stats = await fs.lstat(target.path)
    if (stats.isSymbolicLink()) {
      return '符号链接不会被自动清理。'
    }

    return undefined
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error) {
      switch ((error as NodeJS.ErrnoException).code) {
        case 'ENOENT':
          return '目标已不存在，可能已被移动或删除。'
        case 'EACCES':
        case 'EPERM':
          return '权限不足，无法修改此目标。'
        default:
          break
      }
    }

    return buildRemovalError(error)
  }
}

export async function runCleanup(
  request: CleanupRequest,
  onProgress?: (progress: CleanupProgress) => void,
): Promise<CleanupResult> {
  const plan = planCleanupTargets(request)

  if (plan.requiresEmptyTrashConfirmation && !request.confirmEmptyTrash) {
    throw new Error('清空废纸篓需要先确认。')
  }

  const startedAt = new Date().toISOString()
  const failures: CleanupFailure[] = [...plan.rejectedTargets]
  let releasedBytes = 0
  let processedCount = 0
  let skippedCount = plan.rejectedTargets.length

  onProgress?.({
    total: plan.targets.length,
    completed: 0,
    releasedBytes: 0,
    message: '开始执行安全清理。',
  })

  for (const [index, target] of plan.targets.entries()) {
    onProgress?.({
      total: plan.targets.length,
      completed: index,
      currentPath: target.path,
      releasedBytes,
      message:
        target.cleanupAction === 'empty-trash'
          ? '正在从废纸篓中移除项目。'
          : '正在移到废纸篓。',
    })

    const inspectionFailure = await inspectCleanupTarget(target)
    if (inspectionFailure) {
      skippedCount += 1
      failures.push({
        path: target.path,
        reason: inspectionFailure,
      })

      onProgress?.({
        total: plan.targets.length,
        completed: index + 1,
        currentPath: target.path,
        releasedBytes,
        message: inspectionFailure,
      })
      continue
    }

    try {
      if (target.cleanupAction === 'move-to-trash') {
        await trash(target.path)
      } else if (target.cleanupAction === 'empty-trash') {
        await fs.rm(target.path, { recursive: true, force: true })
      } else {
        skippedCount += 1
        failures.push({
          path: target.path,
          reason: '当前动作不允许执行清理。',
        })
        continue
      }

      releasedBytes += target.sizeBytes
      processedCount += 1
    } catch (error) {
      failures.push({
        path: target.path,
        reason: buildRemovalError(error),
      })
    }

    onProgress?.({
      total: plan.targets.length,
      completed: index + 1,
      currentPath: target.path,
      releasedBytes,
      message:
        target.cleanupAction === 'empty-trash'
          ? '已从废纸篓移除。'
          : '已移到废纸篓。',
    })
  }

  onProgress?.({
    total: plan.targets.length,
    completed: plan.targets.length,
    releasedBytes,
    message: '清理流程已完成。',
  })

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    releasedBytes,
    processedCount,
    skippedCount,
    failures,
  }
}
