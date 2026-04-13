import { ClerkProvider } from "@clerk/clerk-react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const CLERK_KEY = process.env.CLERK_PUBLISHABLE_KEY;

if (!CLERK_KEY) {
  throw new Error("Missing CLERK_PUBLISHABLE_KEY environment variable");
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <ClerkProvider publishableKey={CLERK_KEY} afterSignOutUrl="/">
    <App />
  </ClerkProvider>,
);
