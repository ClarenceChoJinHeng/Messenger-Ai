"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Create TanStack's memory ONCE and keep it (useState makes sure it isn't recreated every render)
  const [queryClient] = useState(() => new QueryClient());

  // Make that memory available to everything inside
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
