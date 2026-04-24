# Drink alerts personnalisés & roue de la fortune (Conseil) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer deux changements liés en une seule itération : (A) rendre les drink alerts personnalisés ("C'est pour toi !" vs "C'est pour {nom} !") en les rendant génériques sur l'action à faire, et (B) remplacer le "tous ex æquo boivent" du Conseil par une roue de la fortune qui tire un seul perdant.

**Architecture:** Payload `drink_alert` refactoré en `{ targetClerkIds[], emoji, action, details? }` — le client formate selon `myClerkId ∈ targetClerkIds`. Conseil gagne une phase serveur `tiebreaker` qui pick `selectedClerkId` via `shuffleArray` et broadcast `conseil_tiebreaker` ; le client anime une roue SVG déterministe qui converge sur le pick serveur. TDD partout, commit fréquent, specs Playwright via nightwatch + unit tests bun pour la logique pure.

**Tech Stack:** Bun 1.x, React 19, Zustand, WebSockets (Bun.serve), Playwright, Tailwind v4, SVG natif. Pas de nouvelle dépendance.

**Spec source :** `docs/superpowers/specs/2026-04-24-drink-alerts-and-conseil-tiebreaker-design.md`

---

## File Structure

**Nouveaux fichiers :**
- `apps/client/src/shared/format.ts` — helpers `joinNames`, `capitalize` partagés serveur/client
- `apps/client/src/components/alcohol/rounds/ConseilWheel.tsx` — composant roue SVG
- `apps/client/src/server/alcohol/framework.test.ts` — tests unitaires `broadcastDrinkAlert`
- `apps/client/src/server/alcohol/rounds/conseil.test.ts` — tests unitaires tiebreaker
- `apps/client/tests/e2e/regression/multi-repro-conseil-tie-wheel.spec.ts` — E2E 3 joueurs
- `apps/client/tests/e2e/regression/drink-alert-personalization.spec.ts` — E2E self vs others
- `apps/client/.discovery/scenarios/conseil-tie-wheel.md` — scenario nightwatch (remplace l'ancien)
- `apps/client/.discovery/scenarios/drink-alert-personalization.md` — scenario nightwatch

**Fichiers modifiés :**
- `apps/client/src/shared/types.ts` — payload `drink_alert` + nouveau `conseil_tiebreaker`
- `apps/client/src/server/alcohol/framework.ts` — signature `broadcastDrinkAlert`, Cupidon, `handleCulSecEndGame`
- `apps/client/src/server/alcohol/types.ts` — état serveur étendu (pas nécessaire — conseilState est local au fichier conseil.ts)
- `apps/client/src/server/alcohol/rounds/conseil.ts` — phases + tiebreaker + finalizeConseil
- `apps/client/src/server/alcohol/rounds/petit-buveur.ts` — remplace émission locale par `broadcastDrinkAlert`, supprime `joinNames` local
- `apps/client/src/server/alcohol/rounds/courage.ts` — 3 call sites migrés
- `apps/client/src/server/alcohol/rounds/distributeur.ts` — 1 call site migré
- `apps/client/src/server/alcohol/rounds/show-us.ts` — 1 call site migré
- `apps/client/src/server/alcohol/rounds/love-or-drink.ts` — 2 call sites migrés
- `apps/client/src/stores/alcoholStore.ts` — `DrinkAlertData` shape
- `apps/client/src/stores/roomStore.ts:~301` — migration `addDrinkAlert` en réception WS
- `apps/client/src/stores/gameStore.ts:~456,493` — migration appels solo
- `apps/client/src/components/alcohol/DrinkAlert.tsx` — nouvelle signature + rendu
- `apps/client/src/components/EndScreen.tsx:~115-120` — props
- `apps/client/src/components/MultiEndScreen.tsx:~114-119` — props
- `apps/client/src/components/GameScreen.tsx:~240-245` — props
- `apps/client/src/components/MultiGameScreen.tsx` — props (même pattern)
- `apps/client/src/components/alcohol/rounds/Conseil.tsx` — phases reveal/spin + intégration roue + fallback 2 s
- `apps/client/tests/helpers/multi-fixtures.ts` — support 3e joueur
- `apps/client/.discovery/scenarios/_index.md` — index
- `apps/client/.discovery/map/multi-game.md` — documenter les nouveaux overlays

**Fichiers supprimés :**
- `apps/client/.discovery/scenarios/conseil-tie-all-losers-drink.md` — remplacé par `conseil-tie-wheel.md`

---

## Commandes de référence

**Tests unitaires (serveur, logique pure) :**
```bash
cd apps/client
bun test src/server/alcohol/rounds/conseil.test.ts
bun test src/server/alcohol/framework.test.ts
bun test src/server/alcohol                 # suite complète alcohol
```

**Type-check :**
```bash
cd apps/client && bun run check-types
```

**E2E (specific) :**
```bash
cd apps/client
bunx playwright test tests/e2e/regression/multi-repro-conseil-tie-wheel.spec.ts
bunx playwright test tests/e2e/regression/drink-alert-personalization.spec.ts
```

**Biome :**
```bash
cd apps/client && bunx biome check --no-errors-on-unmatched
```

Lefthook pre-commit (`lefthook.yml`) exécute `check-types + test + e2e + biome` — prévoir ~4 min par commit.

---

## Task 1 : Helper `shared/format.ts` (joinNames + capitalize)

**Files:**
- Create: `apps/client/src/shared/format.ts`
- Modify: `apps/client/src/server/alcohol/rounds/petit-buveur.ts:6-9` (supprime la version locale)

- [ ] **Step 1 : Créer le helper partagé**

```ts
// apps/client/src/shared/format.ts

/**
 * Join names with commas and a final "et" — "Alice", "Alice et Bob", "Alice, Bob et Carol".
 * Originally local to petit-buveur.ts ; now shared so the client can format the same way
 * as the server when rendering personalized drink alerts.
 */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

/**
 * Capitalize the first character. Used to render `action` strings as standalone
 * lines ("Boire une gorgée") while keeping them lowercase in code.
 */
export function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}
```

- [ ] **Step 2 : Supprimer la duplication dans `petit-buveur.ts`**

Ouvrir `apps/client/src/server/alcohol/rounds/petit-buveur.ts` et remplacer les lignes 6-9 (définition locale de `joinNames`) par un import :

```ts
import { joinNames } from "../../../shared/format";
```

Le reste du fichier est inchangé à ce stade — `petit-buveur.ts` sera refactoré au Task 6.

- [ ] **Step 3 : Vérifier**

```bash
cd apps/client && bun run check-types
bun test src/server/alcohol/rounds/petit-buveur.test.ts
```

Attendu : type-check OK, tests existants passent.

- [ ] **Step 4 : Commit**

```bash
git add apps/client/src/shared/format.ts apps/client/src/server/alcohol/rounds/petit-buveur.ts
git commit -m "refactor(alcohol): extract joinNames to shared/format"
```

---

## Task 2 : Étendre les types WS (`shared/types.ts`)

**Files:**
- Modify: `apps/client/src/shared/types.ts:105-111` — refonte du payload `drink_alert`
- Modify: `apps/client/src/shared/types.ts` — ajout du message `conseil_tiebreaker`

- [ ] **Step 1 : Remplacer la variante `drink_alert`**

Localiser le bloc entre les lignes 105-111 :

```ts
  | {
      type: "drink_alert";
      targetClerkId: string;
      emoji: string;
      message: string;
      details?: DrinkAlertDetails;
    }
```

Le remplacer par :

```ts
  | {
      type: "drink_alert";
      targetClerkIds: string[];  // qui doit agir (1..N) — client formate self vs others
      emoji: string;
      action: string;            // "boire une gorgée", "faire un cul-sec", "boire 3 gorgées"
      details?: DrinkAlertDetails;
    }
```

- [ ] **Step 2 : Ajouter la variante `conseil_tiebreaker`**

Toujours dans `apps/client/src/shared/types.ts`, ajouter une nouvelle variante à l'union `ServerMessage` (insérer juste après `conseil_result`) :

```ts
  | {
      type: "conseil_tiebreaker";
      tiedClerkIds: string[];       // 2..N — les ex æquo, ordre stable
      selectedClerkId: string;      // perdant tiré par shuffleArray côté serveur
      spinDurationMs: number;       // ex. 4000
    }
```

- [ ] **Step 3 : Vérifier — le type-check doit CASSER**

```bash
cd apps/client && bun run check-types
```

Attendu : erreurs à tous les call sites qui utilisaient `targetClerkId` (singular) et `message`. C'est voulu — ces erreurs guident la migration des tasks suivantes. **Ne pas commit tout de suite.**

- [ ] **Step 4 : Noter les call sites cassés**

Lister mentalement les fichiers signalés par `tsc` — ils seront tous corrigés dans les Tasks 3-11. On commit ces changements à la fin de Task 11 (green globalement).

---

## Task 3 : Refactor `broadcastDrinkAlert` (framework.ts + tests)

**Files:**
- Create: `apps/client/src/server/alcohol/framework.test.ts`
- Modify: `apps/client/src/server/alcohol/framework.ts:61-89` — signature + Cupidon propagation

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `apps/client/src/server/alcohol/framework.test.ts` (modèle calqué sur `rounds/cupidon.test.ts` pour la room factice) :

```ts
import { beforeEach, describe, expect, test } from "bun:test";
import { broadcastDrinkAlert } from "./framework";
import type { AlcoholState } from "./types";
import type { Room, ServerMessage } from "../types";

function makeRoom(): {
  room: Room;
  sent: ServerMessage[];
} {
  const sent: ServerMessage[] = [];
  const players = new Map();
  players.set("alice", { clerkId: "alice", username: "Alice", connected: true, ws: null });
  players.set("bob", { clerkId: "bob", username: "Bob", connected: true, ws: null });
  players.set("carol", { clerkId: "carol", username: "Carol", connected: true, ws: null });
  // biome-ignore lint/suspicious/noExplicitAny: test room stub
  const room = {
    code: "TEST",
    players,
    broadcast: (msg: ServerMessage) => sent.push(msg),
    game: { alcoholState: { cupidLinks: [] as [string, string][] } as AlcoholState },
  } as any as Room;
  return { room, sent };
}

describe("broadcastDrinkAlert", () => {
  test("emits a single drink_alert with new payload shape", () => {
    const { room, sent } = makeRoom();
    broadcastDrinkAlert(room, ["alice"], "🗳️", "boire une gorgée");
    const alerts = sent.filter((m) => m.type === "drink_alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: "drink_alert",
      targetClerkIds: ["alice"],
      emoji: "🗳️",
      action: "boire une gorgée",
    });
  });

  test("accepts multiple targets in a single alert", () => {
    const { room, sent } = makeRoom();
    broadcastDrinkAlert(room, ["alice", "bob"], "🍺", "boire une gorgée");
    const alerts = sent.filter((m) => m.type === "drink_alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].targetClerkIds).toEqual(["alice", "bob"]);
  });

  test("Cupidon propagation emits a second alert for the linked partner", () => {
    const { room, sent } = makeRoom();
    (room.game as any).alcoholState.cupidLinks = [["alice", "carol"]];
    broadcastDrinkAlert(room, ["alice"], "🗳️", "boire une gorgée");
    const alerts = sent.filter((m) => m.type === "drink_alert");
    expect(alerts).toHaveLength(2);
    expect(alerts[0].targetClerkIds).toEqual(["alice"]);
    expect(alerts[1].targetClerkIds).toEqual(["carol"]);
    expect(alerts[1].emoji).toBe("💘");
    expect(alerts[1].action).toContain("lié au cœur");
  });

  test("Cupidon does not double-fire when both ends are already in targetClerkIds", () => {
    const { room, sent } = makeRoom();
    (room.game as any).alcoholState.cupidLinks = [["alice", "bob"]];
    broadcastDrinkAlert(room, ["alice", "bob"], "🍺", "boire");
    const alerts = sent.filter((m) => m.type === "drink_alert");
    expect(alerts).toHaveLength(1);
  });
});
```

- [ ] **Step 2 : Lancer les tests — ils doivent échouer**

```bash
cd apps/client && bun test src/server/alcohol/framework.test.ts
```

Attendu : erreurs à la compilation ou échec sur la forme du payload.

- [ ] **Step 3 : Refactor `broadcastDrinkAlert`**

Ouvrir `apps/client/src/server/alcohol/framework.ts` et remplacer les lignes 61-89 par :

```ts
export function broadcastDrinkAlert(
  room: Room,
  targetClerkIds: string[],
  emoji: string,
  action: string,
  details?: DrinkAlertDetails,
): void {
  broadcast(room, {
    type: "drink_alert",
    targetClerkIds,
    emoji,
    action,
    details,
  });
  // Cupidon propagation — pour chaque cible qui a un partenaire lié,
  // envoyer une alerte dédiée au partenaire (sauf s'il est déjà dans targetClerkIds).
  const links = room.game?.alcoholState?.cupidLinks ?? [];
  const alreadyTargeted = new Set(targetClerkIds);
  const cupidonPartners = new Set<string>();
  for (const targetId of targetClerkIds) {
    for (const [a, b] of links) {
      if (a === targetId || b === targetId) {
        const partner = a === targetId ? b : a;
        if (!alreadyTargeted.has(partner) && !cupidonPartners.has(partner)) {
          cupidonPartners.add(partner);
        }
      }
    }
  }
  for (const partner of cupidonPartners) {
    broadcast(room, {
      type: "drink_alert",
      targetClerkIds: [partner],
      emoji: "💘",
      action: "boire — lié au cœur",
    });
  }
}
```

- [ ] **Step 4 : Migrer `handleCulSecEndGame` dans le même fichier**

Toujours dans `framework.ts`, localiser `handleCulSecEndGame` (lignes ~162-182) et remplacer la boucle `for (const loserClerkId of losers)` :

```ts
  for (const loserClerkId of losers) {
    broadcastDrinkAlert(
      room,
      loserClerkId,
      "🥃",
      "Cul-sec ! Tu as le score le plus bas !",
    );
  }
```

par une seule alerte agrégée (on passe d'un broadcast par loser à un broadcast groupé) :

```ts
  if (losers.length > 0) {
    broadcastDrinkAlert(
      room,
      losers,
      "🥃",
      "faire cul-sec — score le plus bas",
    );
  }
```

- [ ] **Step 5 : Lancer les tests — doivent passer**

```bash
cd apps/client && bun test src/server/alcohol/framework.test.ts
```

Attendu : 4/4 PASS.

- [ ] **Step 6 : Pas encore de commit.** Le reste de la codebase est cassé au type-check — on commit à la fin de Task 11.

---

## Task 4 : Migrer les call sites server (rounds)

**Files:**
- Modify: `apps/client/src/server/alcohol/rounds/petit-buveur.ts:44-54`
- Modify: `apps/client/src/server/alcohol/rounds/courage.ts:61-66,89-94,137-147`
- Modify: `apps/client/src/server/alcohol/rounds/distributeur.ts:69-74`
- Modify: `apps/client/src/server/alcohol/rounds/show-us.ts:110-115`
- Modify: `apps/client/src/server/alcohol/rounds/love-or-drink.ts:48-55,92-99` (+ branche suivante identique)

Chaque call site remplace `targetClerkId: string` par `targetClerkIds: string[]` et `message` pré-formaté par une `action` en verbe libre.

- [ ] **Step 1 : `petit-buveur.ts`**

Remplacer les lignes 41-54 (agrégation names + verb + broadcast inline direct) :

```ts
    const names = joinNames([...drinkers.values()]);
    const verb = drinkers.size > 1 ? "boivent" : "boit";

    broadcast(room, {
      type: "special_round_start",
      roundType: "petit_buveur",
      data: { losers },
    });
    broadcast(room, {
      type: "drink_alert",
      targetClerkId: losers[0]?.clerkId ?? "",
      emoji: "🍺",
      message: `${names} ${verb} une gorgée !`,
    });
```

par un `broadcastDrinkAlert` standard (plus de broadcast WS inline) :

```ts
    broadcast(room, {
      type: "special_round_start",
      roundType: "petit_buveur",
      data: { losers },
    });
    broadcastDrinkAlert(
      room,
      [...drinkers.keys()],
      "🍺",
      "boire une gorgée",
    );
```

Ajouter l'import en haut du fichier (si absent) :
```ts
import { broadcastDrinkAlert, endSpecialRound } from "../framework";
```

Note : on peut désormais supprimer la variable locale `names` et `verb`. Le helper `joinNames` importé reste utile nulle part dans ce fichier — supprimer aussi `import { joinNames } from "../../../shared/format";` s'il est devenu orphelin.

- [ ] **Step 2 : `courage.ts` (3 call sites)**

Ligne ~61-66 (timeout de décision) :
```ts
      broadcastDrinkAlert(
        room,
        playerClerkId,
        "🥃",
        `${player?.username ?? "?"} n'a pas choisi — la moitié du verre !`,
      );
```
devient :
```ts
      broadcastDrinkAlert(
        room,
        [playerClerkId],
        "🥃",
        "boire la moitié du verre — pas de choix",
      );
```

Ligne ~89-94 (refus) :
```ts
        broadcastDrinkAlert(
          room,
          clerkId,
          "🥃",
          `${player?.username ?? "?"} refuse — la moitié du verre !`,
        );
```
devient :
```ts
        broadcastDrinkAlert(
          room,
          [clerkId],
          "🥃",
          "boire la moitié du verre — refus",
        );
```

Ligne ~137-147 (mauvaise réponse) :
```ts
        broadcastDrinkAlert(
          room,
          clerkId,
          "🍻",
          `${player?.username ?? "?"} se trompe — CUL SEC !`,
          { kind: "courage", givenAnswer: String(answer), correctAnswer: String(cs.question.answer) },
        );
```
devient :
```ts
        broadcastDrinkAlert(
          room,
          [clerkId],
          "🍻",
          "faire cul-sec — mauvaise réponse",
          { kind: "courage", givenAnswer: String(answer), correctAnswer: String(cs.question.answer) },
        );
```

- [ ] **Step 3 : `distributeur.ts`**

Lignes 69-74 :
```ts
    broadcastDrinkAlert(
      room,
      targetClerkId,
      "🍺",
      `${distributor?.username ?? "?"} t'envoie une gorgée !`,
    );
```
devient :
```ts
    broadcastDrinkAlert(
      room,
      [targetClerkId],
      "🍺",
      `boire — envoyé par ${distributor?.username ?? "?"}`,
    );
```

Note : on garde le nom du distributeur dans l'action parce que c'est la _seule_ info contextuelle (sans ça, le perdant ne sait pas qui lui a envoyé). C'est acceptable — `action` est libre, pas un enum.

- [ ] **Step 4 : `show-us.ts`**

Ligne 110-115 :
```ts
          broadcastDrinkAlert(
            room,
            voterId,
            "🍺",
            `${voter?.username ?? "?"} s'est planté — boit une gorgée !`,
          );
```
devient :
```ts
          broadcastDrinkAlert(
            room,
            [voterId],
            "🍺",
            "boire une gorgée — mauvais vote",
          );
```

- [ ] **Step 5 : `love-or-drink.ts` (2 call sites)**

Les 2 occurrences sont identiques — une dans le timeout (ligne ~48-55) et une dans le handler `cul_sec` (ligne ~92-99). Dans chaque boucle `for (const player of …)`, remplacer la boucle par un broadcast agrégé :

```ts
      for (const player of bottom2) {
        broadcastDrinkAlert(
          room,
          player.clerkId,
          "🍺",
          `${player.username} boit — cul sec !`,
        );
      }
```
devient :
```ts
      broadcastDrinkAlert(
        room,
        bottom2.map((p) => p.clerkId),
        "🍺",
        "faire cul-sec — Love or Drink",
      );
```

(Idem pour la branche de l'handler — remplacer `ls.players` au lieu de `bottom2`.)

- [ ] **Step 6 : Type-check**

```bash
cd apps/client && bun run check-types
```

Attendu : plus d'erreurs du côté server/. Reste à migrer le client (Tasks 5-10).

- [ ] **Step 7 : Unit tests serveur**

```bash
cd apps/client && bun test src/server/alcohol
```

Attendu : les tests existants (`petit-buveur.test.ts`, `courage.test.ts`, etc.) doivent être mis à jour pour refléter la nouvelle forme du payload si ils assertent sur `message`/`targetClerkId`. **Les corriger dans ce même step avant de continuer** — quand un test échoue sur le shape, le mettre à jour pour asserter `targetClerkIds` et `action` (pas de nouvelle logique, juste nouveau nom de champ). Commit distinct possible pour ce fix de tests s'il y a du volume.

---

## Task 5 : Migrer le store + consumers (`alcoholStore`, `roomStore`, `gameStore`)

**Files:**
- Modify: `apps/client/src/stores/alcoholStore.ts:21-26` (DrinkAlertData shape)
- Modify: `apps/client/src/stores/roomStore.ts:~301`
- Modify: `apps/client/src/stores/gameStore.ts:~456,493`

- [ ] **Step 1 : Refactor `DrinkAlertData` dans `alcoholStore.ts`**

Lignes 21-26 :
```ts
export interface DrinkAlertData {
  id: string;
  emoji: string;
  message: string;
  details?: DrinkAlertDetails;
}
```
deviennent :
```ts
export interface DrinkAlertData {
  id: string;
  targetClerkIds: string[];
  emoji: string;
  action: string;
  details?: DrinkAlertDetails;
}
```

Le reste du store (`addDrinkAlert`, `dismissCurrentDrinkAlert`) est inchangé — `spread` et `id` fonctionnent identiquement.

- [ ] **Step 2 : Migrer `roomStore.ts`**

Localiser la ligne ~301 (`useAlcoholStore.getState().addDrinkAlert({...})` dans le handler `drink_alert`). Le payload reçu du serveur a déjà la nouvelle forme (après Tasks 2-4) — juste le passer directement :

```ts
        case "drink_alert": {
          useAlcoholStore.getState().addDrinkAlert({
            targetClerkIds: msg.targetClerkIds,
            emoji: msg.emoji,
            action: msg.action,
            details: msg.details,
          });
          break;
        }
```

- [ ] **Step 3 : Migrer `gameStore.ts` (2 call sites solo)**

Les 2 appels `addDrinkAlert` en ligne ~456 et ~493 (cul-sec solo et autres chemins solo) ont actuellement `{ emoji, message, details? }`. Les remplacer par :

```ts
            alcoholStore.addDrinkAlert({
              targetClerkIds: [],   // solo : personne n'est "moi", tout est observateur
              emoji: "...",
              action: "...",         // extraire le verbe du message actuel
              details: ...,
            });
```

Pour chaque appel, lire le `message` actuel et extraire l'action (en verbe libre) — la logique miroir de Task 4. L'emoji reste inchangé.

**Important** : en solo, `targetClerkIds: []` signifie "personne n'est moi" → le client affichera toujours en mode observateur ("C'est pour {name} !"). C'est le comportement voulu pour le solo (cf. spec section "Mode solo").

- [ ] **Step 4 : Type-check**

```bash
cd apps/client && bun run check-types
```

Attendu : erreurs restantes uniquement dans `DrinkAlert.tsx` et consumers (Task 6-7).

---

## Task 6 : Refactor `DrinkAlert.tsx` (nouveau rendu perso)

**Files:**
- Modify: `apps/client/src/components/alcohol/DrinkAlert.tsx`

- [ ] **Step 1 : Refactor complet du composant**

Remplacer le contenu de `apps/client/src/components/alcohol/DrinkAlert.tsx` par :

```tsx
import { useEffect, useMemo } from "react";
import type { DrinkAlertDetails as Details } from "../../shared/types";
import { capitalize, joinNames } from "../../shared/format";
import { usePlayerStore } from "../../stores/playerStore";
import { useRoomStore } from "../../stores/roomStore";
import { DrinkAlertDetails } from "./drink-alert-details";

interface DrinkAlertProps {
  targetClerkIds: string[];
  emoji: string;
  action: string;
  details?: Details;
  onClose: () => void;
  duration?: number;
}

export function DrinkAlert({
  targetClerkIds,
  emoji,
  action,
  details,
  onClose,
  duration = 4000,
}: DrinkAlertProps) {
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const room = useRoomStore((s) => s.room);
  const soloPlayers = usePlayerStore((s) => s.players);

  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const { verdict, othersLine } = useMemo(() => {
    const resolveName = (clerkId: string): string => {
      const multi = room?.players.find((p) => p.clerkId === clerkId);
      if (multi) return multi.username;
      const solo = soloPlayers.find((p) => p.name === clerkId);
      return solo?.name ?? clerkId;
    };
    const names = targetClerkIds.map(resolveName);
    const isMe =
      myClerkId !== null && targetClerkIds.includes(myClerkId);
    if (isMe) {
      const othersNames = targetClerkIds
        .filter((id) => id !== myClerkId)
        .map(resolveName);
      return {
        verdict: "C'est pour toi !",
        othersLine: othersNames.length > 0 ? `(+ ${joinNames(othersNames)})` : null,
      };
    }
    return {
      verdict: names.length > 0 ? `C'est pour ${joinNames(names)} !` : "",
      othersLine: null,
    };
  }, [targetClerkIds, myClerkId, room, soloPlayers]);

  return (
    <button
      type="button"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer w-full border-none p-0"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="text-center animate-bounce-in px-6">
        <span className="text-8xl block mb-6">{emoji}</span>
        <p className="text-2xl font-bold text-white max-w-sm mx-auto">
          {verdict}
        </p>
        <p className="text-lg text-amber-400 font-semibold mt-2 max-w-sm mx-auto">
          {capitalize(action)}
        </p>
        {othersLine && (
          <p className="text-sm text-white/60 mt-1">{othersLine}</p>
        )}
        {details && <DrinkAlertDetails details={details} />}
      </div>
    </button>
  );
}
```

- [ ] **Step 2 : Type-check**

```bash
cd apps/client && bun run check-types
```

Attendu : erreurs uniquement chez les consumers du composant (EndScreen, MultiEndScreen, GameScreen, MultiGameScreen).

---

## Task 7 : Migrer consumers `<DrinkAlert>`

**Files:**
- Modify: `apps/client/src/components/EndScreen.tsx:~115-120`
- Modify: `apps/client/src/components/MultiEndScreen.tsx:~114-119`
- Modify: `apps/client/src/components/GameScreen.tsx:~240-245`
- Modify: `apps/client/src/components/MultiGameScreen.tsx` (même pattern, localiser le `<DrinkAlert>`)

- [ ] **Step 1 : Remplacer les 4 sites**

Pour chacun des 4 fichiers, le `<DrinkAlert>` actuel est de la forme :

```tsx
{currentDrinkAlert && (
  <DrinkAlert
    key={currentDrinkAlert.id}
    emoji={currentDrinkAlert.emoji}
    message={currentDrinkAlert.message}
    details={currentDrinkAlert.details}
    onClose={...}
  />
)}
```

Le passer à :

```tsx
{currentDrinkAlert && (
  <DrinkAlert
    key={currentDrinkAlert.id}
    targetClerkIds={currentDrinkAlert.targetClerkIds}
    emoji={currentDrinkAlert.emoji}
    action={currentDrinkAlert.action}
    details={currentDrinkAlert.details}
    onClose={...}
  />
)}
```

(Pas de ligne `message` — elle est remplacée par `targetClerkIds` + `action`.)

- [ ] **Step 2 : Type-check**

```bash
cd apps/client && bun run check-types
```

Attendu : 0 erreur. Le client + serveur compilent ensemble.

- [ ] **Step 3 : Tests unitaires complets**

```bash
cd apps/client && bun test
```

Attendu : toutes les suites passent (`alcohol/rounds/*.test.ts`, `framework.test.ts`, etc.). Si un test existant casse à cause du champ `message` → le mettre à jour pour asserter sur `action`.

- [ ] **Step 4 : Premier commit de la Part A**

```bash
git add apps/client/src/shared/types.ts \
        apps/client/src/server/alcohol/framework.ts \
        apps/client/src/server/alcohol/framework.test.ts \
        apps/client/src/server/alcohol/rounds/petit-buveur.ts \
        apps/client/src/server/alcohol/rounds/courage.ts \
        apps/client/src/server/alcohol/rounds/distributeur.ts \
        apps/client/src/server/alcohol/rounds/show-us.ts \
        apps/client/src/server/alcohol/rounds/love-or-drink.ts \
        apps/client/src/stores/alcoholStore.ts \
        apps/client/src/stores/roomStore.ts \
        apps/client/src/stores/gameStore.ts \
        apps/client/src/components/alcohol/DrinkAlert.tsx \
        apps/client/src/components/EndScreen.tsx \
        apps/client/src/components/MultiEndScreen.tsx \
        apps/client/src/components/GameScreen.tsx \
        apps/client/src/components/MultiGameScreen.tsx \
        apps/client/src/server/alcohol/rounds/*.test.ts
git commit -m "feat(alcohol): personalize drink alerts (Part A)

- drink_alert payload becomes { targetClerkIds[], action } so each
  client renders 'C'est pour toi !' vs 'C'est pour {name} !' based
  on myClerkId membership
- Cupidon propagation emits a dedicated second alert
- 10 call sites migrated (petit-buveur agrégé en 1 alerte, cul-sec
  end-game idem)"
```

---

## Task 8 : Conseil — tests unitaires tiebreaker (TDD)

**Files:**
- Create: `apps/client/src/server/alcohol/rounds/conseil.test.ts`

- [ ] **Step 1 : Écrire les tests (qui vont échouer pour l'instant)**

Créer `apps/client/src/server/alcohol/rounds/conseil.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { conseilRound } from "./conseil";
import type { AlcoholState } from "../types";
import type { Room, ServerMessage } from "../../types";

function makeRoom(playerIds: string[]): { room: Room; sent: ServerMessage[] } {
  const sent: ServerMessage[] = [];
  const players = new Map();
  for (const id of playerIds) {
    players.set(id, { clerkId: id, username: id, connected: true, ws: null });
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  const room = {
    code: `TEST-${Math.random().toString(36).slice(2)}`,
    players,
    broadcast: (msg: ServerMessage) => sent.push(msg),
    game: { alcoholState: { cupidLinks: [] as [string, string][] } as AlcoholState },
  } as any as Room;
  return { room, sent };
}

function typesOf(sent: ServerMessage[]): string[] {
  return sent.map((m) => m.type);
}

describe("conseilRound", () => {
  let randomSpy: ReturnType<typeof mock>;
  beforeEach(() => {
    randomSpy = mock(Math.random);
    globalThis.Math.random = () => 0; // shuffleArray(arr) → [arr[0], ...]
  });
  afterEach(() => {
    globalThis.Math.random = randomSpy.getMockImplementation() ?? Math.random;
  });

  test("mono-loser: emits conseil_result + drink_alert, no tiebreaker", () => {
    const { room, sent } = makeRoom(["alice", "bob", "carol"]);
    conseilRound.start(room, {} as AlcoholState);
    conseilRound.handleMessage(room, {} as AlcoholState, "alice", {
      type: "conseil_vote",
      targetClerkId: "bob",
    });
    conseilRound.handleMessage(room, {} as AlcoholState, "bob", {
      type: "conseil_vote",
      targetClerkId: "carol",
    });
    conseilRound.handleMessage(room, {} as AlcoholState, "carol", {
      type: "conseil_vote",
      targetClerkId: "bob",
    });
    expect(typesOf(sent)).toContain("conseil_result");
    expect(typesOf(sent)).not.toContain("conseil_tiebreaker");
    const drink = sent.find((m) => m.type === "drink_alert") as any;
    expect(drink.targetClerkIds).toEqual(["bob"]);
  });

  test("3-way tie: emits conseil_tiebreaker with selectedClerkId in tiedClerkIds", () => {
    const { room, sent } = makeRoom(["alice", "bob", "carol"]);
    conseilRound.start(room, {} as AlcoholState);
    conseilRound.handleMessage(room, {} as AlcoholState, "alice", {
      type: "conseil_vote",
      targetClerkId: "bob",
    });
    conseilRound.handleMessage(room, {} as AlcoholState, "bob", {
      type: "conseil_vote",
      targetClerkId: "carol",
    });
    conseilRound.handleMessage(room, {} as AlcoholState, "carol", {
      type: "conseil_vote",
      targetClerkId: "alice",
    });
    const tieMsg = sent.find((m) => m.type === "conseil_tiebreaker") as any;
    expect(tieMsg).toBeDefined();
    expect(tieMsg.tiedClerkIds).toHaveLength(3);
    expect(tieMsg.tiedClerkIds).toContain(tieMsg.selectedClerkId);
    expect(tieMsg.spinDurationMs).toBe(4000);
  });

  test("2-way tie: same tiebreaker path with 2 tied ids", () => {
    const { room, sent } = makeRoom(["alice", "bob", "carol", "dave"]);
    conseilRound.start(room, {} as AlcoholState);
    conseilRound.handleMessage(room, {} as AlcoholState, "alice", { type: "conseil_vote", targetClerkId: "bob" });
    conseilRound.handleMessage(room, {} as AlcoholState, "bob", { type: "conseil_vote", targetClerkId: "alice" });
    conseilRound.handleMessage(room, {} as AlcoholState, "carol", { type: "conseil_vote", targetClerkId: "alice" });
    conseilRound.handleMessage(room, {} as AlcoholState, "dave", { type: "conseil_vote", targetClerkId: "bob" });
    const tieMsg = sent.find((m) => m.type === "conseil_tiebreaker") as any;
    expect(tieMsg.tiedClerkIds.sort()).toEqual(["alice", "bob"]);
  });

  test("0 votes (start + no messages): no tiebreaker, no drink_alert", async () => {
    const { room, sent } = makeRoom(["alice", "bob"]);
    // On raccourcit le timeout de 30s pour le test — on invoque directement
    // `resolveVotes` via un handler factice, ou on se base sur Bun's fake timers.
    // Ici, on réutilise le flush en simulant un timeout interne :
    conseilRound.start(room, {} as AlcoholState);
    // On ne bouge pas — simulate that the 30s timeout has fired by calling
    // the internal resolveVotes. Comme `resolveVotes` n'est pas exporté, on passe
    // par un raccourci : mock `setTimeout` pour qu'il se déclenche synchro.
    // Implémentation : wrapper le test dans `Bun.sleep(0)` ou adopter
    // une variante où on exporte `resolveVotes` pour les tests.
    // Note d'impl : on exportera `_resolveVotesForTest` depuis conseil.ts
    // (cf. Task 9 Step 5).
  });

  test("vote after tiebreaker phase is silently rejected", () => {
    const { room, sent } = makeRoom(["alice", "bob", "carol"]);
    conseilRound.start(room, {} as AlcoholState);
    conseilRound.handleMessage(room, {} as AlcoholState, "alice", { type: "conseil_vote", targetClerkId: "bob" });
    conseilRound.handleMessage(room, {} as AlcoholState, "bob", { type: "conseil_vote", targetClerkId: "carol" });
    conseilRound.handleMessage(room, {} as AlcoholState, "carol", { type: "conseil_vote", targetClerkId: "alice" });
    // Tie achevé → tentative de vote supplémentaire
    const before = sent.length;
    conseilRound.handleMessage(room, {} as AlcoholState, "alice", { type: "conseil_vote", targetClerkId: "carol" });
    expect(sent.length).toBe(before); // no new broadcasts
  });
});
```

- [ ] **Step 2 : Lancer — doit échouer**

```bash
cd apps/client && bun test src/server/alcohol/rounds/conseil.test.ts
```

Attendu : le test "3-way tie" et "2-way tie" échouent (pas encore d'émission `conseil_tiebreaker`) ; "mono-loser" peut passer. C'est voulu.

---

## Task 9 : Conseil — refactor `resolveVotes` (tiebreaker)

**Files:**
- Modify: `apps/client/src/server/alcohol/rounds/conseil.ts`

- [ ] **Step 1 : Étendre le state local**

Au début de `conseil.ts`, remplacer :

```ts
const conseilState = new Map<
  string,
  { votes: Map<string, string>; timeoutId: ReturnType<typeof setTimeout> }
>();
```

par :

```ts
type ConseilState = {
  votes: Map<string, string>;
  timeoutId: ReturnType<typeof setTimeout>;
  phase: "vote" | "tiebreaker" | "done";
  tiebreakerTimeoutId?: ReturnType<typeof setTimeout>;
  tiedClerkIds?: string[];
  selectedClerkId?: string;
  spinStartedAt?: number;
};

const conseilState = new Map<string, ConseilState>();

const REVEAL_DURATION = 1500;
const SPIN_DURATION = 4000;
const SETTLE_DURATION = 800;
```

- [ ] **Step 2 : Initialiser `phase: "vote"`**

Dans `start`, là où on fait `conseilState.set(room.code, { votes: new Map(), timeoutId })`, ajouter `phase: "vote"` :

```ts
    conseilState.set(room.code, {
      votes: new Map(),
      timeoutId,
      phase: "vote",
    });
```

- [ ] **Step 3 : Refuser les votes en phase `tiebreaker` / `done`**

Dans `handleMessage`, juste après `const cs = conseilState.get(room.code); if (!cs) return;`, ajouter :

```ts
    if (cs.phase !== "vote") return;  // rejet silencieux en tiebreaker / done
```

- [ ] **Step 4 : Refactorer `resolveVotes`**

Remplacer la fonction `resolveVotes` (lignes 77-123) par :

```ts
function resolveVotes(room: Room): void {
  const cs = conseilState.get(room.code);
  if (!cs) {
    endSpecialRound(room);
    return;
  }

  // Count votes
  const voteCounts = new Map<string, number>();
  for (const targetId of cs.votes.values()) {
    voteCounts.set(targetId, (voteCounts.get(targetId) ?? 0) + 1);
  }
  const maxVotes = Math.max(0, ...voteCounts.values());
  const loserClerkIds =
    maxVotes > 0
      ? Array.from(voteCounts.entries())
          .filter(([, count]) => count === maxVotes)
          .map(([clerkId]) => clerkId)
      : [];

  const votesRecord: Record<string, string> = {};
  for (const [voter, target] of cs.votes.entries()) {
    votesRecord[voter] = target;
  }

  broadcast(room, {
    type: "conseil_result",
    votes: votesRecord,
    loserClerkIds,
  });

  if (loserClerkIds.length <= 1) {
    // Chemin mono-loser (ou 0 vote) — on finalise directement.
    finalizeConseil(room, loserClerkIds[0]);
    return;
  }

  // Chemin tiebreaker — roue de la fortune
  const selectedClerkId = shuffleArray(loserClerkIds)[0]!;
  cs.phase = "tiebreaker";
  cs.tiedClerkIds = loserClerkIds;
  cs.selectedClerkId = selectedClerkId;
  cs.spinStartedAt = Date.now();

  broadcast(room, {
    type: "conseil_tiebreaker",
    tiedClerkIds: loserClerkIds,
    selectedClerkId,
    spinDurationMs: SPIN_DURATION,
  });

  cs.tiebreakerTimeoutId = setTimeout(
    () => finalizeConseil(room, selectedClerkId),
    REVEAL_DURATION + SPIN_DURATION + SETTLE_DURATION,
  );
}

function finalizeConseil(room: Room, loserId: string | undefined): void {
  const cs = conseilState.get(room.code);
  if (cs) cs.phase = "done";
  conseilState.delete(room.code);

  if (loserId) {
    broadcastDrinkAlert(room, [loserId], "🗳️", "boire une gorgée");
  }

  setTimeout(() => endSpecialRound(room), 5000);
}
```

Ajouter l'import de `shuffleArray` en haut :
```ts
import { broadcastDrinkAlert, endSpecialRound, shuffleArray } from "../framework";
```

- [ ] **Step 5 : Exporter `_resolveVotesForTest` (test-only hook)**

À la fin de `conseil.ts`, ajouter :

```ts
// Test-only: expose resolveVotes so unit tests can simulate the 30s timeout
// without real timers. Consumers other than tests MUST NOT use this.
export const _resolveVotesForTest = resolveVotes;
```

Dans `conseil.test.ts`, remplacer le stub de test `test("0 votes...")` par une version qui utilise ce hook :

```ts
import { _resolveVotesForTest, conseilRound } from "./conseil";
// ...
test("0 votes (timeout path): no tiebreaker, no drink_alert", () => {
  const { room, sent } = makeRoom(["alice", "bob"]);
  conseilRound.start(room, {} as AlcoholState);
  _resolveVotesForTest(room);
  expect(typesOf(sent)).toContain("conseil_result");
  expect(typesOf(sent)).not.toContain("conseil_tiebreaker");
  expect(typesOf(sent)).not.toContain("drink_alert");
});
```

- [ ] **Step 6 : Lancer les tests — doivent passer**

```bash
cd apps/client && bun test src/server/alcohol/rounds/conseil.test.ts
```

Attendu : 5/5 PASS.

- [ ] **Step 7 : Commit**

```bash
git add apps/client/src/server/alcohol/rounds/conseil.ts \
        apps/client/src/server/alcohol/rounds/conseil.test.ts
git commit -m "feat(alcohol): add Conseil tiebreaker wheel (server)

- resolveVotes splits into mono-loser and tiebreaker paths
- tiebreaker picks selectedClerkId via shuffleArray (server-authoritative)
- broadcasts conseil_tiebreaker for clients to spin their wheel
- votes rejected once phase === 'tiebreaker'
- full unit coverage: mono, 2-tie, 3-tie, 0-vote, post-phase vote rejected"
```

---

## Task 10 : Composant `ConseilWheel`

**Files:**
- Create: `apps/client/src/components/alcohol/rounds/ConseilWheel.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// apps/client/src/components/alcohol/rounds/ConseilWheel.tsx
import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  tied: { clerkId: string; username: string }[];
  selectedClerkId: string;
  durationMs: number;
  onDone: () => void;
}

const PALETTE = [
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#059669",
  "#0284c7",
  "#db2777",
];
const ROTATIONS = 5;       // nombre de tours complets avant de s'arrêter
const SETTLE_MS = 800;     // pause après arrêt avant onDone

function polarToCart(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function sliceArcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const [x1, y1] = polarToCart(cx, cy, r, start);
  const [x2, y2] = polarToCart(cx, cy, r, end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

export function ConseilWheel({ tied, selectedClerkId, durationMs, onDone }: Props) {
  const [spinning, setSpinning] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { slices, finalAngle, fontSize } = useMemo(() => {
    const n = tied.length;
    const sliceAngle = 360 / n;
    const selectedIndex = tied.findIndex((p) => p.clerkId === selectedClerkId);
    const safeIndex = selectedIndex >= 0 ? selectedIndex : 0;
    // Align the middle of the selected slice with the top pointer (angle 0).
    // finalAngle is applied to the wheel itself, so a negative value rotates CCW
    // the slice into the pointer's position. 5 full rotations for drama.
    const finalAngle =
      -(safeIndex * sliceAngle) - sliceAngle / 2 + 360 * ROTATIONS;
    const fontSize = n <= 3 ? 14 : n <= 5 ? 12 : 10;
    const slices = tied.map((p, i) => {
      const start = i * sliceAngle;
      const end = (i + 1) * sliceAngle;
      const mid = start + sliceAngle / 2;
      // Label position: 60% of the radius, centered in the slice
      const [lx, ly] = polarToCart(100, 100, 60, mid);
      return {
        id: p.clerkId,
        label: p.username,
        fill: PALETTE[i % PALETTE.length]!,
        path: sliceArcPath(100, 100, 95, start, end),
        lx,
        ly,
      };
    });
    return { slices, finalAngle, fontSize };
  }, [tied, selectedClerkId]);

  useEffect(() => {
    // Trigger the CSS transition on next frame so React has committed the
    // initial rotate(0deg). Without rAF, React may batch the updates and the
    // transition never fires.
    const raf = requestAnimationFrame(() => setSpinning(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleTransitionEnd = () => {
    if (settleTimer.current) return;
    settleTimer.current = setTimeout(() => {
      onDone();
    }, SETTLE_MS);
  };

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  return (
    <div className="relative mx-auto" style={{ width: 220, height: 240 }}>
      {/* Top pointer */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: 0,
          width: 0,
          height: 0,
          borderLeft: "12px solid transparent",
          borderRight: "12px solid transparent",
          borderTop: "20px solid #fbbf24",
          zIndex: 2,
        }}
      />
      <svg
        viewBox="0 0 200 200"
        style={{
          width: 220,
          height: 220,
          marginTop: 16,
          transform: spinning ? `rotate(${finalAngle}deg)` : "rotate(0deg)",
          transition: spinning
            ? `transform ${durationMs}ms cubic-bezier(.17,.67,.12,.99)`
            : "none",
        }}
        onTransitionEnd={handleTransitionEnd}
        aria-label="Roue de la fortune"
      >
        <circle cx={100} cy={100} r={95} fill="#0f1419" stroke="#f59e0b" strokeWidth={3} />
        {slices.map((s) => (
          <g key={s.id}>
            <path d={s.path} fill={s.fill} />
            <text
              x={s.lx}
              y={s.ly}
              fill="white"
              fontSize={fontSize}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {s.label}
            </text>
          </g>
        ))}
        <circle cx={100} cy={100} r={10} fill="#fbbf24" stroke="#000" strokeWidth={2} />
      </svg>
    </div>
  );
}
```

- [ ] **Step 2 : Type-check**

```bash
cd apps/client && bun run check-types
```

Attendu : 0 erreur.

---

## Task 11 : `Conseil.tsx` — phases + intégration roue + fallback 2 s

**Files:**
- Modify: `apps/client/src/components/alcohol/rounds/Conseil.tsx`

- [ ] **Step 1 : Refactor complet du composant Conseil**

Le composant actuel gère 2 phases (`vote` | `result`). On ajoute `tiebreaker-reveal` et `tiebreaker-spin`.

Les données arrivent via `data` (la prop existante alimentée par `activeRoundData` du store) ; on étend le contract : le store doit désormais stocker `selectedClerkId` quand `conseil_tiebreaker` est reçu.

**Étape 1a — `roomStore.ts` : handle `conseil_tiebreaker`**

Dans `roomStore.ts`, ajouter un case dans le handler de messages WS (à côté des cases `conseil_result` et autres) :

```ts
case "conseil_tiebreaker": {
  useAlcoholStore.setState((s) => ({
    activeRoundData: {
      ...(s.activeRoundData ?? {}),
      tiebreaker: {
        tiedClerkIds: msg.tiedClerkIds,
        selectedClerkId: msg.selectedClerkId,
        spinDurationMs: msg.spinDurationMs,
      },
    },
  }));
  break;
}
```

**Étape 1b — `Conseil.tsx` : nouvelles phases**

Remplacer le composant actuel par :

```tsx
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAlcoholStore } from "../../../stores/alcoholStore";
import { usePlayerStore } from "../../../stores/playerStore";
import { useRoomStore } from "../../../stores/roomStore";
import { ConseilWheel } from "./ConseilWheel";

