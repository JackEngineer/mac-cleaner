import type { RiskLevel } from './types'

export const LARGE_FILE_THRESHOLD_BYTES = 500 * 1024 * 1024
export const OLD_INSTALLER_AGE_DAYS = 30
export const MAX_RESULTS_PER_CATEGORY = 250
export const DIRECTORY_SIZE_PROGRESS_STEP = 64

export const LOW_RISK_LEVELS: RiskLevel[] = ['low']

export const INSTALLER_EXTENSIONS = new Set([
  '.dmg',
  '.pkg',
  '.mpkg',
  '.zip',
  '.tar.gz',
  '.tgz',
  '.7z',
  '.rar',
  '.iso',
  '.xip',
])

export const LARGE_FILE_SKIP_DIR_NAMES = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'DerivedData',
  'Library',
  'Applications',
  'Carthage',
  'Pods',
  'target',
  'build',
  'dist',
  'coverage',
  '.cache',
  '.next',
  '.nuxt',
])

export const LARGE_FILE_SCAN_ROOTS = ['Desktop', 'Documents', 'Movies', 'Music', 'Pictures']

