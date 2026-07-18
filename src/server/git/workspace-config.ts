import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, join, isAbsolute } from 'node:path'
import type { WorkspaceConfig } from '../../shared/workspace.js'

const CONFIG_FILENAME = '.openfox/workspace.json'

function getConfigPath(workdir: string): string {
  return join(resolve(workdir), CONFIG_FILENAME)
}

export function validateWorkspacesDir(dir: string): void {
  if (!dir || typeof dir !== 'string') throw new Error('workspacesDir is required')
  if (!isAbsolute(dir)) throw new Error('workspacesDir must be an absolute path')
  if (dir === '/') throw new Error('workspacesDir cannot be the root directory')
  if (dir.includes('..')) throw new Error('workspacesDir cannot contain parent directory references')
}

export async function loadWorkspaceConfig(workdir: string): Promise<WorkspaceConfig | null> {
  try {
    const configPath = getConfigPath(workdir)
    const raw = await readFile(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<WorkspaceConfig>
    const hasSetup = Array.isArray(parsed.setup)
    const hasWorkspacesDir = typeof parsed.workspacesDir === 'string'
    if (!hasSetup && !hasWorkspacesDir) return null

    if (hasWorkspacesDir) {
      validateWorkspacesDir(parsed.workspacesDir!)
    }

    return {
      ...(hasSetup ? { setup: parsed.setup! } : {}),
      ...(hasWorkspacesDir ? { workspacesDir: parsed.workspacesDir! } : {}),
    }
  } catch {
    return null
  }
}

export async function saveWorkspaceConfig(workdir: string, config: WorkspaceConfig): Promise<void> {
  const resolved = resolve(workdir)
  const dirPath = join(resolved, '.openfox')
  await mkdir(dirPath, { recursive: true })
  const configPath = getConfigPath(workdir)
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}
