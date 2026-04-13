import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initApi } from "./lib/api";

const CLERK_KEY = process.env.PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!CLERK_KEY) {
  throw new Error("Missing PUBLIC_CLERK_PUBLISHABLE_KEY in .env");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function ApiInit({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const initialized = useRef(false);

  if (!initialized.current) {
    initApi(() => getToken());
    initialized.current = true;
  }

  return children;
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element");
const root = createRoot(rootEl);
root.render(
  <ClerkProvider
    publishableKey={CLERK_KEY}
    afterSignInUrl="/play"
    afterSignOutUrl="/"
  >
    <ApiInit>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ApiInit>
  </ClerkProvider>,
);