interface Props {
  data: Record<string, unknown>;
}

type Phase = "vote" | "tiebreaker-reveal" | "tiebreaker-spin" | "result";

const REVEAL_MS = 1500;
const FALLBACK_MS = 2000;

export function Conseil({ data }: Props) {
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const room = useRoomStore((s) => s.room);
  const ws = useRoomStore((s) => s.ws);
  const soloPlayers = usePlayerStore((s) => s.players);
  const addDrinkAlert = useAlcoholStore((s) => s.addDrinkAlert);
  const endActiveRound = useAlcoholStore((s) => s.endActiveRound);

  const [voted, setVoted] = useState(false);
  const [soloVotes, setSoloVotes] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("vote");
  const [fallbackSelected, setFallbackSelected] = useState<string | null>(null);

  const isSolo = myClerkId === null;

  const resultVotes = (data.votes as Record<string, string>) ?? {};
  const loserClerkIds = (data.loserClerkIds as string[]) ?? [];
  const tiebreaker = data.tiebreaker as
    | { tiedClerkIds: string[]; selectedClerkId: string; spinDurationMs: number }
    | undefined;

  const allPlayers: { clerkId: string; username: string }[] = isSolo
    ? soloPlayers.map((p) => ({ clerkId: p.name, username: p.name }))
    : ((data.players as { clerkId: string; username: string }[]) ??
      room?.players
        .filter((p) => p.connected)
        .map((p) => ({ clerkId: p.clerkId, username: p.username })) ??
      []);

  const otherPlayers = isSolo
    ? allPlayers
    : allPlayers.filter((p) => p.clerkId !== myClerkId);

  // Phase transitions driven by incoming `data`
  useEffect(() => {
    if (phase === "vote" && loserClerkIds.length >= 2) {
      setPhase("tiebreaker-reveal");
    } else if (phase === "vote" && loserClerkIds.length === 1) {
      setPhase("result");
    }
  }, [loserClerkIds.length, phase]);

  // reveal → spin (1.5s)
  useEffect(() => {
    if (phase !== "tiebreaker-reveal") return;
    const t = setTimeout(() => setPhase("tiebreaker-spin"), REVEAL_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Fallback 2s: si conseil_tiebreaker n'arrive pas, on prend le premier
  useEffect(() => {
    if (phase !== "tiebreaker-spin") return;
    if (tiebreaker) return;
    const t = setTimeout(() => {
      setFallbackSelected(loserClerkIds[0] ?? null);
    }, FALLBACK_MS);
    return () => clearTimeout(t);
  }, [phase, tiebreaker, loserClerkIds]);

  const handleVote = (targetClerkId: string) => {
    if (voted) return;
    setVoted(true);
    if (isSolo) {
      const newVotes: Record<string, string> = {};
      for (const p of allPlayers) newVotes[p.clerkId] = targetClerkId;
      setSoloVotes(newVotes);
      const loserName =
        allPlayers.find((p) => p.clerkId === targetClerkId)?.username ?? "?";
      addDrinkAlert({
        targetClerkIds: [],
        emoji: "🗳️",
        action: `boire une gorgée — ${loserName} désigné par le conseil`,
      });
      setTimeout(() => endActiveRound(), 5000);
    } else if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "conseil_vote", targetClerkId }));
    }
  };

  // Solo: show result in-memory after voting (aucune phase tiebreaker en solo,
  // tous les votes pointent vers le même → jamais d'ex æquo)
  const soloShowResult = isSolo && voted && Object.keys(soloVotes).length > 0;
  const soloLosers: string[] = soloShowResult
    ? Object.values(soloVotes).slice(0, 1)
    : [];

  // ====== Renders ======

  if (phase === "vote" && !soloShowResult) {
    return (
      <Card className="bg-card/90 border-amber-500/30">
        <CardContent className="py-8 text-center">
          <span className="text-6xl block mb-4">🗳️</span>
          <h2 className="text-2xl font-bold mb-2">Conseil du village</h2>
          <p className="text-muted-foreground mb-6">
            Votez pour quelqu&apos;un — celui qui a le plus de votes boit !
          </p>
          {voted ? (
            <p className="text-muted-foreground">En attente des votes...</p>
          ) : (
            <div className="space-y-3">
              {otherPlayers.map((p) => (
                <Button
                  key={p.clerkId}
                  size="lg"
                  className="w-full"
                  onClick={() => handleVote(p.clerkId)}
                >
                  🗳️ {p.username}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (phase === "tiebreaker-reveal") {
    const tiedNames = loserClerkIds.map(
      (id) => allPlayers.find((p) => p.clerkId === id)?.username ?? id,
    );
    return (
      <Card className="bg-card/90 border-amber-500/30 animate-bounce-in">
        <CardContent className="py-8 text-center">
          <span className="text-6xl block mb-4">⚖️</span>
          <h2 className="text-3xl font-bold mb-2 text-amber-400">Égalité !</h2>
          <p className="text-muted-foreground mb-4">
            {loserClerkIds.length} joueurs à égalité
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {tiedNames.map((name) => (
              <span
                key={name}
                className="px-3 py-1 rounded-full bg-amber-500 text-black font-semibold text-sm"
              >
                {name}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "tiebreaker-spin") {
    const tied = loserClerkIds.map((id) => ({
      clerkId: id,
      username: allPlayers.find((p) => p.clerkId === id)?.username ?? id,
    }));
    const selected =
      tiebreaker?.selectedClerkId ?? fallbackSelected ?? tied[0]?.clerkId ?? "";
    const duration = tiebreaker?.spinDurationMs ?? 4000;
    return (
      <Card className="bg-card/90 border-amber-500/30">
        <CardContent className="py-6 text-center">
          <h2 className="text-xl font-bold mb-4 text-amber-400">
            Tirage au sort...
          </h2>
          {selected && (
            <ConseilWheel
              tied={tied}
              selectedClerkId={selected}
              durationMs={duration}
              onDone={() => setPhase("result")}
            />
          )}
        </CardContent>
      </Card>
    );
  }

  // phase === "result" (multi) OR solo result
  const displayLosers = (() => {
    if (isSolo) return soloLosers;
    if (tiebreaker) return [tiebreaker.selectedClerkId];
    if (fallbackSelected) return [fallbackSelected];
    return loserClerkIds.slice(0, 1); // mono-loser or 0-vote (empty)
  })();
  const displayVotes = isSolo ? soloVotes : resultVotes;

  return (
    <Card className="bg-card/90 border-amber-500/30">
      <CardContent className="py-8 text-center">
        <span className="text-6xl block mb-4">🗳️</span>
        <h2 className="text-2xl font-bold mb-4">Résultat du conseil</h2>
        <div className="space-y-2 mb-6">
          {allPlayers.map((p) => {
            const targetId = displayVotes[p.clerkId];
            const targetName =
              allPlayers.find((x) => x.clerkId === targetId)?.username ??
              targetId ??
              "—";
            return (
              <p key={p.clerkId} className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{p.username}</span>{" "}
                a voté pour{" "}
                <span className="font-semibold text-amber-400">{targetName}</span>
              </p>
            );
          })}
        </div>
        <div className="space-y-2">
          {displayLosers.map((loserId) => {
            const loserName =
              allPlayers.find((p) => p.clerkId === loserId)?.username ?? loserId;
            return (
              <p key={loserId} className="text-lg text-amber-400 font-semibold">
                {loserName} boit une gorgée !
              </p>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2 : Type-check**

```bash
cd apps/client && bun run check-types
```

Attendu : 0 erreur.

- [ ] **Step 3 : Commit Part B client**

```bash
git add apps/client/src/components/alcohol/rounds/ConseilWheel.tsx \
        apps/client/src/components/alcohol/rounds/Conseil.tsx \
        apps/client/src/stores/roomStore.ts
git commit -m "feat(alcohol): render Conseil tiebreaker wheel (client)

- new ConseilWheel SVG component, deterministic final angle
- Conseil.tsx gains tiebreaker-reveal (1.5s pastilles) + tiebreaker-spin phases
- fallback 2s client-side if conseil_tiebreaker doesn't arrive (takes tied[0])
- roomStore handles conseil_tiebreaker and threads it into activeRoundData"
```

---

## Task 12 : Étendre `multi-fixtures.ts` pour 3 joueurs

**Files:**
- Modify: `apps/client/tests/helpers/multi-fixtures.ts`

- [ ] **Step 1 : Ajouter un 3ᵉ contexte**

Dans la fixture `multi`, ajouter `third` :

```ts
interface MultiPlayers {
  host: Page;
  guest: Page;
  third: Page;
  hostContext: BrowserContext;
  guestContext: BrowserContext;
  thirdContext: BrowserContext;
}

export const test = base.extend<{ multi: MultiPlayers }>({
  multi: async ({ browser }, use) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const thirdContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    const third = await thirdContext.newPage();

    const id = `${Date.now()}-${++testCounter}`;
    // biome-ignore lint/suspicious/noExplicitAny: Playwright page extension
    (host as any).__testId = id;
    // biome-ignore lint/suspicious/noExplicitAny: Playwright page extension
    (guest as any).__testId = id;
    // biome-ignore lint/suspicious/noExplicitAny: Playwright page extension
    (third as any).__testId = id;

    await setupPage(host);
    await setupPage(guest);
    await setupPage(third);

    await use({ host, guest, third, hostContext, guestContext, thirdContext });

    await hostContext.close();
    await guestContext.close();
    await thirdContext.close();
  },
});
```

- [ ] **Step 2 : Vérifier que les tests 2-players existants compilent**

```bash
cd apps/client && bun run check-types
bunx playwright test tests/e2e/multi/alcohol-phase-b-multi.spec.ts --project=chromium
```

Attendu : OK. Les tests existants n'utilisent pas `third`, donc rien ne casse.

- [ ] **Step 3 : Commit**

```bash
git add apps/client/tests/helpers/multi-fixtures.ts
git commit -m "test(e2e): add third player to multi fixture"
```

---

## Task 13 : E2E — tie wheel à 3 joueurs

**Files:**
- Create: `apps/client/tests/e2e/regression/multi-repro-conseil-tie-wheel.spec.ts`

- [ ] **Step 1 : Explorer live le flow avec playwright-cli**

Avant d'écrire le spec, jouer le flow à 3 joueurs avec `playwright-cli` (suivre le skill nightwatch mode `test`). Cela révèle les sélecteurs exacts à utiliser pour les boutons "🗳️ {name}", l'overlay "Égalité !", et l'état de résultat.

- [ ] **Step 2 : Écrire le spec**

```ts
// apps/client/tests/e2e/regression/multi-repro-conseil-tie-wheel.spec.ts
import { expect } from "@playwright/test";
import {
  playTurnsMulti,
  startMultiAlcoholGame,
  waitForRoundOverlayAnyPlayer,
} from "../../helpers/alcohol-fixtures";
import { test } from "../../helpers/multi-fixtures";

test.describe("Conseil — 3-way tie → wheel → single loser", () => {
  test("3 voters, 3 different targets → wheel picks one, only that player gets the alert", async ({
    multi,
  }) => {
    const { host, guest, third } = multi;

    // Bootstrap une partie avec seulement Conseil en round, frequency 3 (le
    // deuxième tour déclenche la special round). Utiliser le helper existant
    // et étendre pour le 3e joueur — à adapter si startMultiAlcoholGame n'a
    // pas encore la signature tri-joueurs. Dans ce cas, ajouter l'option
    // `extraPages?: Page[]` au helper.
    await startMultiAlcoholGame(host, guest, {
      frequency: 3,
      enabledRounds: ["conseil"],
      extraPages: [third],
    });

    await playTurnsMulti(host, guest, 3, { extraPages: [third] });

    // Attendre l'overlay Conseil sur les 3
    await Promise.all([
      expect(host.getByText("Conseil du village")).toBeVisible({ timeout: 15000 }),
      expect(guest.getByText("Conseil du village")).toBeVisible({ timeout: 15000 }),
      expect(third.getByText("Conseil du village")).toBeVisible({ timeout: 15000 }),
    ]);

    // Chaque joueur vote pour un autre → tie à 1 vote chacun.
    // Host vote pour Guest (premier bouton), Guest vote pour Third, Third vote pour Host.
    // Les boutons sont "🗳️ {username}" — on clique via getByRole.
    const hostButtons = host.getByRole("button", { name: /🗳️/ });
    await hostButtons.first().click({ force: true });
    const guestButtons = guest.getByRole("button", { name: /🗳️/ });
    await guestButtons.first().click({ force: true });
    const thirdButtons = third.getByRole("button", { name: /🗳️/ });
    await thirdButtons.first().click({ force: true });

    // L'overlay "Égalité !" doit apparaître sur les 3.
    await Promise.all([
      expect(host.getByText("Égalité !")).toBeVisible({ timeout: 5000 }),
      expect(guest.getByText("Égalité !")).toBeVisible({ timeout: 5000 }),
      expect(third.getByText("Égalité !")).toBeVisible({ timeout: 5000 }),
    ]);

    // Puis la roue doit apparaître.
    await Promise.all([
      expect(host.getByLabel("Roue de la fortune")).toBeVisible({ timeout: 3000 }),
      expect(guest.getByLabel("Roue de la fortune")).toBeVisible({ timeout: 3000 }),
      expect(third.getByLabel("Roue de la fortune")).toBeVisible({ timeout: 3000 }),
    ]);

    // Résultat : "C'est pour toi !" visible sur EXACTEMENT un client (le perdant tiré).
    // On attend qu'une des 3 pages affiche le verdict self — timeout ~10s (reveal 1.5 + spin 4 + settle 0.8 + drink alert).
    const winnerPromises = [host, guest, third].map(async (p, i) => {
      try {
        await expect(p.getByText("C'est pour toi !")).toBeVisible({ timeout: 12000 });
        return i;
      } catch {
        return -1;
      }
    });
    const results = await Promise.all(winnerPromises);
    const winners = results.filter((r) => r !== -1);
    expect(winners).toHaveLength(1);

    // Les 2 autres doivent voir "C'est pour {name} !"
    const loserIndex = winners[0]!;
    const observers = [host, guest, third].filter((_, i) => i !== loserIndex);
    for (const observer of observers) {
      await expect(observer.getByText(/^C'est pour /)).toBeVisible({ timeout: 2000 });
      await expect(observer.getByText("C'est pour toi !")).not.toBeVisible();
    }
  });
});
```

- [ ] **Step 3 : Si `startMultiAlcoholGame` / `playTurnsMulti` ne supportent pas `extraPages`**

Ajouter l'option dans `apps/client/tests/helpers/alcohol-fixtures.ts` — refactor minimaliste : quand `extraPages` est fourni, appliquer le même setup (auth, WS override, nav) aux pages supplémentaires. Pas de nouvelle logique métier.

- [ ] **Step 4 : Lancer le spec**

```bash
cd apps/client && bunx playwright test tests/e2e/regression/multi-repro-conseil-tie-wheel.spec.ts
```

Attendu : PASS. Si les sélecteurs ne matchent pas, remonter au Step 1 (live exploration) pour ajuster.

- [ ] **Step 5 : Commit**

```bash
git add apps/client/tests/e2e/regression/multi-repro-conseil-tie-wheel.spec.ts \
        apps/client/tests/helpers/alcohol-fixtures.ts
git commit -m "test(e2e): regression — Conseil tie → wheel → single loser"
```

---

## Task 14 : E2E — drink alert personnalisé (self vs others)

**Files:**
- Create: `apps/client/tests/e2e/regression/drink-alert-personalization.spec.ts`

- [ ] **Step 1 : Écrire le spec**

Pattern similaire au Task 13 mais ciblé sur un flow Conseil simple (1 vote, pas de tie) pour isoler l'assertion d'affichage perso. Avec 2 joueurs seulement pour rester rapide.

```ts
// apps/client/tests/e2e/regression/drink-alert-personalization.spec.ts
import { expect } from "@playwright/test";
import {
  playTurnsMulti,
  startMultiAlcoholGame,
  waitForRoundOverlayAnyPlayer,
} from "../../helpers/alcohol-fixtures";
import { test } from "../../helpers/multi-fixtures";

test.describe("Drink alert — personalization", () => {
  test("loser sees 'C'est pour toi !', observer sees 'C'est pour {name} !'", async ({
    multi,
  }) => {
    const { host, guest } = multi;
    await startMultiAlcoholGame(host, guest, {
      frequency: 3,
      enabledRounds: ["conseil"],
    });
    await playTurnsMulti(host, guest, 3);

    await waitForRoundOverlayAnyPlayer(host, guest, "conseil", 15000);

    // host vote pour guest, guest vote pour guest → guest a 2 votes, single loser
    const hostVoteBtn = host.getByRole("button", { name: /🗳️/ }).first();
    const guestVoteBtn = guest.getByRole("button", { name: /🗳️/ }).first();
    await hostVoteBtn.click({ force: true });
    // Note: guest ne peut pas voter pour lui-même, seul bouton = host. Rearranger:
    // → on vote de manière à ce que HOST soit le perdant (les 2 votent pour host).
    // Alice host voit "host username", guest voit "host username" → host boit.
    await guestVoteBtn.click({ force: true });

    // Alert — host est le perdant
    await expect(host.getByText("C'est pour toi !")).toBeVisible({ timeout: 10000 });
    await expect(host.getByText("Boire une gorgée")).toBeVisible();

    // Guest voit "C'est pour {host-username} !"
    await expect(guest.getByText(/^C'est pour /)).toBeVisible({ timeout: 5000 });
    await expect(guest.getByText("C'est pour toi !")).not.toBeVisible();
    await expect(guest.getByText("Boire une gorgée")).toBeVisible();
  });
});
```

- [ ] **Step 2 : Lancer**

```bash
cd apps/client && bunx playwright test tests/e2e/regression/drink-alert-personalization.spec.ts
```

Attendu : PASS.

- [ ] **Step 3 : Commit**

```bash
git add apps/client/tests/e2e/regression/drink-alert-personalization.spec.ts
git commit -m "test(e2e): regression — drink alert renders self vs others correctly"
```

---

## Task 15 : Nightwatch — scenarios + index

**Files:**
- Delete: `apps/client/.discovery/scenarios/conseil-tie-all-losers-drink.md`
- Create: `apps/client/.discovery/scenarios/conseil-tie-wheel.md`
- Create: `apps/client/.discovery/scenarios/drink-alert-personalization.md`
- Modify: `apps/client/.discovery/scenarios/_index.md`

- [ ] **Step 1 : Supprimer l'ancien scenario**

```bash
rm apps/client/.discovery/scenarios/conseil-tie-all-losers-drink.md
```

- [ ] **Step 2 : Créer `conseil-tie-wheel.md`**

```markdown
# Scenario: Conseil du village — tie triggers the fortune wheel

**Status:** covered
**Priority:** critical
**Page:** multi-game
**Domain:** regression
**Spec:** multi-repro-conseil-tie-wheel

## Preconditions

- 3 players in a multi room
- Alcohol mode enabled, `enabledRounds: ["conseil"]`, `frequency: 3`
- Conseil special round has triggered

## Steps

1. Each player clicks a different target → 3-way tie
   - **Expect:** overlay "Égalité !" appears on all 3 clients (~1.5 s)
2. Wheel appears with 3 slices — one per tied player
   - **Expect:** SVG `aria-label="Roue de la fortune"` visible, rotates ~4 s, decelerates
3. After the wheel settles (~0.8 s), exactly one player is "selected"
   - **Expect:** `conseil_tiebreaker` WS frame received by all clients, same `selectedClerkId`
4. Drink alert fires for the selected player only
   - **Expect:** selected player sees "C'est pour toi !" + "Boire une gorgée"; others see "C'est pour {name} !"

## Assertions

- [ ] Overlay "Égalité !" visible with N pastilles (N = tied count)
- [ ] `<svg aria-label="Roue de la fortune">` present in DOM during spin phase
- [ ] Exactly ONE client shows "C'est pour toi !"
- [ ] The other 2 clients show "C'est pour {loserName} !"
- [ ] Round ends cleanly (no stuck overlay, next question appears)

## Notes

Server picks via `shuffleArray(loserClerkIds)[0]` — deterministic with `Math.random`
mocked in unit tests. E2E does not assert WHICH player wins, only that the tie
resolves to a single loser and the drink alert is perso-correct.
```

- [ ] **Step 3 : Créer `drink-alert-personalization.md`**

```markdown
# Scenario: Drink alert — renders "C'est pour toi !" vs "C'est pour {name} !"

**Status:** covered
**Priority:** critical
**Page:** multi-game
**Domain:** regression
**Spec:** drink-alert-personalization

## Preconditions

- 2 players in a multi room
- Alcohol mode enabled, `enabledRounds: ["conseil"]`, `frequency: 3`
- Conseil special round has triggered

## Steps

1. Both players vote for the same target (say, host)
   - **Expect:** single loser, no tiebreaker phase
2. `conseil_result` → `drink_alert` WS frame fires with `targetClerkIds: [hostId]`
3. Client rendering
   - **Expect (host):** big "C'est pour toi !" + amber "Boire une gorgée"
   - **Expect (guest):** big "C'est pour {hostUsername} !" + amber "Boire une gorgée"

## Assertions

- [ ] Host: `.text-2xl.font-bold` contains "C'est pour toi !"
- [ ] Guest: same classes contain a different string starting with "C'est pour "
- [ ] Both clients show the action line "Boire une gorgée"
- [ ] Emoji displayed: 🗳️

## Notes

Part A of the refactor — payload `drink_alert` now carries `targetClerkIds[]` and
`action` instead of pre-formatted `message`. Each client computes the verdict from
`myClerkId ∈ targetClerkIds`. Names resolved via `room.players` (multi) /
`usePlayerStore` (solo).

This scenario is the minimal check for Part A. Other rounds (Courage, Distributeur,
Petit Buveur, etc.) use the same payload and inherit this behavior — their existing
scenarios are stale-flagged and re-checked post-migration.
```

- [ ] **Step 4 : Mettre à jour `_index.md`**

Dans la section `### regression` du fichier `.discovery/scenarios/_index.md`, ajouter 2 lignes (conserver le reste de la table) :

```markdown
| [Conseil — tie → fortune wheel](./conseil-tie-wheel.md) | multi-game | covered | critical | multi-repro-conseil-tie-wheel |
| [Drink alert — personalization](./drink-alert-personalization.md) | multi-game | covered | critical | drink-alert-personalization |
```

Mettre aussi à jour le tableau `## Coverage` ligne `regression` : `Scenarios 7 → 9`, `Covered 7 → 9`, `Last explored` → `2026-04-24`.

- [ ] **Step 5 : Commit**

```bash
git add apps/client/.discovery/scenarios/
git commit -m "docs(nightwatch): scenarios for Conseil tie wheel + drink alert perso"
```

---

## Task 16 : Nightwatch — re-explorer `multi-game.md`

**Files:**
- Modify: `apps/client/.discovery/map/multi-game.md`

- [ ] **Step 1 : Démarrer le dev server**

```bash
cd apps/client && bun --hot index.ts
```

(Voir le skill `nightwatch` mode `explore` pour le protocole d'exploration avec `playwright-cli`.)

- [ ] **Step 2 : Jouer le flow tiebreaker**

Via `playwright-cli` : créer une room à 3 joueurs, déclencher un Conseil avec tie, capturer des snapshots aux phases `tiebreaker-reveal` et `tiebreaker-spin`.

- [ ] **Step 3 : Documenter les 2 overlays**

Ajouter 2 sections dans `multi-game.md` :

```markdown
### Conseil — Tiebreaker Reveal overlay

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Emoji | icon | ⚖️ | 6xl, block |
| Title | heading | Égalité ! | amber-400, bold 3xl |
| Subtitle | paragraph | {N} joueurs à égalité | muted |
| Pastille | span | {username} | amber-500 bg, flex-wrap group |

### Conseil — Tiebreaker Spin overlay

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Title | heading | Tirage au sort... | amber-400 |
| Wheel | svg | aria-label="Roue de la fortune" | rotates ~4s cubic-bezier ease-out |
| Pointer | div | — | amber triangle fixed top |

## States

| State | Trigger | Key changes |
|-------|---------|-------------|
| tiebreaker-reveal | `conseil_result` with loserClerkIds.length ≥ 2 | overlay ⚖️ + pastilles, auto-advance 1.5s |
| tiebreaker-spin | auto 1.5s after reveal | wheel SVG, rotates to selectedClerkId, 4s + 0.8s settle |
```

- [ ] **Step 4 : Commit**

```bash
git add apps/client/.discovery/map/multi-game.md
git commit -m "docs(nightwatch): document Conseil tiebreaker overlays in multi-game map"
```

---

## Self-Review

**1. Spec coverage**

- [x] Part A — payload `drink_alert` refactor → Tasks 2, 3, 4, 5, 6, 7
- [x] Part A — Cupidon propagation préservée → Task 3 (test + refactor)
- [x] Part A — `handleCulSecEndGame` → Task 3 Step 4
- [x] Part A — `joinNames` partagé → Task 1
- [x] Part B — phases serveur + tiebreaker broadcast → Task 9
- [x] Part B — client phases + fallback → Task 11
- [x] Part B — composant `ConseilWheel` → Task 10
- [x] Tests unitaires pure-logic → Tasks 3, 8
- [x] E2E regression (2 specs) → Tasks 13, 14
- [x] Fixture 3 joueurs → Task 12
- [x] Nightwatch scenarios + map → Tasks 15, 16
- [x] Reconnexion snapshot tiebreaker → Task 9 Step 1 (le state local inclut `tiedClerkIds`, `selectedClerkId`, `spinStartedAt`). La spec prévoit que le serveur inclut ces champs dans le snapshot envoyé au reconnect — **mais le send lui-même passe par `roomStore.room_joined` côté serveur**. Ce code n'est pas touché dans ce plan : le mécanisme de snapshot `room_joined` existe déjà pour `game.activeRound` (framework.ts). Le state serveur local à conseil.ts est isolé du snapshot. → À ajouter : Task ajoutée ci-dessous.

**2. Placeholder scan** — OK, tous les steps contiennent le code ou la commande exacte.

**3. Type consistency** — `selectedClerkId`, `tiedClerkIds`, `spinDurationMs` sont nommés identiquement partout.

### Task 17 — Reconnexion : inclure le snapshot tiebreaker dans `room_joined`

**Files:**
- Modify: `apps/client/src/server/rooms.ts` — là où `room_joined` est émis, ajouter une méthode pour lire l'état actuel de la special round active.

- [ ] **Step 1 : Localiser le broadcast `room_joined`**

```bash
grep -n "room_joined" apps/client/src/server/rooms.ts apps/client/src/server/ws.ts
```

- [ ] **Step 2 : Passer un snapshot conseil si une phase `tiebreaker` est active**

Dans `conseil.ts`, exposer une fonction lecture-seule :

```ts
export function getConseilSnapshot(
  roomCode: string,
): { phase: "vote" | "tiebreaker"; tiedClerkIds?: string[]; selectedClerkId?: string; spinStartedAt?: number; spinDurationMs?: number } | null {
  const cs = conseilState.get(roomCode);
  if (!cs || cs.phase === "done") return null;
  if (cs.phase !== "tiebreaker") return { phase: cs.phase };
  return {
    phase: cs.phase,
    tiedClerkIds: cs.tiedClerkIds,
    selectedClerkId: cs.selectedClerkId,
    spinStartedAt: cs.spinStartedAt,
    spinDurationMs: SPIN_DURATION,
  };
}
```

Dans `rooms.ts` (ou l'endroit où `room_joined` est construit), inclure le snapshot :

```ts
import { getConseilSnapshot } from "./alcohol/rounds/conseil";
// ...
const conseilSnapshot =
  room.game?.alcoholState?.activeRound === "conseil"
    ? getConseilSnapshot(room.code)
    : null;
// ... ajouter { conseilSnapshot } au payload room_joined
```

- [ ] **Step 3 : Client consomme le snapshot**

Dans `roomStore.ts`, quand `room_joined` arrive : si `conseilSnapshot` est non-null et `phase === "tiebreaker"`, écrire dans `activeRoundData.tiebreaker` et forcer la phase côté UI à `tiebreaker-spin` en calculant `elapsed = Date.now() - spinStartedAt`. Si `elapsed > REVEAL + SPIN + SETTLE`, directement `result`.

Concrètement, ajouter une fonction utilitaire dans `Conseil.tsx` qui lit `data.tiebreaker.spinStartedAt` si présent et skip les phases déjà passées.

- [ ] **Step 4 : Type-check, test global**

```bash
cd apps/client && bun run check-types && bun test
```

- [ ] **Step 5 : Commit**

```bash
git add apps/client/src/server/rooms.ts \
        apps/client/src/server/alcohol/rounds/conseil.ts \
        apps/client/src/stores/roomStore.ts \
        apps/client/src/components/alcohol/rounds/Conseil.tsx
git commit -m "feat(alcohol): snapshot Conseil tiebreaker state for reconnections"
```

---

## Final verification

- [ ] **Full test run**

```bash
cd apps/client
bun run check-types
bun test
bunx playwright test tests/e2e/regression/multi-repro-conseil-tie-wheel.spec.ts \
                    tests/e2e/regression/drink-alert-personalization.spec.ts
bunx playwright test tests/e2e/multi/alcohol-phase-b-multi.spec.ts  # regression existing
```

- [ ] **Re-rejouer les scenarios nightwatch stale**

Les scenarios listés dans la spec comme `stale à re-vérifier` (`cul-sec-end-game`, `courage-solo-flow`, `courage-result-shows-answers`, `distributeur-solo-flow`, `petit-buveur-double-overlay`, `alcohol-solo-trigger`, `alcohol-multi-trigger`) peuvent avoir un affichage de `drink_alert` qui a changé. Re-jouer leur spec Playwright respective ; mettre à jour le scenario `.md` si la visuelle a évolué. Aucun test métier ne devrait casser.

- [ ] **PR**

Si tout vert, créer la PR avec un résumé faisant référence à la spec source et listant les 17 tasks livrées.
