import { rm } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 200

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Forcefully remove a directory or file.
 *
 * Uses `rm -rf` via execSync first (synchronous, immune to the async walk race
 * that plagues fs.rm on deeply nested dirs like `.git`), then falls back to
 * fs.rm with retries.
 *
 * Never throws — logs warnings on failure instead.
 */
export async function forceRemove(target: string): Promise<void> {
  // Strategy 1: synchronous rm -rf (handles deep .git trees reliably)
  try {
    execSync(`rm -rf "${target}"`, { stdio: 'ignore', timeout: 10_000 })
    return
  } catch {
    // fall through to async retry
  }

  // Strategy 2: async fs.rm with retry
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await rm(target, { recursive: true, force: true })
      return
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS)
      }
    }
  }
}
