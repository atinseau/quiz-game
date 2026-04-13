import { ClerkProvider } from "@clerk/clerk-react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const CLERK_KEY = process.env.PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!CLERK_KEY) {
  throw new Error("Missing PUBLIC_CLERK_PUBLISHABLE_KEY in .env");
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element");
const root = createRoot(rootEl);
root.render(
  <ClerkProvider publishableKey={CLERK_KEY} afterSignOutUrl="/">
    <App />
  </ClerkProvider>,
);
