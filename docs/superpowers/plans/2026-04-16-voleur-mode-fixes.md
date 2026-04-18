# Voleur Mode Multi-Appareil — Corrections

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 bugs/missing features in the multi-device voleur mode: turn indicator, stealer visual cue, input lock on resolution, steal feedback box, and sounds.

**Architecture:** All fixes are client-side except one server-side tweak (immediate turn end when main is correct). `MultiGameScreen.tsx` receives most changes. Sounds are triggered in the `roomStore.ts` WS handler on `turn_result`. A new `VoleurStealBanner` component handles the amber steal notification.

**Tech Stack:** React, Zustand, Bun WebSocket server, Playwright E2E tests

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/client/src/components/MultiGameScreen.tsx` | Modify | Add voleur turn indicator, stealer cue, input lock on `turnResult`, steal feedback box |
| `apps/client/src/stores/roomStore.ts` | Modify | Play sounds on `turn_result` |
| `apps/client/src/server/game-engine.ts` | Modify | End turn immediately when main player answers correctly (no steal window) |
| `apps/client/tests/e2e/multi-voleur-flow.spec.ts` | Modify | Add E2E tests for voleur-specific UI |

---

### Task 1: Turn indicator for voleur mode — show who is the main responder

**Files:**
- Modify: `apps/client/src/components/MultiGameScreen.tsx:167-183`

Currently the turn indicator is hidden with `!isVoleur`. We need to show it in voleur mode too, but with different messaging: the main responder sees "C'est ton tour — Réponds en premier !" and others see "C'est au tour de {username} — Tente de voler !".

- [ ] **Step 1: Replace the turn indicator block**

In `MultiGameScreen.tsx`, replace the turn indicator section (lines 167-183):

```tsx
{/* Turn indicator */}
<div className="mb-4">
  {isMyTurn ? (
    <p className="text-lg font-bold text-party-green">
      {isVoleur ? "C'est ton tour — Réponds en premier !" : "C'est ton tour !"}
    </p>
  ) : isVoleur ? (
    <p className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
      <Zap className="size-4" />
      C'est au tour de{" "}
      <span className="text-foreground">{currentPlayerUsername}</span>
      {" "}— Tente de voler !
    </p>
  ) : (
    <p className="text-sm text-muted-foreground">
      C'est au tour de{" "}
      <span className="font-semibold text-foreground">
        {currentPlayerUsername}
      </span>
    </p>
  )}
</div>
```

Add `Zap` to the lucide-react import at the top of the file:

```tsx
import { CheckCircle2, Clock, User, XCircle, Zap } from "lucide-react";
```

- [ ] **Step 2: Verify in browser**

Run `bun run --hot apps/client/index.ts`, open two browser tabs, create a voleur game. Verify:
- Main responder sees green "C'est ton tour — Réponds en premier !"
- Other player sees amber "C'est au tour de {X} — Tente de voler !" with Zap icon

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/MultiGameScreen.tsx
git commit -m "fix(voleur): show turn indicator with role distinction for main responder vs stealers"
```

---

### Task 2: Lock inputs when turn is resolved

**Files:**
- Modify: `apps/client/src/components/MultiGameScreen.tsx:113-115`

When `turn_result` arrives, a player who hasn't answered sees the correct answer displayed but inputs stay active. Fix: disable inputs when `turnResult` is set.

- [ ] **Step 1: Update inputDisabled logic**

In `MultiGameScreen.tsx`, replace the `inputDisabled` computation (line 113-115):

```tsx
const inputDisabled = game.turnResult !== null || (isVoleur
  ? game.hasAnswered
  : !(isMyTurn && !game.hasAnswered));
```

This adds `game.turnResult !== null` as a top-level guard — once the turn is resolved, nobody can interact with inputs regardless of mode.

- [ ] **Step 2: Verify in browser**

