export interface WorkspaceConfig {
  setup?: string[]
  rootDir?: string
}

export const DANGEROUS_WORKSPACE_PATHS = [
  '/',
  '/etc',
  '/dev',
  '/proc',
  '/sys',
  '/boot',
  '/bin',
  '/sbin',
  '/lib',
  '/lib64',
  '/usr',
  '/var',
  '/opt',
  '/root',
  '/run',
  '/tmp',
  '/home',
  '/mnt',
  '/media',
  '/lost+found',
] as const

export const DANGEROUS_PATH_PREFIXES = ['/proc/', '/sys/', '/dev/', '/boot/', '/lost+found/'] as const

export function isValidRootDir(
  path: string,
  dangerousPaths: readonly string[] = DANGEROUS_WORKSPACE_PATHS,
  dangerousPrefixes: readonly string[] = DANGEROUS_PATH_PREFIXES,
): boolean {
  if (!path) return false
  const normalized = path.replace(/\/+$/, '') || '/'
  if (dangerousPaths.includes(normalized)) return false
  for (const prefix of dangerousPrefixes) {
    if (normalized.startsWith(prefix)) return false
  }
  return true
}
