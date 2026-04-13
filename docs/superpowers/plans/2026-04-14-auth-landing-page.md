# Auth + Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block game access behind Clerk auth, create a public landing page with game intro, pack preview, game modes, and rules modal.

**Architecture:** New LandingPage component at `/`, AuthGuard wrapper redirects unauthenticated users from `/play`, `/game`, `/end`. Existing HomeScreen moves to `/play`. Landing uses `usePacks()` hook for real pack data.

**Tech Stack:** React 19, Clerk, React Router, shadcn/ui (Dialog, Tabs), Tailwind 4, TanStack Query

**Spec:** `docs/superpowers/specs/2026-04-14-auth-landing-page-design.md`

---

## File Structure

### New files

```
apps/client/src/components/AuthGuard.tsx       — redirect wrapper for protected routes
apps/client/src/components/LandingPage.tsx     — public landing page (hero, packs preview, modes, rules)
apps/client/src/components/ui/tabs.tsx         — shadcn tabs component (via CLI)
```

### Modified files

```
apps/client/src/App.tsx                        — new routing, AuthGuard, separate headers
apps/client/src/index.tsx                      — afterSignInUrl="/play"
```

---

## Task 1: Add shadcn Tabs component

**Files:**
- Create: `apps/client/src/components/ui/tabs.tsx`

- [ ] **Step 1: Install tabs via shadcn CLI**

```bash
cd apps/client && bunx shadcn@latest add tabs
```

This creates `src/components/ui/tabs.tsx` with `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` exports.

- [ ] **Step 2: Verify the file exists and exports are correct**

```bash
grep "export" apps/client/src/components/ui/tabs.tsx
```

Expected: exports for Tabs, TabsList, TabsTrigger, TabsContent.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/ui/tabs.tsx
git commit -m "feat(client): add shadcn tabs component"
```

---

## Task 2: AuthGuard component

**Files:**
- Create: `apps/client/src/components/AuthGuard.tsx`

- [ ] **Step 1: Create AuthGuard**

```tsx
// apps/client/src/components/AuthGuard.tsx
import { useAuth } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return children;
}
```

- [ ] **Step 2: Verify types**

```bash
cd apps/client && bunx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/AuthGuard.tsx
git commit -m "feat(client): add AuthGuard redirect component"
```

---

## Task 3: LandingPage component

**Files:**
- Create: `apps/client/src/components/LandingPage.tsx`

- [ ] **Step 1: Create LandingPage with all 4 zones**

```tsx
// apps/client/src/components/LandingPage.tsx
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/clerk-react";
import {
  BookOpen,
  LogIn,
  PartyPopper,
  Play,
  UserPlus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePacks } from "../hooks/usePacks";
import { useSettingsStore } from "../stores/settingsStore";
import { GAME_MODES } from "../types";

