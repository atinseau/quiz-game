# Mode Alcool Phase B — Manches Interactives — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 interactive drinking rounds (Conseil, Love or Drink, Cupidon, Show Us, Smatch or Pass) + Cupidon drink propagation + remove "Bientôt" badges.

**Architecture:** Plugin pattern — each round = 1 server file + 1 client file, registered in existing registries. Cupidon adds `cupidLinks` persistent state + `broadcastDrinkAlert` helper for propagation.

**Tech Stack:** Bun WebSocket, React 19, Zustand

**Spec:** `docs/superpowers/specs/2026-04-14-alcohol-phase-b-design.md`

---

## Task 1: Types + Cupidon infrastructure

**Files:**
- Modify: `apps/client/src/server/alcohol/types.ts` — add `cupidLinks` to AlcoholState
- Modify: `apps/client/src/server/types.ts` — add new WS messages
- Modify: `apps/client/src/server/alcohol/framework.ts` — add `broadcastDrinkAlert` helper
- Modify: `apps/client/src/stores/alcoholStore.ts` — add `cupidLinks`

- [ ] **Step 1:** Add `cupidLinks: [string, string][]` to `AlcoholState` in `server/alcohol/types.ts` and init to `[]` in `DEFAULT_ALCOHOL_CONFIG`... actually `cupidLinks` belongs in `AlcoholState` not config. Add it in `framework.ts`'s `initAlcoholState`.

- [ ] **Step 2:** Add new WS messages to `server/types.ts`:

ClientMessage additions:
```ts
| { type: "conseil_vote"; targetClerkId: string }
| { type: "love_or_drink_choice"; choice: "bisou" | "cul_sec" }
| { type: "show_us_vote"; color: string }
| { type: "show_us_reveal"; color: string }
| { type: "smatch_choice"; choice: "smatch" | "pass" }
```

ServerMessage additions:
```ts
| { type: "conseil_result"; votes: Record<string, string>; loserClerkIds: string[] }
| { type: "show_us_result"; correctColor: string; wrongClerkIds: string[] }
```

- [ ] **Step 3:** Add `broadcastDrinkAlert` to `framework.ts`:

```ts
export function broadcastDrinkAlert(room: Room, targetClerkId: string, emoji: string, message: string) {
  broadcast(room, { type: "drink_alert", targetClerkId, emoji, message });
  const links = room.game?.alcoholState?.cupidLinks ?? [];
  for (const [a, b] of links) {
    if (a === targetClerkId || b === targetClerkId) {
      const partner = a === targetClerkId ? b : a;
      const partnerName = room.players.get(partner)?.username ?? "?";
      broadcast(room, {
        type: "drink_alert",
        targetClerkId: partner,
        emoji: "💘",
        message: `${partnerName} est lié — boit aussi !`,
      });
    }
  }
}
```

Update existing rounds (petit-buveur, distributeur, courage) to use `broadcastDrinkAlert` instead of direct `broadcast(room, { type: "drink_alert", ... })`.

- [ ] **Step 4:** Add `cupidLinks` to `alcoholStore.ts`.

- [ ] **Step 5:** Add new message cases to `ws.ts` switch:
```ts
case "conseil_vote":
case "love_or_drink_choice":
case "show_us_vote":
case "show_us_reveal":
case "smatch_choice": {
  // same as existing alcohol message routing
  const room = findRoomByPlayer(clerkId);
  if (!room?.game) return;
  handleAlcoholMessage(room, clerkId, msg as Record<string, unknown>);
  break;
}
```

- [ ] **Step 6:** Commit
```bash
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): add Cupidon infrastructure + new WS messages"
```

---

## Task 2: Conseil du village (server + client)

**Files:**
- Create: `apps/client/src/server/alcohol/rounds/conseil.ts`
- Create: `apps/client/src/components/alcohol/rounds/Conseil.tsx`

**Server logic:**
- Track votes per room (`Map<roomCode, Map<clerkId, targetClerkId>>`)
- 30s timeout
- When all connected players voted (or timeout): count votes, find max, handle ties
- Broadcast `conseil_result` + `drink_alert` to loser(s)
- Use `broadcastDrinkAlert` for Cupidon propagation

**Client UI:**
- Shows list of other players as vote buttons
- Voted state → "En attente des votes..."
- Result → who got the most votes, with vote breakdown
- Solo mode: each player votes in turn (passage du téléphone simulation — show a "Passe le téléphone à {name}" screen)

- [ ] **Step 1:** Create server round
- [ ] **Step 2:** Create client component
- [ ] **Step 3:** Register in both registries (`rounds/index.ts`)
- [ ] **Step 4:** Commit
```bash
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): add Conseil du village round"
```

---

## Task 3: Love or Drink (server + client)

