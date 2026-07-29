import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAutoRestoreLatestSession } from '@/hooks/use-auto-restore-latest-session'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function SessionHydrator({ children }: { children: ReactNode }) {
  useAutoRestoreLatestSession()
  return children
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionHydrator>{children}</SessionHydrator>
    </QueryClientProvider>
  )
}
