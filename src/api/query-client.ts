import { QueryClient } from '@tanstack/react-query'

/**
 * Shared app QueryClient — TanStack Query owns remote/archive-backed state.
 * Exported so writers (e.g. research session archive saves) can sync caches
 * without duplicating data into Zustand.
 */
export const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
