// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '../stores/config'
import { buildEditorUrl, buildWorkspaceUrl } from './editor-link'

beforeEach(() => {
  useConfigStore.setState({ platform: null })
})

describe('buildEditorUrl — Linux native (no WSL)', () => {
  it('returns vscode://file//path (double slash for backwards compat)', () => {
    useConfigStore.setState({ platform: { isWSL: false, wslDistro: '' } })
    expect(buildEditorUrl('/home/user/file.ts')).toBe('vscode://file//home/user/file.ts')
  })

  it('appends :line number', () => {
    useConfigStore.setState({ platform: { isWSL: false, wslDistro: '' } })
    expect(buildEditorUrl('/home/user/file.ts', 42)).toBe('vscode://file//home/user/file.ts:42')
  })

  it('resolves relative path with workdir', () => {
    useConfigStore.setState({ platform: { isWSL: false, wslDistro: '' } })
    expect(buildEditorUrl('src/foo.ts', undefined, '/home/user/proj')).toBe('vscode://file//home/user/proj/src/foo.ts')
  })

  it('normalizes Windows backslashes', () => {
    useConfigStore.setState({ platform: { isWSL: false, wslDistro: '' } })
    expect(buildEditorUrl('C:\\Users\\test\\file.ts')).toBe('vscode://file/C:/Users/test/file.ts')
  })

  it('encodes spaces', () => {
    useConfigStore.setState({ platform: { isWSL: false, wslDistro: '' } })
    expect(buildEditorUrl('/home/user/my file.ts')).toBe('vscode://file//home/user/my%20file.ts')
  })

  it('encodes # and ? characters', () => {
    useConfigStore.setState({ platform: { isWSL: false, wslDistro: '' } })
    const url = buildEditorUrl('/home/user/file#2.tsx')
    expect(url).toContain('file%232.tsx')
    expect(url).not.toContain('file#2.tsx')
  })
})

describe('buildEditorUrl — WSL', () => {
  it('returns vscode://vscode-remote/wsl+Ubuntu/path:1', () => {
    useConfigStore.setState({ platform: { isWSL: true, wslDistro: 'Ubuntu' } })
    expect(buildEditorUrl('/home/user/file.ts')).toBe('vscode://vscode-remote/wsl+Ubuntu/home/user/file.ts:1')
  })

  it('preserves the provided line number', () => {
    useConfigStore.setState({ platform: { isWSL: true, wslDistro: 'Ubuntu' } })
    expect(buildEditorUrl('/home/user/file.ts', 10)).toBe('vscode://vscode-remote/wsl+Ubuntu/home/user/file.ts:10')
  })

  it('handles custom distro names', () => {
    useConfigStore.setState({ platform: { isWSL: true, wslDistro: 'Debian' } })
    expect(buildEditorUrl('/opt/project/main.go')).toBe('vscode://vscode-remote/wsl+Debian/opt/project/main.go:1')
  })

  it('resolves relative path with workdir', () => {
    useConfigStore.setState({ platform: { isWSL: true, wslDistro: 'Ubuntu' } })
    expect(buildEditorUrl('src/foo.ts', undefined, '/home/user/proj')).toBe(
      'vscode://vscode-remote/wsl+Ubuntu/home/user/proj/src/foo.ts:1',
    )
  })
})

describe('buildEditorUrl — unknown platform', () => {
  it('defaults to vscode://file with double slash', () => {
    useConfigStore.setState({ platform: null })
    expect(buildEditorUrl('/path/file.ts')).toBe('vscode://file//path/file.ts')
  })
})

describe('buildWorkspaceUrl', () => {
  it('returns vscode://file//workspace on Linux', () => {
    useConfigStore.setState({ platform: { isWSL: false, wslDistro: '' } })
    expect(buildWorkspaceUrl('/home/user/project')).toBe('vscode://file//home/user/project')
  })

  it('returns vscode://vscode-remote/wsl+Ubuntu/workspace on WSL', () => {
    useConfigStore.setState({ platform: { isWSL: true, wslDistro: 'Ubuntu' } })
    expect(buildWorkspaceUrl('/home/user/project')).toBe('vscode://vscode-remote/wsl+Ubuntu/home/user/project')
  })

  it('encodes spaces', () => {
    useConfigStore.setState({ platform: { isWSL: false, wslDistro: '' } })
    expect(buildWorkspaceUrl('/home/user/my project')).toBe('vscode://file//home/user/my%20project')
  })
})
