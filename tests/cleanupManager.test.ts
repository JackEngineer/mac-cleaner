import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ScanSummary } from '@shared/types'
import { planCleanupTargets, runCleanup } from '../src/main/services/cleanupManager'

const homeDir = os.homedir()

const summary: ScanSummary = {
  scannedAt: '2026-03-22T00:00:00.000Z',
  totalBytes: 1024,
  safeBytes: 512,
  defaultSelectedCategoryIds: ['system-cache'],
  skipped: [],
  categories: [
    {
      id: 'system-cache',
      name: '系统缓存',
      description: 'test',
      riskLevel: 'low',
      cleanupAction: 'move-to-trash',
      defaultSelected: true,
      actionable: true,
      totalBytes: 256,
      itemCount: 1,
      targets: [
        {
          path: '/Library/Caches/com.example.test',
          name: 'com.example.test',
          sizeBytes: 256,
          type: 'directory',
          cleanupAction: 'move-to-trash',
          riskLevel: 'low',
          categoryId: 'system-cache',
        },
      ],
    },
    {
      id: 'trash',
      name: '废纸篓',
      description: 'test',
      riskLevel: 'low',
      cleanupAction: 'empty-trash',
      defaultSelected: true,
      actionable: true,
      totalBytes: 512,
      itemCount: 1,
      targets: [
        {
          path: path.join(homeDir, '.Trash', 'trash-item'),
          name: 'trash-item',
          sizeBytes: 512,
          type: 'file',
          cleanupAction: 'empty-trash',
          riskLevel: 'low',
          categoryId: 'trash',
        },
      ],
    },
    {
      id: 'high-risk-placeholder',
      name: '高风险',
      description: 'test',
      riskLevel: 'high',
      cleanupAction: 'skip',
      defaultSelected: false,
      actionable: false,
      totalBytes: 256,
      itemCount: 1,
      note: 'placeholder',
      targets: [
        {
          path: path.join(homeDir, 'Documents', 'protected'),
          name: 'protected',
          sizeBytes: 256,
          type: 'file',
          cleanupAction: 'skip',
          riskLevel: 'high',
          categoryId: 'high-risk-placeholder',
        },
      ],
    },
  ],
}

describe('cleanupManager', () => {
  it('plans only actionable selected targets and requires confirmation for trash cleanup', () => {
    const plan = planCleanupTargets({
      summary,
      selectedCategoryIds: ['system-cache', 'trash', 'high-risk-placeholder'],
      confirmEmptyTrash: false,
    })

    expect(plan.targets.map((target) => target.categoryId)).toEqual(['system-cache', 'trash'])
    expect(plan.rejectedTargets).toEqual([])
    expect(plan.requiresEmptyTrashConfirmation).toBe(true)
  })

  it('rejects targets outside allowed cleanup roots', () => {
    const invalidSummary: ScanSummary = {
      ...summary,
      categories: [
        {
          ...summary.categories[0],
          targets: [
            {
              ...summary.categories[0].targets[0],
              path: path.join(homeDir, 'Documents', 'not-cache'),
            },
          ],
        },
      ],
    }

    const plan = planCleanupTargets({
      summary: invalidSummary,
      selectedCategoryIds: ['system-cache'],
      confirmEmptyTrash: false,
    })

    expect(plan.targets).toEqual([])
    expect(plan.rejectedTargets).toEqual([
      {
        path: path.join(homeDir, 'Documents', 'not-cache'),
        reason: '目标路径超出允许的清理范围，已跳过。',
      },
    ])
  })

  it('does not require empty trash confirmation when trash is not selected', () => {
    const plan = planCleanupTargets({
      summary,
      selectedCategoryIds: ['system-cache'],
      confirmEmptyTrash: false,
    })

    expect(plan.targets.map((target) => target.categoryId)).toEqual(['system-cache'])
    expect(plan.requiresEmptyTrashConfirmation).toBe(false)
  })

  it('deduplicates identical cleanup targets conservatively', () => {
    const duplicatedSummary: ScanSummary = {
      ...summary,
      categories: [
        {
          ...summary.categories[0],
          targets: [
            summary.categories[0].targets[0],
            {
              ...summary.categories[0].targets[0],
            },
          ],
        },
      ],
    }

    const plan = planCleanupTargets({
      summary: duplicatedSummary,
      selectedCategoryIds: ['system-cache'],
      confirmEmptyTrash: false,
    })

    expect(plan.targets).toHaveLength(1)
    expect(plan.targets[0]?.path).toBe('/Library/Caches/com.example.test')
  })

  it('fails fast when trash cleanup is selected without explicit confirmation', async () => {
    await expect(
      runCleanup({
        summary,
        selectedCategoryIds: ['trash'],
        confirmEmptyTrash: false,
      }),
    ).rejects.toThrow('清空废纸篓需要先确认。')
  })

  it('completes safely when there are no cleanup targets', async () => {
    const progressMessages: string[] = []

    const result = await runCleanup(
      {
        summary,
        selectedCategoryIds: ['high-risk-placeholder'],
        confirmEmptyTrash: false,
      },
      (progress) => {
        progressMessages.push(progress.message)
      },
    )

    expect(result.releasedBytes).toBe(0)
    expect(result.processedCount).toBe(0)
    expect(result.skippedCount).toBe(0)
    expect(result.failures).toEqual([])
    expect(progressMessages).toEqual(['开始执行安全清理。', '清理流程已完成。'])
  })
})