export function LandingPage() {
  const { data: packs = [] } = usePacks();
  const navigate = useNavigate();
  const { muted, toggleMute } = useSettingsStore();
  const [rulesOpen, setRulesOpen] = useState(false);

  const previewPacks = packs.slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      {/* --- Header --- */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PartyPopper className="w-6 h-6 text-party-purple" />
            <span className="text-xl font-bold text-glow-purple">
              Quiz Party
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              title={muted ? "Activer le son" : "Couper le son"}
            >
              {muted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </Button>
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="default" size="sm">
                  <LogIn className="size-3.5" />
                  Connexion
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button variant="secondary" size="sm">
                  <UserPlus className="size-3.5" />
                  Inscription
                </Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Button size="sm" onClick={() => navigate("/play")}>
                <Play className="size-3.5" />
                Jouer
              </Button>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-24 pb-16">
        {/* --- Hero --- */}
        <section className="text-center py-16">
          <h1 className="text-5xl sm:text-7xl font-black animate-shimmer bg-gradient-to-r from-party-purple via-party-pink to-party-cyan bg-clip-text text-transparent bg-[length:200%_auto]">
            Quiz Party
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto">
            Le quiz qui pimente tes soirées. Défie tes potes, vole leurs
            points, et prouve que tu es le plus cultivé de la bande.
          </p>
          <div className="mt-8">
            <SignedOut>
              <SignInButton mode="modal">
                <Button size="lg" className="text-lg px-8 py-6 glow-purple">
                  <Play className="size-5 mr-2" />
                  Jouer maintenant
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Button
                size="lg"
                className="text-lg px-8 py-6 glow-purple"
                onClick={() => navigate("/play")}
              >
                <Play className="size-5 mr-2" />
                Jouer maintenant
              </Button>
            </SignedIn>
          </div>
        </section>

        {/* --- Aperçu des packs --- */}
        <section className="py-12">
          <h2 className="text-2xl font-bold text-center mb-8">
            Des centaines de questions pour tous les goûts
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {previewPacks.map((pack) => (
              <div
                key={pack.slug}
                className={`bg-gradient-to-br ${pack.gradient} rounded-2xl p-4 text-center`}
              >
                <span className="text-3xl">{pack.icon}</span>
                <p className="mt-2 font-semibold text-white text-sm">
                  {pack.name}
                </p>
                <p className="text-xs text-white/70 mt-1">
                  {pack.questionCount} questions
                </p>
              </div>
            ))}
          </div>
          <p className="text-center text-muted-foreground mt-4 text-sm">
            Et bien d'autres packs à découvrir...
          </p>
        </section>

        {/* --- Modes de jeu --- */}
        <section className="py-12">
          <h2 className="text-2xl font-bold text-center mb-8">
            3 modes de jeu, 0 temps mort
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {GAME_MODES.map((mode) => (
              <div
                key={mode.id}
                className={`bg-gradient-to-br ${mode.gradient} rounded-2xl p-6 text-center`}
              >
                <span className="text-4xl">{mode.icon}</span>
                <h3 className="mt-3 text-lg font-bold text-white">
                  {mode.name}
                </h3>
                <p className="mt-1 text-sm text-white/80">
                  {mode.description}
                </p>
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <BookOpen className="size-4 mr-2" />
                  Voir les règles détaillées
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Règles du jeu</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="classic">
                  <TabsList className="w-full">
                    <TabsTrigger value="classic" className="flex-1">
                      🎯 Classique
                    </TabsTrigger>
                    <TabsTrigger value="voleur" className="flex-1">
                      🦹 Voleur
                    </TabsTrigger>
                    <TabsTrigger value="chrono" className="flex-1">
                      ⏱️ Chrono
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="classic" className="mt-4 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      • Tour par tour, chaque joueur répond à sa question
                    </p>
                    <p className="text-sm text-muted-foreground">
                      • Enchaîne les bonnes réponses pour un combo jusqu'à x5
                    </p>
                    <p className="text-sm text-muted-foreground">
                      • Mode aveugle : réponds sans voir les choix pour doubler
                      tes points
                    </p>
                  </TabsContent>
                  <TabsContent value="voleur" className="mt-4 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      • Un joueur répond, les autres peuvent voler sa réponse
                    </p>
                    <p className="text-sm text-muted-foreground">
                      • Vol réussi : tu gagnes 0.5 pt, il perd 0.5 pt
                    </p>
                    <p className="text-sm text-muted-foreground">
                      • Vol raté : tu perds 1 pt — risqué !
                    </p>
                  </TabsContent>
                  <TabsContent value="chrono" className="mt-4 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      • 15 secondes par question, pas le droit de traîner
                    </p>
                    <p className="text-sm text-muted-foreground">
                      • Bonne réponse dans le temps : +1 pt + combo
                    </p>
                    <p className="text-sm text-muted-foreground">
                      • Timeout : -0.5 pt, aïe
                    </p>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify types**

```bash
cd apps/client && bunx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/LandingPage.tsx
git commit -m "feat(client): add LandingPage with hero, pack preview, modes, and rules modal"
```

---

## Task 4: Update routing and index.tsx

**Files:**
- Modify: `apps/client/src/App.tsx`
- Modify: `apps/client/src/index.tsx`

- [ ] **Step 1: Update App.tsx — new routing with AuthGuard**

Replace the full content of `apps/client/src/App.tsx`:

```tsx
// apps/client/src/App.tsx
import { Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "./components/AuthGuard";
import { EndScreen } from "./components/EndScreen";
import { GameScreen } from "./components/GameScreen";
import { HomeScreen } from "./components/HomeScreen";
import { LandingPage } from "./components/LandingPage";
import { useSyncPlayer } from "./hooks/useSyncPlayer";
import { useGameStore } from "./stores/gameStore";
import { setNavigate } from "./stores/router";
import { useSettingsStore } from "./stores/settingsStore";

function InGameHeader() {
  useSyncPlayer();
  const { muted, toggleMute } = useSettingsStore();

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMute}
        title={muted ? "Activer le son" : "Couper le son"}
      >
        {muted ? (
          <VolumeX className="w-5 h-5" />
        ) : (
          <Volume2 className="w-5 h-5" />
        )}
      </Button>
    </div>
  );
}

function AppRoutes() {
  const navigate = useNavigate();

  useEffect(() => {
    setNavigate(navigate);
    useGameStore.getState().restoreFromStorage();
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/play"
        element={
          <AuthGuard>
            <InGameHeader />
            <HomeScreen />
          </AuthGuard>
        }
      />
      <Route
        path="/game"
        element={
          <AuthGuard>
            <InGameHeader />
            <GameScreen />
          </AuthGuard>
        }
      />
      <Route
        path="/end"
        element={
          <AuthGuard>
            <InGameHeader />
            <EndScreen />
          </AuthGuard>
        }
      />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
```

Key changes:
- `AuthHeader` removed (landing has its own header, in-game has `InGameHeader`)
- `InGameHeader` is the mute button only (Clerk UI is in the landing header + UserButton can be added later)
- `LandingPage` at `/` (public)
- `/play`, `/game`, `/end` wrapped in `AuthGuard`

- [ ] **Step 2: Update index.tsx — add afterSignInUrl**

In `apps/client/src/index.tsx`, change the ClerkProvider line:

```tsx
// Before:
<ClerkProvider publishableKey={CLERK_KEY} afterSignOutUrl="/">

// After:
<ClerkProvider publishableKey={CLERK_KEY} afterSignInUrl="/play" afterSignOutUrl="/">
```

- [ ] **Step 3: Verify types and tests**

```bash
cd apps/client && bunx tsc --noEmit
bun test src/
```

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/App.tsx apps/client/src/index.tsx
git commit -m "feat(client): wire routing with AuthGuard, landing at /, game at /play"
```

---

## Task 5: Update gameStore navigation

**Files:**
- Modify: `apps/client/src/stores/gameStore.ts`

- [ ] **Step 1: Update navigation targets in gameStore**

The gameStore uses `getNavigate()("/game")` and `getNavigate()("/end")`. These are correct — they stay the same.

But `reset()` navigates to `/` — this should now go to `/play` (the game setup screen, not the landing page):

Search for `getNavigate()("/")` in gameStore.ts and change to `getNavigate()("/play")`.

```bash
grep -n 'getNavigate.*"/"' apps/client/src/stores/gameStore.ts
```

For each match, change `"/"` to `"/play"`.

- [ ] **Step 2: Verify**

```bash
cd apps/client && bunx tsc --noEmit && bun test src/
```

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/stores/gameStore.ts
git commit -m "fix(client): navigate to /play instead of / after game reset"
```

---

## Task 6: Update E2E tests

**Files:**
- Modify: `apps/client/tests/helpers/fixtures.ts`
- Modify: E2E spec files as needed

- [ ] **Step 1: Update fixtures baseURL**

The E2E tests navigate to `/` which now shows the landing page, not the HomeScreen. Update the `mockApp` fixture in `apps/client/tests/helpers/fixtures.ts`:

Change the `page.goto("/")` to `page.goto("/play")` since tests need the game setup screen.

Also, the landing page will try to fetch packs too (via `usePacks()`), so the existing pack mock route already handles that.

```ts
// In the mockApp fixture, change:
await page.goto("/");
// To:
await page.goto("/play");
```

The Clerk auth mock routes already exist (`**/.well-known/openid-configuration`, `**/clerk.*.com/v1/**`). The AuthGuard will see `isSignedIn` as false and redirect to `/`. To bypass this in tests, we need to mock Clerk's auth state.

Add a mock for Clerk's `useAuth` to return signed-in state. The simplest approach: mock the Clerk frontend API to return a valid session.

Alternative: since the E2E tests already mock Clerk endpoints and the app doesn't actually verify tokens in the client-side rendering, the AuthGuard's `useAuth().isSignedIn` will be `false` without a real Clerk session. We need to handle this.

**Simplest fix:** In test fixtures, navigate directly to `/play` and add a route mock that makes Clerk's client SDK think the user is signed in. OR: keep tests on `/` for landing page tests and create a separate fixture that bypasses auth for game tests.

For now, the pragmatic approach is to keep the existing tests navigating to `/play` and add Clerk session mocks to make `isSignedIn` return true. If Clerk mocks don't work cleanly, we can add a `data-testid` bypass or test the landing page separately.

Read the current Clerk mock setup and adapt. The exact implementation depends on what Clerk's client SDK needs to consider a user signed in.

- [ ] **Step 2: Run E2E tests and fix failures**

```bash
cd apps/client && bunx playwright test
```

Fix any test failures caused by the route change.

- [ ] **Step 3: Commit**

```bash
git add apps/client/tests/
git commit -m "test(e2e): update tests for new routing (/play instead of /)"
```
