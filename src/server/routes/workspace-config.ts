import { Router } from 'express'
import { stat, mkdir, readdir, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve, isAbsolute, join } from 'node:path'
import { homedir } from 'node:os'
import { loadWorkspaceConfig, saveWorkspaceConfig } from '../git/workspace-config.js'
import type { WorkspaceConfig } from '../../shared/workspace.js'
import { isValidRootDir } from '../../shared/workspace.js'

function getServerMode(): 'development' | 'production' {
  return process.env['OPENFOX_DEV'] === 'true' ? 'development' : 'production'
}

function getDefaultGlobalDir(projectName: string): string {
  const mode = getServerMode()
  const suffix = mode === 'development' ? '-dev' : ''
  const home = homedir()
  const dataDir = process.env['XDG_DATA_HOME'] ?? join(home, '.local', 'share')
  return join(dataDir, `openfox${suffix}`, 'workspaces', projectName)
}

async function isWritable(path: string): Promise<boolean> {
  try {
    await access(path, constants.W_OK)
    return true
  } catch {
    return false
  }
}

function resolveRootDir(rootDir: string, workdir: string): string {
  return isAbsolute(rootDir) ? rootDir : resolve(workdir, rootDir)
}

async function checkDirExists(path: string): Promise<boolean> {
  try {
    const st = await stat(path)
    return st.isDirectory()
  } catch {
    return false
  }
}

async function validatePathWritable(path: string): Promise<string | null> {
  if (await isWritable(path)) return null
  return 'Workspace root directory exists but is not writable'
}

async function findOrphanedWorkspaces(dir: string): Promise<{ name: string }[]> {
  const results: { name: string }[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const gitStat = await stat(join(dir, entry.name, '.git'))
          if (gitStat.isDirectory()) {
            results.push({ name: entry.name })
          }
        } catch {
          // Not a valid git workspace
        }
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }
  return results
}

export function createWorkspaceConfigRoutes(): Router {
  const router = Router()

  router.get('/config', async (req, res) => {
    const workdir = req.query['workdir'] as string
    if (!workdir) return res.status(400).json({ error: 'workdir required' })
    const config = await loadWorkspaceConfig(workdir)
    res.json({ config })
  })

  router.post('/config', async (req, res) => {
    const workdir = req.query['workdir'] as string
    if (!workdir) return res.status(400).json({ error: 'workdir required' })
    const { setup, rootDir } = req.body
    if (!Array.isArray(setup) && typeof rootDir !== 'string') {
      return res.status(400).json({ error: 'At least one of setup or rootDir must be provided' })
    }
    if (setup !== undefined && !Array.isArray(setup)) {
      return res.status(400).json({ error: 'setup must be an array of strings' })
    }
    const config: WorkspaceConfig = {}
    if (Array.isArray(setup)) {
      config.setup = setup
    }
    if (typeof rootDir === 'string') {
      const trimmed = rootDir.trim()
      if (trimmed) {
        const resolvedPath = resolveRootDir(trimmed, workdir)
        if (!isValidRootDir(resolvedPath)) {
          return res.status(400).json({ error: 'Invalid workspace root directory: cannot use system-critical paths' })
        }
        const dirExists = await checkDirExists(resolvedPath)
        if (dirExists) {
          const writableErr = await validatePathWritable(resolvedPath)
          if (writableErr) return res.status(400).json({ error: writableErr })
        }
        config.rootDir = trimmed
      }
    }
    try {
      await saveWorkspaceConfig(workdir, config)
      res.json({ config })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save config' })
    }
  })

  router.post('/config/validate', async (req, res) => {
    const { rootDir, workdir, projectName, createIfMissing } = req.body
    if (!rootDir || typeof rootDir !== 'string') {
      return res.status(400).json({ error: 'rootDir is required' })
    }
    if (!workdir || typeof workdir !== 'string') {
      return res.status(400).json({ error: 'workdir is required' })
    }

    const resolvedPath = resolveRootDir(rootDir, workdir)

    if (!isValidRootDir(resolvedPath)) {
      return res.status(400).json({ error: 'Invalid workspace root directory: cannot use system-critical paths' })
    }

    let dirExists = await checkDirExists(resolvedPath)
    if (dirExists) {
      const writableErr = await validatePathWritable(resolvedPath)
      if (writableErr) return res.status(400).json({ error: writableErr })
    }

    let created = false
    if (!dirExists && createIfMissing) {
      await mkdir(resolvedPath, { recursive: true })
      dirExists = true
      created = true
    }

    const workspaces: { name: string }[] = []
    try {
      const currentConfig = await loadWorkspaceConfig(workdir)
      const previousRootDir = currentConfig?.rootDir ? resolveRootDir(currentConfig.rootDir, workdir) : null

      if (previousRootDir && previousRootDir !== resolvedPath) {
        const orphans = await findOrphanedWorkspaces(previousRootDir)
        workspaces.push(...orphans)
      } else if (!previousRootDir && projectName && typeof projectName === 'string') {
        const defaultDir = getDefaultGlobalDir(projectName)
        if (defaultDir !== resolvedPath) {
          const orphans = await findOrphanedWorkspaces(defaultDir)
          workspaces.push(...orphans)
        }
      }
    } catch {
      // No previous config
    }

    res.json({ exists: dirExists, resolvedPath, created, workspaces })
  })

  return router
}
