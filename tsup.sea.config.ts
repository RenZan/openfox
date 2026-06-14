import { defineConfig } from 'tsup'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  define: {
    'process.env.VERSION': JSON.stringify(pkg.version),
  },
  entry: {
    'sea/boot': 'src/sea/boot.ts',
  },
  format: ['cjs'],
  clean: true,
  sourcemap: false,
  bundle: true,
  splitting: false,
  outDir: 'dist-sea',
  external: ['better-sqlite3', 'node-pty', 'vscode-jsonrpc', 'vscode-languageserver-protocol', 'ws', 'node:sea'],
})