**Files:**
- Create: `apps/client/src/server/alcohol/rounds/love-or-drink.ts`
- Create: `apps/client/src/components/alcohol/rounds/LoveOrDrink.tsx`

**Server logic:**
- Find 2 players with lowest scores
- Wait for one of them to choose "bisou" or "cul_sec"
- 30s timeout → default to cul_sec
- If cul_sec → `broadcastDrinkAlert` for both

**Client UI:**
- Shows 2 player names face to face
- 2 buttons: "Bisou 💋" / "Cul sec 🍺"
- Only the 2 concerned players can click
- Others see the scene + result

- [ ] **Step 1:** Create server round
- [ ] **Step 2:** Create client component
- [ ] **Step 3:** Register in both registries
- [ ] **Step 4:** Commit
```bash
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): add Love or Drink round"
```

---

## Task 4: Cupidon (server + client)

**Files:**
- Create: `apps/client/src/server/alcohol/rounds/cupidon.ts`
- Create: `apps/client/src/components/alcohol/rounds/Cupidon.tsx`

**Server logic:**
- Pick 2 random connected players
- Add to `alcoholState.cupidLinks`
- Broadcast the link
- Auto-end after 5s

**Client UI:**
- Heart animation showing 2 linked player names
- Badge "💘 Lié" visible on scoreboard for linked players (modify ScoreBoard to check cupidLinks)

- [ ] **Step 1:** Create server round
- [ ] **Step 2:** Create client component
- [ ] **Step 3:** Register in both registries
- [ ] **Step 4:** Commit
```bash
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): add Cupidon round"
```

---

## Task 5: Show Us (server + client)

**Files:**
- Create: `apps/client/src/server/alcohol/rounds/show-us.ts`
- Create: `apps/client/src/components/alcohol/rounds/ShowUs.tsx`

**Server logic:**
- Pick random player (the "target")
- Other players vote a color (Bleu, Noir, Blanc, Rouge, Autre) — 15s timer
- Target reveals the real color
- Compare: wrong voters drink via `broadcastDrinkAlert`
- Broadcast `show_us_result`

**Client UI:**
- Target player: "Attends que les autres devinent..." → then 5 color buttons to reveal
- Other players: 5 color buttons to vote, 15s countdown
- Result: who got it right/wrong

- [ ] **Step 1:** Create server round
- [ ] **Step 2:** Create client component
- [ ] **Step 3:** Register in both registries
- [ ] **Step 4:** Commit
```bash
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): add Show Us round"
```

---

## Task 6: Smatch or Pass (server + client)

**Files:**
- Create: `apps/client/src/server/alcohol/rounds/smatch-or-pass.ts`
- Create: `apps/client/src/components/alcohol/rounds/SmatchOrPass.tsx`

**Server logic:**
- Find 2 players of opposite gender (check `player.gender`)
- If none found → skip, trigger next round from queue
- Assign one as "décideur", other as "receveur"
- Wait for décideur to choose "smatch" or "pass"
- 30s timeout → default to pass
- Broadcast result to all

**Client UI:**
- Shows 2 players face to face with gender icons
- Décideur sees 2 buttons: "Smatch 💋" / "Pass 👋"
- Result animation visible by all
- Fallback text if no opposite gender pair available

- [ ] **Step 1:** Create server round
- [ ] **Step 2:** Create client component
- [ ] **Step 3:** Register in both registries
- [ ] **Step 4:** Commit
```bash
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): add Smatch or Pass round"
```

---

## Task 7: Remove "Bientôt" badges + update AlcoholConfig

**Files:**
- Modify: `apps/client/src/components/alcohol/AlcoholConfig.tsx`
- Modify: `apps/client/src/stores/alcoholStore.ts`

- [ ] **Step 1:** In `AlcoholConfig.tsx`, change `available: false` to `available: true` for all 5 Phase B rounds.

- [ ] **Step 2:** In `alcoholStore.ts`, add the 5 Phase B round types to `AVAILABLE_ROUNDS`.

- [ ] **Step 3:** Update default `enabledRounds` to include all 8 rounds.

- [ ] **Step 4:** Commit
```bash
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(alcohol): enable all 8 rounds, remove Bientôt badges"
```

---

## Task 8: E2E Tests + Update Discovery

- [ ] **Step 1:** Run full E2E suite — existing tests should pass with alcohol disabled.
- [ ] **Step 2:** Add new tests for the 5 rounds (at minimum, verify each overlay appears when triggered).
- [ ] **Step 3:** Update `.discovery/scenarios/_index.md` with new scenarios.
- [ ] **Step 4:** Commit
```bash
LEFTHOOK_EXCLUDE=e2e git commit -m "test(e2e): add Phase B alcohol round tests"
```