In voleur mode, have player A answer. Player B should still have inputs enabled. Once the turn resolves (all answered or steal), verify player B's inputs become disabled AND the feedback block is shown.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/MultiGameScreen.tsx
git commit -m "fix(voleur): disable inputs when turn_result is received"
```

---

### Task 3: End turn immediately when main responder answers correctly

**Files:**
- Modify: `apps/client/src/server/game-engine.ts:304-437`

Currently `resolveVoleur` waits for all stealers even if the main player answered correctly. Per the user's expectation: if the main answers correctly, the turn should end immediately — no steal window. Only when the main answers **incorrectly** do stealers get a chance to steal.

- [ ] **Step 1: Add early resolution for correct main answer**

In `game-engine.ts`, modify `resolveVoleur`. After the main player's answer is checked and before the stealer loop, add an early return if main is correct:

Replace the entire `resolveVoleur` function (lines 304-437):

```ts
function resolveVoleur(room: Room): void {
  const game = room.game;
  if (!game) return;

  const mainPlayerId = currentPlayerId(room);
  if (!mainPlayerId) return;

  // Main player must have answered
  if (!game.answers.has(mainPlayerId)) return;

  const question = game.questions[game.currentQuestionIndex];
  if (!question) return;

  const mainAnswer = game.answers.get(mainPlayerId);
  const mainCorrect = checkAnswer(mainAnswer as string | boolean, question);

  // If main player answered correctly → turn ends immediately, no steal window
  if (mainCorrect) {
    game.resolved = true;

    const combo = Math.min((game.combos[mainPlayerId] ?? 0) + 1, MAX_COMBO);
    game.combos[mainPlayerId] = combo;
    game.scores[mainPlayerId] = (game.scores[mainPlayerId] ?? 0) + 1;

    const playerResults: PlayerResult[] = [
      {
        clerkId: mainPlayerId,
        answered: true,
        correct: true,
        stole: false,
        pointsDelta: 1,
      },
    ];

    const result: TurnResult = {
      correctAnswer: question.answer,
      playerResults,
      scores: { ...game.scores },
      combos: { ...game.combos },
    };

    broadcast(room, { type: "turn_result", results: result });
    scheduleNextQuestion(room);
    return;
  }

  // Main answered incorrectly → stealers get a chance
  const otherPlayerIds = getConnectedPlayerIds(room).filter(
    (id) => id !== mainPlayerId,
  );

  // Check if a stealer already answered correctly
  let stealerWon: string | null = null;
  for (const id of otherPlayerIds) {
    const ans = game.answers.get(id);
    if (ans !== undefined && checkAnswer(ans as string | boolean, question)) {
      stealerWon = id;
      break;
    }
  }

  // If no stealer won yet, check if all others have tried (or are disconnected)
  if (!stealerWon) {
    const allOthersTried = otherPlayerIds.every(
      (id) => game.answers.has(id) || !room.players.get(id)?.connected,
    );
    if (!allOthersTried) return; // Still waiting for more answers
  }

  game.resolved = true;

  const playerResults: PlayerResult[] = [];

  if (stealerWon) {
    // Stealer gets STEAL_GAIN, main player loses STEAL_LOSS
    game.scores[stealerWon] = (game.scores[stealerWon] ?? 0) + STEAL_GAIN;
    game.combos[stealerWon] = Math.min(
      (game.combos[stealerWon] ?? 0) + 1,
      MAX_COMBO,
    );
    game.scores[mainPlayerId] = (game.scores[mainPlayerId] ?? 0) - STEAL_LOSS;
    game.combos[mainPlayerId] = 0;

    // Main player result
    playerResults.push({
      clerkId: mainPlayerId,
      answered: true,
      correct: false,
      stole: false,
      pointsDelta: -STEAL_LOSS,
    });

    // Stealer result
    playerResults.push({
      clerkId: stealerWon,
      answered: true,
      correct: true,
      stole: true,
      pointsDelta: STEAL_GAIN,
    });

    // Other stealers who answered wrong
    for (const id of otherPlayerIds) {
      if (id === stealerWon) continue;
      if (game.answers.has(id)) {
        game.scores[id] = (game.scores[id] ?? 0) - STEAL_FAIL_PENALTY;
        game.combos[id] = 0;
        playerResults.push({
          clerkId: id,
          answered: true,
          correct: false,
          stole: false,
          pointsDelta: -STEAL_FAIL_PENALTY,
        });
      }
    }
  } else {
    // No stealer won — main already incorrect
    game.combos[mainPlayerId] = 0;
    playerResults.push({
      clerkId: mainPlayerId,
      answered: true,
      correct: false,
      stole: false,
      pointsDelta: 0,
    });

    // Stealers who tried and failed
    for (const id of otherPlayerIds) {
      if (game.answers.has(id)) {
        game.scores[id] = (game.scores[id] ?? 0) - STEAL_FAIL_PENALTY;
        game.combos[id] = 0;
        playerResults.push({
          clerkId: id,
          answered: true,
          correct: false,
          stole: false,
          pointsDelta: -STEAL_FAIL_PENALTY,
        });
      }
    }
  }

  const result: TurnResult = {
    correctAnswer: question.answer,
    playerResults,
    scores: { ...game.scores },
    combos: { ...game.combos },
  };

  broadcast(room, { type: "turn_result", results: result });
  scheduleNextQuestion(room);
}
```

- [ ] **Step 2: Verify in browser**

Start a 2-player voleur game. When main player answers correctly:
- Turn should resolve immediately
- Correct answer shown to all
- Other player's inputs lock (from Task 2)
- No steal window

When main player answers incorrectly:
- Other player should still be able to answer (steal attempt)

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/server/game-engine.ts
git commit -m "fix(voleur): end turn immediately when main responder answers correctly"
```

