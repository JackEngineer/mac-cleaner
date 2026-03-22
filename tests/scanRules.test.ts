import { describe, expect, it } from 'vitest'
import { INSTALLER_EXTENSIONS, LARGE_FILE_SCAN_ROOTS, LARGE_FILE_THRESHOLD_BYTES } from '@shared/constants'
import {
  buildScanCategories,
  createEmptyCategoryResult,
  isLargeEnough,
  isOldInstallerCandidate,
  isPathInsideAnyRoot,
  normalizeAbsolutePath,
  SCAN_CATEGORY_IDS,
  shouldSkipLargeTraversal,
} from '../src/main/services/scanRules'

describe('scanRules', () => {
  it('builds the expected conservative categories', () => {
    const categories = buildScanCategories('/Users/tester')

    expect(categories.map((category) => category.id)).toEqual([
      SCAN_CATEGORY_IDS.systemCache,
      SCAN_CATEGORY_IDS.appCache,
      SCAN_CATEGORY_IDS.logs,
      SCAN_CATEGORY_IDS.trash,
      SCAN_CATEGORY_IDS.downloadsInstallers,
      SCAN_CATEGORY_IDS.downloadsLarge,
      SCAN_CATEGORY_IDS.largeFiles,
      SCAN_CATEGORY_IDS.highRisk,
    ])

    expect(categories.filter((category) => category.defaultSelected).map((category) => category.id)).toEqual([
      SCAN_CATEGORY_IDS.systemCache,
      SCAN_CATEGORY_IDS.appCache,
      SCAN_CATEGORY_IDS.logs,
      SCAN_CATEGORY_IDS.trash,
    ])

    expect(categories.find((category) => category.id === SCAN_CATEGORY_IDS.systemCache)?.riskLevel).toBe('low')
    expect(categories.find((category) => category.id === SCAN_CATEGORY_IDS.downloadsLarge)?.riskLevel).toBe('medium')
    expect(categories.find((category) => category.id === SCAN_CATEGORY_IDS.highRisk)?.riskLevel).toBe('high')
  })

  it('maps conservative scan roots and preserves the high-risk placeholder', () => {
    const homeDir = '/Users/tester'
    const categories = buildScanCategories(homeDir)

    expect(categories.find((category) => category.id === SCAN_CATEGORY_IDS.systemCache)?.roots).toEqual([
      '/Library/Caches',
    ])
    expect(categories.find((category) => category.id === SCAN_CATEGORY_IDS.appCache)?.roots).toEqual([
      '/Users/tester/Library/Caches',
    ])
    expect(categories.find((category) => category.id === SCAN_CATEGORY_IDS.largeFiles)?.roots).toEqual(
      LARGE_FILE_SCAN_ROOTS.map((segment) => `${homeDir}/${segment}`),
    )

    const highRisk = categories.find((category) => category.id === SCAN_CATEGORY_IDS.highRisk)
    expect(highRisk?.cleanupAction).toBe('skip')
    expect(highRisk?.actionable).toBe(false)
    expect(highRisk?.defaultSelected).toBe(false)
    expect(highRisk?.roots).toEqual([])
    expect(highRisk?.note).toContain('不会被扫描或删除')
  })

  it('detects old installer candidates conservatively', () => {
    const now = Date.now()
    const oldEnough = now - 31 * 24 * 60 * 60 * 1000
    const recent = now - 2 * 24 * 60 * 60 * 1000

    expect(isOldInstallerCandidate('Example.dmg', oldEnough, now)).toBe(true)
    expect(isOldInstallerCandidate('Example.pkg', oldEnough, now)).toBe(true)
    expect(isOldInstallerCandidate('Example.MPKG', oldEnough, now)).toBe(true)
    expect(isOldInstallerCandidate('Example.tar.gz', oldEnough, now)).toBe(true)
    expect(isOldInstallerCandidate('Example.app', oldEnough, now)).toBe(true)
    expect(isOldInstallerCandidate('Example.zip', recent, now)).toBe(false)
    expect(isOldInstallerCandidate('Document.txt', oldEnough, now)).toBe(false)

    for (const extension of INSTALLER_EXTENSIONS) {
      expect(isOldInstallerCandidate(`Archive${extension}`, oldEnough, now)).toBe(true)
    }
  })

  it('treats only large files above the threshold as candidates', () => {
    expect(isLargeEnough(LARGE_FILE_THRESHOLD_BYTES)).toBe(true)
    expect(isLargeEnough(LARGE_FILE_THRESHOLD_BYTES - 1)).toBe(false)
  })

  it('skips traversal into obviously noisy folders', () => {
    expect(shouldSkipLargeTraversal('node_modules')).toBe(true)
    expect(shouldSkipLargeTraversal('.git')).toBe(true)
    expect(shouldSkipLargeTraversal('.cache')).toBe(true)
    expect(shouldSkipLargeTraversal('.config')).toBe(false)
    expect(shouldSkipLargeTraversal('Documents')).toBe(false)
  })

  it('creates empty category results without changing the definition semantics', () => {
    const category = buildScanCategories('/Users/tester').find(
      (item) => item.id === SCAN_CATEGORY_IDS.downloadsInstallers,
    )

    expect(category).toBeDefined()

    const result = createEmptyCategoryResult(category!)
    expect(result.id).toBe(SCAN_CATEGORY_IDS.downloadsInstallers)
    expect(result.totalBytes).toBe(0)
    expect(result.itemCount).toBe(0)
    expect(result.targets).toEqual([])
    expect(result.defaultSelected).toBe(false)
    expect(result.cleanupAction).toBe('move-to-trash')
  })

  it('normalizes roots and validates whether a target stays inside them', () => {
    expect(normalizeAbsolutePath('/Users/tester/Downloads/../Downloads/Example.dmg')).toBe(
      '/Users/tester/Downloads/Example.dmg',
    )
    expect(normalizeAbsolutePath('Downloads/Example.dmg')).toBeUndefined()

    expect(
      isPathInsideAnyRoot(['/Users/tester/Downloads'], '/Users/tester/Downloads/Example.dmg'),
    ).toBe(true)
    expect(
      isPathInsideAnyRoot(['/Users/tester/Downloads'], '/Users/tester/Documents/Example.dmg'),
    ).toBe(false)
  })
})
