# Manches Spéciales — Plan d'implémentation

> Version: 1.0 — 19 avril 2026
> Dépend de : `docs/superpowers/specs/2026-04-19-special-rounds-audit.md`, `docs/superpowers/specs/2026-04-19-special-rounds-fix-design.md`

## Principes d'exécution

- **Tests en isolation** : après chaque fix, lancer UNIQUEMENT le repro concerné (`bun run e2e <path>` ou `bun test <file>`). Jamais la suite complète entre deux fix — trop lent, trop bruyant.
- **Agents parallèles** : pour les fix indépendants (ex : FIX #3, #6, #8, #9, #10 qui touchent des fichiers différents), dispatch N agents simultanément, chacun ownant un fix + son repro.
- **Aucun `test.skip`** : le test flippe de `fail` à `pass` à chaque fix. Le commit 11 nettoie les markers.
- **Un commit par fix** : diff minimal, review facile, rollback ciblé.

## Pré-flight (5 min)

```bash
# 1. Baseline : confirmer que les 14 repros échouent bien comme attendu.
cd apps/client
bun test src/server/alcohol/rounds/                       # 4 pass (test.failing)
bun run e2e tests/e2e/repro/                              # 10 pass (test.fail)

# 2. Confirmer TS + Biome propres AVANT de commencer.
bunx tsc --noEmit
bunx biome check .
```

Si une ligne ne passe pas à ce stade, STOP. Le plan suppose un état de départ sain.

---

## Étape 1 — FIX #1 : handlers Phase B dans `roomStore.ts`

**Fichiers**
- `apps/client/src/stores/roomStore.ts` (lignes ~279-318 : ajouter 4 `case` après le handler `courage_result`)
- `apps/client/src/server/types.ts` (union `ServerMessage` : ajouter les 4 messages `*_result` manquants)

**Patch**
Voir design, section FIX #1. Les 4 `case` mergent `msg` payload dans `activeRoundData` via `setActiveRound`.

Pour `conseil_result` + `show_us_result` : ajouter `phase: "result"` dans le merge (les composants lisent `data.phase === "result"`).

**Validation (isolée)**
```bash
cd apps/client
bun run e2e tests/e2e/repro/multi-repro-BUG-FLOW-1-conseil.spec.ts
bun run e2e tests/e2e/repro/multi-repro-BUG-FLOW-1-love-or-drink.spec.ts
bun run e2e tests/e2e/repro/multi-repro-BUG-FLOW-1-show-us.spec.ts
bun run e2e tests/e2e/repro/multi-repro-BUG-FLOW-1-smatch.spec.ts
```

**Résultat attendu** : les 4 tests restent en `test.fail` donc passent toujours comme "expected fail". On ne flip les markers qu'à l'étape 11. On cherche juste la preuve du flip : chaque test, en retirant temporairement `test.fail`, devient vert. **Ne pas committer cette manipulation** — c'est un check local.

**Commit**
```
fix(alcohol): handle Phase B result messages in roomStore

Add handlers for conseil_result, love_or_drink_result, show_us_result
and smatch_or_pass_result so the overlay transitions from the waiting
phase to the result phase in multi mode. Also declare the 4 messages
in ServerMessage to restore static type-safety.
```

---

## Étape 2 — FIX #2 : `DrinkAlert` queue (une alerte à la fois)

**Fichiers**
- `apps/client/src/stores/alcoholStore.ts` — transformer `drinkAlerts: DrinkAlertData[]` en une file avec exposition `currentDrinkAlert`
- `apps/client/src/components/GameScreen.tsx` — render `currentDrinkAlert` au lieu de `drinkAlerts.map(...)`
- `apps/client/src/components/MultiGameScreen.tsx` — idem

**Patch store (esquisse)**
```ts
// alcoholStore.ts
currentDrinkAlert: DrinkAlertData | null,

addDrinkAlert: (alert) => set((s) => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const entry = { ...alert, id };
  // If no current alert, promote this one; else enqueue.
  if (s.currentDrinkAlert === null) {
    return { currentDrinkAlert: entry, drinkAlerts: s.drinkAlerts };
  }
  return { drinkAlerts: [...s.drinkAlerts, entry] };
}),

removeDrinkAlert: () => set((s) => {
  const [next, ...rest] = s.drinkAlerts;
  return { currentDrinkAlert: next ?? null, drinkAlerts: rest };
}),
```

Note : `removeDrinkAlert(id)` aujourd'hui prend un `id` — supprimer l'argument (l'alerte active est unique). Adapter les 2 `*GameScreen` qui appellent `removeDrinkAlert(alert.id)`.

**Validation**
```bash
cd apps/client
bun run e2e tests/e2e/repro/multi-repro-BUG-FLOW-2-drink-alert-stack.spec.ts
bun run e2e tests/e2e/repro/repro-BUG-love-or-drink-double-alert.spec.ts
```

**Commit**
```
fix(alcohol): serialize drink alerts through a single-slot queue

DrinkAlert rendered fullscreen (inset-0 z-[100]); when multiple players
drank simultaneously (petit_buveur tie, love_or_drink cul_sec, cupidon
propagation) we stacked N fullscreen overlays. Keep only one active
at a time; next alerts dequeue after the current one closes.
```

---

## Étape 3 — FIX #3 : supprimer le délai 1 s dans `endSpecialRound`

**Fichiers**
- `apps/client/src/server/alcohol/framework.ts` (lignes 130-140)

**Patch**
```ts
export function endSpecialRound(room: Room): void {
  const game = room.game;
  if (!game?.alcoholState) return;
  game.alcoholState.activeRound = null;
  broadcast(room, { type: "special_round_end" });
  if (_onRoundEnd) _onRoundEnd(room);  // was: setTimeout(..., 1000)
}
```

**Validation**
```bash
cd apps/client
bun run e2e tests/e2e/repro/multi-repro-BUG-FLOW-3-round-end-gap.spec.ts
```

**Vérification supplémentaire** (non automatisée) : relancer manuellement un test existant qui joue un round complet (`multi-alcohol-flow.spec.ts`) pour s'assurer que le retrait du délai ne crée pas de flash inverse (`question` qui arrive AVANT que l'overlay ait fini son animation de fermeture).

**Commit**
```
fix(alcohol): drop 1s artificial delay before sending next question

endSpecialRound was scheduling sendQuestion with a 1s setTimeout,
leaving a window where the client had closed the overlay but the
last turn_result was still on screen. Fire sendQuestion synchronously
so the next question arrives in the same tick.
```

---

## Étape 4 — FIX #4 : Courage `usedByCourage` Set

**Fichiers**
- `apps/client/src/server/alcohol/types.ts` — ajouter `usedByCourage: Set<number>` à `AlcoholState`
- `apps/client/src/server/alcohol/framework.ts` — initialiser `usedByCourage: new Set()` dans `initAlcoholState`
- `apps/client/src/server/alcohol/rounds/courage.ts` — `pickCourageQuestion` marque l'index au lieu de splicer
- `apps/client/src/server/game-engine.ts` — `scheduleNextQuestion` skippe les index dans `usedByCourage`

**Patch** voir design FIX #4 pour les 4 extraits.

**Validation (ordre important)**
```bash
cd apps/client
# Unit test d'abord (rapide, déterministe)
bun test src/server/alcohol/rounds/courage.test.ts

# Puis l'E2E
bun run e2e tests/e2e/repro/multi-repro-BUG-FLOW-4-courage-splice.spec.ts
```

**Commit**
```
fix(alcohol): stop courage from shrinking the question pool

pickCourageQuestion used to splice the chosen QCM from game.questions,
silently shortening every game that saw an accepted courage. Track
consumed indexes in alcoholState.usedByCourage and have
scheduleNextQuestion skip over them. Game length is now independent
of how many courage rounds fire.
```

---

## Étape 5 — FIX #5 : Conseil solo guard < 2 joueurs

**Fichiers**
- `apps/client/src/stores/gameStore.ts` — ajouter le guard devant `setActiveRound("conseil", ...)`

**Patch** voir design FIX #5.

Détail d'exécution : au lieu de simplement `return`, mieux vaut faire skip et re-trigger la manche suivante (`useAlcoholStore.getState().checkTrigger()`) — comme le fait déjà le serveur quand smatch ne trouve pas de paire opposée. **Action** : localiser le pattern existant dans `gameStore.ts` et s'aligner.

**Validation**
```bash
cd apps/client
bun run e2e tests/e2e/repro/repro-BUG-conseil-solo-empty.spec.ts
```

**Commit**
```
fix(alcohol): skip Conseil in solo mode when there's only one player

With a single player, the vote screen rendered the lone player as a
self-vote target — degenerate UX. Skip the round (re-pull from the
queue) when players.length < 2 in solo.
```

---

## Étape 6 — FIX #6 : Courage countdown auto-refus (solo)

**Fichiers**
- `apps/client/src/components/alcohol/rounds/QuestionDeCourage.tsx` — useEffect countdown force `sendChoice(false)` quand il atteint 0

**Patch** voir design FIX #6.

**Validation**
```bash
cd apps/client
bun run e2e tests/e2e/repro/repro-BUG-courage-countdown-no-force.spec.ts
```

**Commit**
```
fix(alcohol): auto-refuse solo courage when countdown reaches zero

The 10s countdown was purely decorative in solo — buttons remained
clickable past expiry. Match the server's timeout behaviour by
firing sendChoice(false) when the counter hits 0.
```

---

## Étape 7 — FIX #7 : LoveOrDrink solo alerte agrégée

**Fichiers**
- `apps/client/src/components/alcohol/rounds/LoveOrDrink.tsx:38-45`

**Patch**
Remplacer la boucle `for (const p of players) addDrinkAlert(...)` par un seul `addDrinkAlert` mentionnant les deux noms.

**Validation**
```bash
cd apps/client
bun run e2e tests/e2e/repro/repro-BUG-love-or-drink-double-alert.spec.ts
```

Ce test passe déjà via FIX #2 (queue), mais ce fix rend le message plus lisible pour l'utilisateur et évite 2 dequeues successifs. Exécuter quand même le repro pour confirmer qu'il reste vert.

**Commit**
```
fix(alcohol): aggregate LoveOrDrink cul_sec alert into one message

Solo cul_sec previously enqueued two separate drink alerts ("A boit",
"B boit"). Send a single aggregated message naming both players.
```

---

## Étape 8 — FIX #8 : Cupidon Fisher-Yates

**Fichiers**
- `apps/client/src/server/alcohol/framework.ts` — exporter `shuffleArray`
- `apps/client/src/server/alcohol/rounds/cupidon.ts:15` — utiliser `shuffleArray`

**Patch**
```ts
// framework.ts
export function shuffleArray<T>(arr: T[]): T[] { ... }  // was non-exported

// cupidon.ts
import { shuffleArray } from "../framework";
...
const shuffled = shuffleArray(players);
```

**Validation**
```bash
cd apps/client
bun test src/server/alcohol/rounds/cupidon.test.ts
```

**Commit**
```
fix(alcohol): replace biased Math.random sort in Cupidon with Fisher-Yates

Reuse framework.shuffleArray which is already uniform. The previous
[...].sort(() => Math.random() - 0.5) has documented bias.
```

---

## Étape 9 — FIX #9 : Smatch sélection aléatoire

**Fichiers**
- `apps/client/src/server/alcohol/rounds/smatch-or-pass.ts:42-43`

**Patch** voir design FIX #9.

**Validation**
```bash
cd apps/client
bun test src/server/alcohol/rounds/smatch-or-pass.test.ts
```

**Commit**
```
fix(alcohol): pick Smatch or Pass players randomly from each gender

find() always returned the first-inserted homme/femme. Filter the
gender lists and pick a random index so every eligible player has
an equal chance of being selected over a session.
```

---

## Étape 10 — FIX #10 : Distributeur ordre de rotation

**Fichiers**
- `apps/client/src/server/alcohol/rounds/distributeur.ts:19-26`

**Patch** voir design FIX #10 (boucle démarrant à `game.currentPlayerIndex`).

**Validation**
```bash
cd apps/client
bun test src/server/alcohol/rounds/distributeur.test.ts
```

**Commit**
```
fix(alcohol): break Distributeur score ties by rotation order

With tied max scores, Object.entries returned the first-inserted
player. Iterate rotation starting from currentPlayerIndex so the
tie-break follows the turn order the spec describes.
```

---

## Étape 11 — Retirer les markers `test.fail` / `test.failing`

Une fois les 10 fix committés, TOUS les repros passeraient en "expected fail but passed" (donc rouge). Retirer les markers et, pendant qu'on y est, renforcer chaque test avec 1-2 assertions supplémentaires pour qu'il couvre aussi un aspect de la **régression** (pas seulement l'apparition du comportement attendu).

**Fichiers**
- 10 repros dans `apps/client/tests/e2e/repro/`
- 4 unit tests dans `apps/client/src/server/alcohol/rounds/`

**Actions par fichier**
| Fichier | Marker à retirer | Assertion à ajouter |
|---------|------------------|---------------------|
| `multi-repro-BUG-FLOW-1-conseil.spec.ts` | `test.fail` → `test` | après le résultat, vérifier qu'un `drink_alert` visible contient le nom du loser |
| `multi-repro-BUG-FLOW-1-love-or-drink.spec.ts` | idem | vérifier que l'overlay se ferme ensuite (waitForRoundOverlayGone) |
| `multi-repro-BUG-FLOW-1-show-us.spec.ts` | idem | vérifier que les votants "wrong" reçoivent bien le drink_alert |
| `multi-repro-BUG-FLOW-1-smatch.spec.ts` | idem | vérifier que le texte reflète bien le choix fait |
| `multi-repro-BUG-FLOW-2-drink-alert-stack.spec.ts` | idem | ajouter : après close du 1er alert, le 2e arrive (assert sequence) |
| `multi-repro-BUG-FLOW-3-round-end-gap.spec.ts` | idem | ajouter : la nouvelle question a un texte différent de l'ancienne |
| `multi-repro-BUG-FLOW-4-courage-splice.spec.ts` | idem | ajouter : questionCount === PACK_SIZE (pas juste ≥) |
| `repro-BUG-conseil-solo-empty.spec.ts` | idem | ajouter : une manche suivante se déclenche quand même (queue avance) |
| `repro-BUG-courage-countdown-no-force.spec.ts` | idem | ajouter : un drink_alert "refuse" apparaît |
| `repro-BUG-love-or-drink-double-alert.spec.ts` | idem | ajouter : le texte de l'alerte nomme les 2 joueurs |
| `cupidon.test.ts` | `test.failing` → `test` | ajouter : chaque paire apparaît (pas juste moyenne uniforme) |
| `smatch-or-pass.test.ts` | idem | ajouter : vérif que femme aussi est aléatoire |
| `distributeur.test.ts` | idem | ajouter : cas currentPlayerIndex wrap-around |
| `courage.test.ts` | idem | ajouter : `usedByCourage.has(idx)` après accept |

**Validation finale — full suite**
```bash
cd apps/client
bun test src/server/alcohol/rounds/           # 4 pass (plain test)
bun run e2e tests/e2e/repro/                  # 10 pass (plain test)
bunx tsc --noEmit
bunx biome check .
```

Si tout est vert, les bugs sont fixés + les tests de repro deviennent tests de régression permanents.

**Commit**
```
test(alcohol): flip repro tests to permanent regression coverage

Remove test.fail / test.failing markers now that the underlying bugs
are fixed, and strengthen each assertion with one extra check so the
test continues to guard against subtle drift (drink alerts, overlay
cleanup, queue ordering, usedByCourage set membership).
```

---

## Étape 12 — Checklist finale + infra

Avant merge :

- [ ] Les 14 tests passent en mode nominal (plus de `test.fail` / `test.failing`)
- [ ] `bunx tsc --noEmit` propre
- [ ] `bunx biome check .` propre
- [ ] Commit du fix infra playwright (override `CLERK_SECRET_KEY` + `STRAPI_URL`) et du fix des placeholders accent ("Votre réponse...") déjà appliqués précédemment — soit dans un commit séparé en début de branche, soit en pré-requis. **Décision** : les intégrer au **commit 1** (étape 1) avec un message séparé, pour que les tests existants aient aussi un env sain.

**Commit infra (optionnel, avant l'étape 1)**
```
test(e2e): unblock local runs and fix accent-sensitive placeholder

- playwright.config: inject CLERK_SECRET_KEY="" and STRAPI_URL pointing
  to localhost so the WS auth falls back to ?testUser= and the
  server-side fetch hits the in-process mock Strapi.
- fixtures / multi-fixtures: match the actual placeholder
  "Votre réponse..." (accent) so answerViaUI detects texte questions.
```

---

## Estimation temps

| Étape | Type | Durée agent | Parallélisable avec |
|-------|------|-------------|---------------------|
| Pré-flight | Manuel | 5 min | — |
| 1 | Serial (types + store) | 20 min | — |
| 2 | Serial (store + 2 components) | 25 min | — |
| 3 | Isolé | 10 min | 6, 7, 8, 9, 10 |
| 4 | Serial (types + framework + round + engine) | 30 min | — |
| 5 | Isolé | 15 min | 3, 6, 7, 8, 9, 10 |
| 6 | Isolé | 10 min | 3, 5, 7, 8, 9, 10 |
| 7 | Isolé | 5 min | 3, 5, 6, 8, 9, 10 |
| 8 | Isolé | 5 min | 3, 5, 6, 7, 9, 10 |
| 9 | Isolé | 10 min | 3, 5, 6, 7, 8, 10 |
| 10 | Isolé | 15 min | 3, 5, 6, 7, 8, 9 |
| 11 | Serial | 30 min | — |
| 12 | Manuel | 15 min | — |

**Total serial** : ~3 h
**Avec parallélisation** (étapes 3, 5, 6, 7, 8, 9, 10 en 2 vagues d'agents) : ~1 h 45 min

---

## Ordre d'exécution recommandé

**Vague 1 (serial — fix fondateurs)**
- Pré-flight
- Étape 1 (types + handlers)
- Étape 2 (DrinkAlert queue)
- Étape 4 (courage usedByCourage)

**Vague 2 (7 agents en parallèle)**
- Étape 3 (framework delay)
- Étape 5 (conseil solo guard)
- Étape 6 (courage countdown)
- Étape 7 (LoveOrDrink aggregate)
- Étape 8 (cupidon Fisher-Yates)
- Étape 9 (smatch random)
- Étape 10 (distributeur rotation)

Chaque agent : reçoit son extrait de design + son repro, applique le patch, lance le repro isolé, confirme le flip, commit. Zéro overlap de fichiers.

**Vague 3 (serial)**
- Étape 11 (retirer les markers + renforcer assertions)
- Étape 12 (checklist + CI propre)

---

## Rollback strategy

Chaque fix a son commit dédié. Si un fix introduit une régression :
1. `git revert <commit>` — reverse le fix
2. Le repro correspondant repasse en `test.fail` (si step 11 pas encore fait) ou FAIL rouge (si step 11 fait).
3. Les autres fix restent en place.

Pour l'étape 11 (flip markers) : le revert doit réinstaller les markers. Garder un snapshot de la diff en main.
