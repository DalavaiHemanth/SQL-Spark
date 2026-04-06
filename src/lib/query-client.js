import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
    defaultOptions: {
        queries: {
            // Cache data for 30s — prevents 15 users triggering 15 identical fetches
            staleTime: 30_000,
            // Keep unused data in memory for 2 minutes
            gcTime: 120_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            // Don't hammer Supabase with retries — wait between attempts
            retry: 2,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
        },
        mutations: {
            retry: 0, // Never retry mutations (writes)
        },
    },
});