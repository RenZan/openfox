import { createHighlighter } from 'shiki'
import type { ShikiTransformer } from 'shiki'
import { useThemeStore } from '../stores/theme'

let highlighterPromise: Promise<Awaited<ReturnType<typeof createHighlighter>>> | null = null

const langs: Array<string> = [
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'python',
  'bash',
  'json',
  'css',
  'html',
  'sql',
  'yaml',
  'markdown',
  'diff',
  'rust',
  'go',
  'java',
  'c',
  'cpp',
  'ruby',
  'toml',
  'scss',
  'graphql',
  'docker',
  'powershell',
]

const themes = ['github-dark-default', 'vitesse-light', 'monokai', 'dracula', 'nord']

export const THEME_MAP: Record<string, string> = {
  dark: 'github-dark-default',
  light: 'vitesse-light',
  monokai: 'monokai',
  dracula: 'dracula',
  nord: 'nord',
}

export function lineNumbersTransformer(): ShikiTransformer {
  return {
    name: 'line-numbers',
    line(node, line) {
      node.properties['data-line'] = String(line + 1)
    },
  }
}

export async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({ themes, langs })
  }
  return highlighterPromise
}

export async function highlightCode(code: string, language: string, theme = 'github-dark-default'): Promise<string> {
  const h = await getHighlighter()
  return h.codeToHtml(code, {
    lang: language,
    theme,
    transformers: [lineNumbersTransformer()],
  })
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    highlighterPromise?.then((h) => h.dispose())
    highlighterPromise = null
  })
}

const extensionToLanguage: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  ps1: 'powershell',
  sql: 'sql',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  md: 'markdown',
  markdown: 'markdown',
  toml: 'toml',
  ini: 'ini',
  conf: 'ini',
  dockerfile: 'docker',
  makefile: 'makefile',
  cmake: 'cmake',
  graphql: 'graphql',
  gql: 'graphql',
  vue: 'vue',
  svelte: 'svelte',
}

export function getLanguageFromPath(filePath?: string): string {
  if (!filePath) return 'text'

  const fileName = filePath.split('/').pop() ?? ''

  const lowerName = fileName.toLowerCase()
  if (lowerName === 'dockerfile') return 'docker'
  if (lowerName === 'makefile') return 'makefile'
  if (lowerName === 'cmakelists.txt') return 'cmake'

  const ext = fileName.split('.').pop()?.toLowerCase()
  if (!ext) return 'text'

  return extensionToLanguage[ext] ?? 'text'
}

export const wrappedCodeStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  borderRadius: 0,
  fontSize: '0.875rem',
  lineHeight: '1.5rem',
  background: 'transparent',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
}

export function useShikiTheme(): string {
  const currentPreset = useThemeStore((s) => s.currentPreset)
  const isCustom = useThemeStore((s) => s.isCustom)
  return isCustom ? 'github-dark-default' : (THEME_MAP[currentPreset] ?? 'github-dark-default')
}
