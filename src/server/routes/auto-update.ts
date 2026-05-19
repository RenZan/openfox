import { Router } from 'express'
import { spawn } from 'node:child_process'
import { VERSION } from '../../constants.js'

export function createAutoUpdateRoutes(): Router {
  const router = Router()

  router.get('/check', async (req, res) => {
    const isTest = req.query['test'] === '1'

    const current = VERSION

    if (isTest) {
      res.json({ current: '1.0.0', latest: '1.1.0', isUpdateAvailable: true })
      return
    }

    try {
      const latest = await new Promise<string>((resolve, reject) => {
        const child = spawn('npm', ['view', 'openfox', 'version'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        let stdout = ''
        child.stdout?.on('data', (data) => {
          stdout += data.toString()
        })
        child.on('close', (code) => {
          if (code === 0) {
            resolve(stdout.trim())
          } else {
            reject(new Error(`npm view exited with code ${code}`))
          }
        })
        child.on('error', reject)
        setTimeout(() => {
          child.kill()
          reject(new Error('npm view timed out'))
        }, 10_000)
      })

      const isUpdateAvailable = current !== latest
      res.json({ current, latest, isUpdateAvailable })
    } catch {
      res.json({ current, latest: current, isUpdateAvailable: false })
    }
  })

  router.post('/', async (req, res) => {
    try {
      const isTest = req.query['test'] === '1'

      const child = spawn('bash', ['-c', 'openfox update'], {
        detached: true,
        stdio: 'ignore',
      })
      child.unref()
      res.json({ success: true })

      if (isTest) {
        setTimeout(() => {
          console.warn('[auto-update] test mode: simulating server exit in 5s')
          process.exit(0)
        }, 5_000)
      }
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Update failed to start' })
    }
  })

  return router
}
