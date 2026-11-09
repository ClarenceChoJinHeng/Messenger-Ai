"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ToastContainer } from "react-toastify";
import { AuthProvider } from "@/lib/auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Create TanStack's memory ONCE and keep it (useState makes sure it isn't recreated every render)
  const [queryClient] = useState(() => new QueryClient());

  // Make that memory, the logged-in user, and toasts available to everything inside
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <ToastContainer theme="colored" position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