---

### Task 4: Steal feedback box (amber/orange)

**Files:**
- Modify: `apps/client/src/components/MultiGameScreen.tsx:227-269`

The current feedback only shows green (correct) or red (incorrect). In voleur mode, when a steal occurs (`stole: true` in results), we need an amber box. Three cases:
1. I successfully stole → amber "Tu as volé {STEAL_GAIN} pt !"
2. Someone stole from me (I'm the main and got stolen) → amber "{stealer} t'a volé la réponse !"
3. Normal correct/incorrect → existing green/red

- [ ] **Step 1: Replace the turn result feedback block**

In `MultiGameScreen.tsx`, replace the turn result feedback section (lines 227-269):

```tsx
{/* Turn result feedback */}
{game.turnResult &&
  (() => {
    const myResult = game.turnResult.playerResults.find(
      (r) => r.clerkId === myClerkId,
    );
    const stealResult = game.turnResult.playerResults.find(
      (r) => r.stole,
    );
    const isCorrect = myResult?.correct ?? false;
    const points = myResult?.pointsDelta ?? 0;

    // Determine if this is a steal scenario
    const iStole = myResult?.stole === true;
    const someoneStoleFromMe =
      stealResult != null && stealResult.clerkId !== myClerkId && isMyTurn;
    const isStealScenario = iStole || someoneStoleFromMe;

    // Pick colors: amber for steal, green for correct, red for incorrect
    const bgClass = isStealScenario
      ? "bg-amber-500/10 border border-amber-500/30"
      : isCorrect
        ? "bg-emerald-500/10 border border-emerald-500/30"
        : "bg-red-500/10 border border-red-500/30";
    const iconColor = isStealScenario
      ? "text-amber-400"
      : isCorrect
        ? "text-emerald-400"
        : "text-red-400";
    const titleColor = isStealScenario
      ? "text-amber-400"
      : isCorrect
        ? "text-emerald-400"
        : "text-red-400";

    // Pick title text
    let title: string;
    if (iStole) {
      title = `Vol reussi ! +${STEAL_GAIN} pt`;
    } else if (someoneStoleFromMe) {
      const stealerUsername =
        clerkIdToUsername[stealResult.clerkId] ?? "???";
      title = `${stealerUsername} t'a vole la reponse !`;
    } else if (isCorrect) {
      title = "Bonne reponse !";
    } else {
      title = "Mauvaise reponse";
    }

    const Icon = isStealScenario
      ? Zap
      : isCorrect
        ? CheckCircle2
        : XCircle;

    return (
      <div
        className={`mt-6 rounded-lg p-4 flex items-start gap-3 ${bgClass}`}
      >
        <Icon
          className={`size-5 ${iconColor} shrink-0 mt-0.5`}
        />
        <div>
          <p className={`font-semibold ${titleColor}`}>
            {title}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Reponse correcte :{" "}
            <span className="font-medium text-foreground">
              {String(game.turnResult.correctAnswer)}
            </span>
          </p>
          {points !== 0 && (
            <p className="text-sm mt-1">
              {points > 0 ? "+" : ""}
              {points} pt
              {Math.abs(points) > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
    );
  })()}
```

Also add the `STEAL_GAIN` import at the top of the file:

```tsx
import { CHRONO_DURATION, STEAL_GAIN } from "../types";
```

- [ ] **Step 2: Verify in browser**

Test all 3 feedback scenarios:
1. Main answers incorrectly, stealer answers correctly → stealer sees amber "Vol reussi !", main sees amber "{stealer} t'a vole la reponse !"
2. Main answers correctly → green "Bonne reponse !"
3. Main answers incorrectly, stealer also wrong → red "Mauvaise reponse" for both

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/MultiGameScreen.tsx
git commit -m "feat(voleur): add amber steal feedback box in multi-device mode"
```

