export interface LogEntry {
  level: 'info' | 'warn' | 'error'
  message: string
  context?: Record<string, unknown>
  timestamp: string
}

const logs: LogEntry[] = []
const MAX_LOGS = 1000

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    logs.push({ level: 'info', message, context, timestamp: new Date().toISOString() })
    if (logs.length > MAX_LOGS) logs.shift()
    console.log(`[MDE:info] ${message}`, context ?? '')
  },
  warn(message: string, context?: Record<string, unknown>) {
    logs.push({ level: 'warn', message, context, timestamp: new Date().toISOString() })
    if (logs.length > MAX_LOGS) logs.shift()
    console.warn(`[MDE:warn] ${message}`, context ?? '')
  },
  error(message: string, context?: Record<string, unknown>) {
    logs.push({ level: 'error', message, context, timestamp: new Date().toISOString() })
    if (logs.length > MAX_LOGS) logs.shift()
    console.error(`[MDE:error] ${message}`, context ?? '')
  },
  getLogs(): LogEntry[] {
    return [...logs]
  },
  clear() {
    logs.length = 0
  },
}
