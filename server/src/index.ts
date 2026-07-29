import { createApp } from './app.js'
import { config } from './config.js'
import { getDatabasePath } from '@trading-os/database'
import { API_BASE_PATH } from '@trading-os/shared'

const app = createApp()

app.listen(config.port, config.host, () => {
  console.log(`\n  QUANTLAB — API Server`)
  console.log(`  → http://${config.host}:${config.port}${API_BASE_PATH}`)
  console.log(`  → Health: http://${config.host}:${config.port}/health`)
  console.log(`  → Database: ${getDatabasePath()}\n`)
})
