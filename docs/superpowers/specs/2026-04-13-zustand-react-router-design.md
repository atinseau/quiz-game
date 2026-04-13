# Zustand + React Router Migration

## Goal

Replace the monolithic `useGameState` hook (~490 lines) with Zustand stores and add react-router-dom for URL-based navigation. No feature changes - pure architectural refactor.

## Problems with current architecture

1. **`useGameState` does everything**: navigation, player management, game logic, timers, persistence, feedback - all in one 490-line hook
2. **Massive prop drilling**: `App.tsx` passes ~20 props to `GameScreen`, each screen receives all callbacks even when it only needs a few
3. **No URL routing**: navigation is state-based (`screen` variable), so refresh loses the page, no deep linking, no browser back/forward

## Architecture

### Zustand Stores

Three stores, each with a single responsibility:

**`stores/playerStore.ts`** - Player management
- State: `players: string[]`
- Actions: `addPlayer(name)`, `removePlayer(name)`, `resetPlayers()`
- Derived: `isSolo` (computed from players.length)

**`stores/packStore.ts`** - Pack/chunk selection + finished tracking
- State: `selectedChunk: string | null`, `finishedChunks: string[]`
- Actions: `selectChunk(chunk)`, `markFinished(chunk)`, `reset()`
- Loads `finishedChunks` from localStorage on creation

**`stores/gameStore.ts`** - Core game logic (scores, combos, questions, answers, timer, feedback, steal, blind)
- State: `questions`, `currentQuestionIndex`, `currentPlayerIndex`, `scores`, `combos`, `answered`, `blindMode`, `feedback`, `showForceBtn`, `stealConfirmMode`, `pendingStealer`, `gameMode`, `timeLeft`
- Actions: `startGame(chunk, mode, players)`, `submitAnswer(answer)`, `submitBlindAnswer(input)`, `revealChoices()`, `initiateSteal(stealer)`, `confirmSteal(valid)`, `forcePoint()`, `nextQuestion()`, `reset()`
- Derived: `currentQuestion`, `currentPlayer`, `totalQuestions`, `canSteal`
- `startGame` fetches questions, inits scores/combos, saves to localStorage
- `nextQuestion` persists state, navigates to `/end` when questions exhausted
- `reset` clears everything and navigates to `/`
- Timer logic (start/stop/timeout) stays here for chrono mode
- Reads `players` from `playerStore` via `getState()` when needed (e.g. `startGame`, `nextQuestion`)

### React Router

3 routes mapping to existing screens:

| Route | Component | Current equivalent |
|-------|-----------|-------------------|
| `/` | `HomeScreen` | `screen === "home"` |
| `/game` | `GameScreen` | `screen === "game"` |
| `/end` | `EndScreen` | `screen === "end"` |

- `App.tsx` becomes a `BrowserRouter` with `Routes`
- Navigation via `useNavigate()` called from store actions (using a small `router` reference pattern since stores are outside React)
- `GameScreen` redirects to `/` if no active game (guard)
- `EndScreen` redirects to `/` if no scores (guard)
- Restore-from-localStorage on app mount: if saved game exists, hydrate stores and redirect to `/game`

### Router reference pattern

Stores need to navigate but live outside React. Solution: a `router.ts` module that exports a `NavigateFunction` ref, set once in `App.tsx`:

```ts
// stores/router.ts
import type { NavigateFunction } from "react-router-dom";
let navigate: NavigateFunction = () => {};
export const setNavigate = (fn: NavigateFunction) => { navigate = fn; };
export const getNavigate = () => navigate;
```

### Component changes

**`App.tsx`**: Replace conditional rendering with `BrowserRouter` + `Routes`. Set router ref. No more props.

**`HomeScreen`**: Remove all props. Read from `playerStore` and `packStore` directly. Call store actions directly.

**`GameScreen`**: Remove all 20+ props. Read from `gameStore`, `playerStore`. Call store actions. Add redirect guard.

**`EndScreen`**: Remove all props. Read from `gameStore`, `playerStore`. Call store actions. Add redirect guard.

**Sub-components** (`AnswerInputs`, `Feedback`, `ScoreBoard`, `StealZone`): Keep props-based interface - they're pure display components that receive data from their parent screen. No need to connect them to stores.

### File structure

```
src/
  stores/
    router.ts           # navigate ref
    playerStore.ts
    packStore.ts
    gameStore.ts
  components/           # unchanged sub-components
    AnswerInputs.tsx
    Feedback.tsx
    ScoreBoard.tsx
    StealZone.tsx
  hooks/                # delete useGameState.ts
  utils/                # unchanged
    fuzzyMatch.ts
    sounds.ts
    storage.ts
  App.tsx               # router setup
  index.tsx             # unchanged
  types.ts              # unchanged (remove Screen type)
```

### Persistence

Same localStorage strategy as current. `gameStore` saves/loads `GameState` on key transitions (start, next question, score change). `packStore` manages `finishedChunks` independently. No change to `storage.ts` utils.

### Dependencies

Add: `zustand`, `react-router-dom`

## What does NOT change

- All game logic (scoring, combos, blind mode, steal, chrono, fuzzy matching)
- All UI/JSX (every screen looks exactly the same)
- Sub-components stay props-based
- `types.ts` constants and interfaces (except removing `Screen` type)
- `utils/` (fuzzyMatch, sounds, storage)
- Server-side (`index.ts`)
