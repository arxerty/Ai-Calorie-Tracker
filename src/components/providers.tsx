'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TmaProvider } from './tma-provider';
import { ToastProvider } from './ui/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  // Prevent sharing query client instance across requests in SSR
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes stale time
            refetchOnWindowFocus: false, // Don't trigger refetches on web focus (common in mobile app tabs)
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TmaProvider>
        <ToastProvider>{children}</ToastProvider>
      </TmaProvider>
    </QueryClientProvider>
  );
}
