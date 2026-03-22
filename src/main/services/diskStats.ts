import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { statfsSync } from 'node:fs'
import type { DiskHealth, DiskSnapshot } from '@shared/types'

function normalizeNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value
}

function normalizeVolumePath(volumePath: string): string {
  if (!volumePath.trim() || !path.isAbsolute(volumePath)) {
    return '/'
  }

  return path.resolve(volumePath)
}

function clampSpace(totalBytes: number, freeBytes: number): { totalBytes: number; freeBytes: number } {
  const safeTotal = Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : 0
  const safeFree = Number.isFinite(freeBytes) ? Math.max(0, freeBytes) : 0

  return {
    totalBytes: safeTotal,
    freeBytes: Math.min(safeFree, safeTotal),
  }
}

function readStatfs(volumePath: string): { totalBytes: number; freeBytes: number } | undefined {
  try {
    const stats = statfsSync(volumePath)
    return clampSpace(
      normalizeNumber(stats.blocks) * normalizeNumber(stats.bsize),
      normalizeNumber(stats.bavail) * normalizeNumber(stats.bsize),
    )
  } catch {
    return undefined
  }
}

function readDfFallback(volumePath: string): { totalBytes: number; freeBytes: number } | undefined {
  try {
    const output = execFileSync('df', ['-kP', volumePath], { encoding: 'utf8' })
    const lines = output
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const row = lines.at(-1)?.split(/\s+/)

    if (!row || row.length < 4) {
      return undefined
    }

    return clampSpace(Number(row[1]) * 1024, Number(row[3]) * 1024)
  } catch {
    return undefined
  }
}

function getHealth(usagePercent: number): DiskHealth {
  if (usagePercent >= 90) {
    return 'danger'
  }

  if (usagePercent >= 75) {
    return 'tight'
  }

  return 'healthy'
}

export function getDiskSnapshot(volumePath = '/'): DiskSnapshot {
  const normalizedVolumePath = normalizeVolumePath(volumePath)
  const measured = readStatfs(normalizedVolumePath) ?? readDfFallback(normalizedVolumePath) ?? {
    totalBytes: 0,
    freeBytes: 0,
  }

  const totalBytes = measured.totalBytes
  const freeBytes = measured.freeBytes
  const usedBytes = Math.max(0, totalBytes - freeBytes)
  const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0

  return {
    volumePath: normalizedVolumePath,
    totalBytes,
    usedBytes,
    freeBytes,
    usagePercent,
    health: getHealth(usagePercent),
    measuredAt: new Date().toISOString(),
  }
}
