import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { frFR } from "@clerk/localizations";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Toaster } from "./components/ui/sonner";
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

function injectPwaLinks() {
  const links: Array<Record<string, string>> = [
    { rel: "manifest", href: "/manifest.webmanifest" },
    { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    {
      rel: "icon",
      type: "image/png",
      sizes: "32x32",
      href: "/icons/favicon-32.png",
    },
    { rel: "icon", type: "image/svg+xml", href: "/icons/icon.svg" },
  ];
  for (const attrs of links) {
    const el = document.createElement("link");
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  }
}
injectPwaLinks();

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("SW registration failed:", err));
  });
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element");
const root = createRoot(rootEl);
root.render(
  <ClerkProvider
    publishableKey={CLERK_KEY}
    localization={frFR}
    afterSignInUrl="/play"
    afterSignOutUrl="/"
  >
    <ApiInit>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster position="top-center" />
      </QueryClientProvider>
    </ApiInit>
  </ClerkProvider>,
);
