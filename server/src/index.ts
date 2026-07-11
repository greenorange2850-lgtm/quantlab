import { createApp } from './app.js'
import { config } from './config.js'

const app = createApp()

app.listen(config.port, config.host, () => {
  console.log(`\n  AI Trading Research OS — API Server`)
  console.log(`  → http://localhost:${config.port}${'/api/v1'}`)
  console.log(`  → Health: http://localhost:${config.port}/api/v1/health\n`)
})
