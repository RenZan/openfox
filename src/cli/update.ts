import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

function detectInstallMethod(): 'npm' | 'sea' | 'unknown' {
  // Check if running from SEA binary
  if (process.execPath.includes('openfox-core')) return 'sea'
  // Check if installed via npm (has package.json in global node_modules)
  try {
    const globalPrefix = execSync('npm root -g', { encoding: 'utf-8' }).trim()
    if (existsSync(join(globalPrefix, 'openfox'))) return 'npm'
  } catch {
    // npm not available
  }
  return 'unknown'
}

export async function runUpdate(options: { service?: boolean }): Promise<void> {
  const { service } = options
  const method = detectInstallMethod()

  if (method === 'sea') {
    console.log('OpenFox SEA update: download the latest version from')
    console.log('https://github.com/co-l/openfox/releases')
    return
  }

  if (method === 'unknown') {
    console.log('Could not detect installation method.')
    console.log('Please update manually from https://github.com/co-l/openfox/releases')
    return
  }

  try {
    const currentVersion = execSync('openfox --version', { encoding: 'utf-8' }).trim()
    const latestVersion = execSync('npm view openfox version', { encoding: 'utf-8' }).trim()

    if (currentVersion === latestVersion) {
      console.log(`OpenFox is already at the latest version: ${currentVersion}`)
      return
    }

    console.log(`Updating OpenFox: ${currentVersion} -> ${latestVersion}`)
    execSync('npm update -g openfox', { stdio: 'inherit' })

    const newVersion = execSync('openfox --version', { encoding: 'utf-8' }).trim()

    if (service) {
      if (process.platform === 'win32') {
        console.log('Updated. Please restart OpenFox to use the new version.')
      } else {
        console.log('Restarting service...')
        execSync('systemctl --user restart openfox', { stdio: 'inherit' })
      }
    } else {
      console.log(`Updated: ${newVersion}`)
      console.log('Please restart OpenFox to use the new version.')
    }
  } catch (error) {
    console.error('Update failed:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