---

### Task 5: Play sounds on turn_result in multi-device mode

**Files:**
- Modify: `apps/client/src/stores/roomStore.ts:275-284`

The `turn_result` handler in roomStore sets state but never plays sounds. We need to import `sounds` and play the appropriate one based on the player's result.

- [ ] **Step 1: Add sound import**

At the top of `roomStore.ts`, add:

```ts
import { sounds } from "../utils/sounds";
```

- [ ] **Step 2: Play sounds in the turn_result handler**

Replace the `turn_result` case (lines 275-284):

```ts
case "turn_result": {
  const myResult = msg.results.playerResults.find(
    (r: PlayerResult) => r.clerkId === state.myClerkId,
  );
  if (myResult) {
    if (myResult.stole) {
      sounds.steal();
    } else if (myResult.correct) {
      sounds.win();
    } else if (myResult.answered) {
      sounds.fail();
    }
  }
  set({
    game: {
      ...state.game,
      turnResult: msg.results,
      scores: msg.results.scores,
      combos: msg.results.combos,
    },
  });
  break;
}
```

Note: the existing `PlayerResult` type is already imported at the top of the file (line 31-37 interface). The `find` callback uses it for the type annotation.

- [ ] **Step 3: Verify in browser**

Play a multi-device game in any mode:
- Correct answer → win sound
- Incorrect answer → fail sound
- Successful steal → steal sound
- Player who didn't answer (e.g. turn ended before they could) → no sound

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/stores/roomStore.ts
git commit -m "feat(multi): play win/fail/steal sounds on turn_result"
```

---

### Task 6: E2E test — voleur turn indicator and steal feedback

**Files:**
- Modify: `apps/client/tests/e2e/multi-voleur-flow.spec.ts`

Add a test that verifies the voleur-specific UI elements: turn indicator text, steal visual, and that inputs lock after resolution.

- [ ] **Step 1: Add voleur UI test**

Append a new test to `multi-voleur-flow.spec.ts`:

```ts
test("Multi-device voleur: shows turn indicator and stealer cue", async ({
  multi,
}) => {
  test.slow();
  const { host, guest } = multi;

  await setTestUser(host, "Alice");
  await setTestUser(guest, "Bob");

  const code = await hostCreatesRoom(host);
  await guestJoinsRoom(guest, code);
  await expect(host.getByText("Bob")).toBeVisible({ timeout: 5000 });

  await hostSelectsPack(host, "pack-test");
  await hostSelectsMode(host, "voleur");
  await hostStartsGame(host);

  await host.waitForURL("**/game", { timeout: 10000 });
  await guest.waitForURL("**/game", { timeout: 10000 });
  await expect(host.locator("p.text-xl")).toBeVisible({ timeout: 10000 });

  // One player should see "Réponds en premier" and the other "Tente de voler"
  const hostText = await host.locator(".mb-4 p").textContent();
  const guestText = await guest.locator(".mb-4 p").textContent();

  const texts = [hostText, guestText];
  const hasMainIndicator = texts.some((t) =>
    t?.includes("Réponds en premier"),
  );
  const hasStealIndicator = texts.some((t) => t?.includes("Tente de voler"));

  expect(hasMainIndicator).toBe(true);
  expect(hasStealIndicator).toBe(true);
});
```

- [ ] **Step 2: Run the test**

```bash
cd apps/client && bunx playwright test tests/e2e/multi-voleur-flow.spec.ts --reporter=list
```

Expected: both tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/client/tests/e2e/multi-voleur-flow.spec.ts
git commit -m "test(voleur): add E2E test for turn indicator and stealer cue"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Turn indicator for main responder vs stealers | `MultiGameScreen.tsx` |
| 2 | Lock inputs on turn resolution | `MultiGameScreen.tsx` |
| 3 | End turn immediately on correct main answer | `game-engine.ts` |
| 4 | Amber steal feedback box | `MultiGameScreen.tsx` |
| 5 | Play sounds on turn_result | `roomStore.ts` |
| 6 | E2E test for voleur UI | `multi-voleur-flow.spec.ts` |
