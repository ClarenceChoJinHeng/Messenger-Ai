"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ToastContainer } from "react-toastify";
import { AuthProvider } from "@/lib/auth";
import { RealtimeProvider } from "@/lib/realtime";
import MessageNotifier from "@/app/components/MessageNotifier";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Create TanStack's memory ONCE and keep it (useState makes sure it isn't recreated every render)
  const [queryClient] = useState(() => new QueryClient());

  // Make that memory, the logged-in user, the live connection and toasts available everywhere
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeProvider>
          {children}
          <MessageNotifier />
          <ToastContainer theme="colored" position="top-right" />
        </RealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
