import { QueryClient } from '@tanstack/react-query'

/** Shared QueryClient — server data source of truth (not duplicated in Zustand). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
