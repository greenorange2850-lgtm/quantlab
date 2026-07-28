import { API_BASE_PATH } from '@trading-os/shared'
import { createApp } from './app.js'
import { config } from './config.js'

const app = createApp()

app.listen(config.port, config.host, () => {
  console.log(`\n  QUANTLAB — API Server`)
  console.log(`  → http://${config.host}:${config.port}${API_BASE_PATH}`)
  console.log(`  → Health: http://${config.host}:${config.port}${API_BASE_PATH}/health`)
  if (config.serveStatic) {
    console.log(`  → Web UI: http://${config.host}:${config.port}/`)
  }
  console.log('')
})
