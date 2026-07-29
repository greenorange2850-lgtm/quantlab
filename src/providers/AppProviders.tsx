import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { appQueryClient } from '@/api/query-client'
import { useAutoRestoreLatestSession } from '@/hooks/use-auto-restore-latest-session'

function SessionHydrator({ children }: { children: ReactNode }) {
  useAutoRestoreLatestSession()
  return children
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={appQueryClient}>
      <SessionHydrator>{children}</SessionHydrator>
    </QueryClientProvider>
  )
}
