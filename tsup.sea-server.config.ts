import { defineConfig } from 'tsup'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

const prodDeps = Object.keys(pkg.dependencies)
const externalDeps = [
  'better-sqlite3',
  'node-pty',
  'vite',
  'lightningcss',
  'esbuild',
  '@esbuild',
  'fsevents',
  '@rollup/rollup-linux-x64-gnu',
  '@rollup/rollup-linux-arm64-gnu',
  '@rollup/rollup-darwin-x64',
  '@rollup/rollup-darwin-arm64',
  '@rollup/rollup-win32-x64-msvc',
  '@rollup/rollup-win32-arm64-msvc',
]

export default defineConfig({
  define: {
    'process.env.VERSION': JSON.stringify(pkg.version),
  },
  entry: {
    'server/index': 'src/sea/server-entry.ts',
  },
  format: ['cjs'],
  clean: true,
  sourcemap: false,
  bundle: true,
  splitting: false,
  outDir: 'dist-sea-bundle',
  platform: 'node',
  target: 'node24',
  shims: true,
  noExternal: prodDeps.filter((d) => !externalDeps.includes(d)),
  external: externalDeps,
})
