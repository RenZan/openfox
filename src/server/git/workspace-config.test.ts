import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'node:path'
import { loadWorkspaceConfig, saveWorkspaceConfig, validateWorkspacesDir } from './workspace-config.js'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}))

import { readFile, writeFile, mkdir } from 'node:fs/promises'

const WORKDIR = '/tmp/project'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadWorkspaceConfig', () => {
  it('returns null when file does not exist', async () => {
    vi.mocked(readFile).mockRejectedValue({ code: 'ENOENT' })
    const result = await loadWorkspaceConfig(WORKDIR)
    expect(result).toBeNull()
  })

  it('returns null when JSON is invalid', async () => {
    vi.mocked(readFile).mockResolvedValue('not json')
    const result = await loadWorkspaceConfig(WORKDIR)
    expect(result).toBeNull()
  })

  it('returns null when setup is missing', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({}))
    const result = await loadWorkspaceConfig(WORKDIR)
    expect(result).toBeNull()
  })

  it('parses valid config with setup array', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ setup: ['npm install --prefer-offline'] }))
    const result = await loadWorkspaceConfig(WORKDIR)
    expect(result).toEqual({ setup: ['npm install --prefer-offline'] })
  })

  it('parses config with only workspacesDir', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ workspacesDir: '/custom/workspaces' }))
    const result = await loadWorkspaceConfig(WORKDIR)
    expect(result).toEqual({ workspacesDir: '/custom/workspaces' })
  })

  it('parses config with both setup and workspacesDir', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ setup: ['npm install'], workspacesDir: '/custom/workspaces' }),
    )
    const result = await loadWorkspaceConfig(WORKDIR)
    expect(result).toEqual({ setup: ['npm install'], workspacesDir: '/custom/workspaces' })
  })
})

describe('saveWorkspaceConfig', () => {
  it('creates .openfox directory and writes config', async () => {
    vi.mocked(mkdir).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockResolvedValue(undefined)

    await saveWorkspaceConfig(WORKDIR, { setup: ['npm install --prefer-offline'] })

    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('.openfox'), { recursive: true })
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining(join('.openfox', 'workspace.json')),
      JSON.stringify({ setup: ['npm install --prefer-offline'] }, null, 2) + '\n',
      'utf-8',
    )
  })

  it('saves config without setup', async () => {
    vi.mocked(mkdir).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockResolvedValue(undefined)

    await saveWorkspaceConfig(WORKDIR, {})

    expect(writeFile).toHaveBeenCalledWith(expect.any(String), JSON.stringify({}, null, 2) + '\n', 'utf-8')
  })
})

describe('validateWorkspacesDir', () => {
  it('accepts valid absolute path', () => {
    expect(() => validateWorkspacesDir('/home/user/workspaces')).not.toThrow()
  })

  it('rejects non-absolute path', () => {
    expect(() => validateWorkspacesDir('relative/path')).toThrow('workspacesDir must be an absolute path')
  })

  it('rejects root directory', () => {
    expect(() => validateWorkspacesDir('/')).toThrow('workspacesDir cannot be the root directory')
  })

  it('rejects path with parent references', () => {
    expect(() => validateWorkspacesDir('/home/../workspaces')).toThrow(
      'workspacesDir cannot contain parent directory references',
    )
  })

  it('rejects empty string', () => {
    expect(() => validateWorkspacesDir('')).toThrow('workspacesDir is required')
  })
})

describe('loadWorkspaceConfig with invalid workspacesDir', () => {
  it('returns null when workspacesDir is relative', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ workspacesDir: 'relative/path' }))
    const result = await loadWorkspaceConfig(WORKDIR)
    expect(result).toBeNull()
  })

  it('returns null when workspacesDir is root', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ workspacesDir: '/' }))
    const result = await loadWorkspaceConfig(WORKDIR)
    expect(result).toBeNull()
  })
})
