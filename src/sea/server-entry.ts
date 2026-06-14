import { createServer } from '../server/index.js'
import { loadConfig } from '../server/config.js'
import { displayStartupBanner } from '../server/utils/network.js'

const PORT = Number(process.env['OPENFOX_PORT']) || 10369
const HOST = process.env['OPENFOX_HOST'] || '127.0.0.1'

const env = loadConfig()
const merged = {
  ...env,
  server: {
    ...env.server,
    port: PORT,
    host: HOST,
    openBrowser: false,
  },
  mode: 'production' as const,
}

createServer(merged).then(() => {
  displayStartupBanner({
    host: HOST,
    port: PORT,
    databasePath: merged.database.path,
    configPath: '',
  })
})
