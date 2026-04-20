# Manches Spéciales — Correction Design

> Version: 1.0 — 19 avril 2026
> Dépend de : `2026-04-19-special-rounds-audit.md`

## Objectif

Corriger les 13 bugs reproduits (9 E2E + 4 unit) dans `docs/superpowers/specs/2026-04-19-special-rounds-audit.md`. Une fois appliqués, les repros `tests/e2e/repro/*.spec.ts` (`test.fail`) et `src/server/alcohol/rounds/*.test.ts` (`test.failing`) doivent tous flipper en "unexpected pass" — signal que les bugs sont corrigés.

Scope : mode alcool uniquement. Pas de refonte UX (sons, animations, badges permanents Cupidon) — ces items restent des recommandations produit hors de ce lot.

---

## Principes

- **Pas de rupture de contrat externe.** Les messages WS existants déjà émis restent compatibles. On ajoute des handlers client ; on n'altère pas la forme des messages serveur sauf si nécessaire.
- **Diff minimal.** Chaque fix touche la plus petite surface possible. Pas de refactor gratuit.
- **Repro comme test de régression.** Après chaque fix, les repros correspondants flippent. Aucun `test.skip` ajouté.

---

## Correction par bug

### FIX #1 — BUG-FLOW-1 : 4 handlers manquants dans `roomStore.ts`

**Repro** : `multi-repro-BUG-FLOW-1-{conseil,love-or-drink,show-us,smatch}.spec.ts`

**Design**
Ajouter 4 `case` dans le `switch (msg.type)` de `roomStore.ts` (autour de la ligne 280). Chacun merge la payload du message dans `activeRoundData` avec une phase explicite que le composant client sait rendre.

```ts
case "conseil_result":
  useAlcoholStore.getState().setActiveRound("conseil", {
    ...useAlcoholStore.getState().activeRoundData,
    phase: "result",
    votes: msg.votes,
    loserClerkIds: msg.loserClerkIds,
    players: msg.players, // si le serveur l'envoie ; sinon dérivé du room
  });
  break;

case "love_or_drink_result":
  useAlcoholStore.getState().setActiveRound("love_or_drink", {
    ...useAlcoholStore.getState().activeRoundData,
    choice: msg.choice, // "bisou" | "cul_sec"
  });
  break;

case "show_us_result":
  useAlcoholStore.getState().setActiveRound("show_us", {
    ...useAlcoholStore.getState().activeRoundData,
    phase: "result",
    correctColor: msg.correctColor,
    wrongClerkIds: msg.wrongClerkIds,
    timedOut: msg.timedOut,
  });
  break;

case "smatch_or_pass_result":
  useAlcoholStore.getState().setActiveRound("smatch_or_pass", {
    ...useAlcoholStore.getState().activeRoundData,
    choice: msg.choice, // "smatch" | "pass"
  });
  break;
```

**Contrats vérifiés (lecture code serveur)**
- `conseil.ts:106-109` broadcast `{ type: "conseil_result", votes, loserClerkIds }` — le client attend bien `phase: "result"`. Le helper `setActiveRound("conseil", { ..., phase: "result", ...msg })` suffit. Les `players` ne sont pas toujours dans le message ; le composant `Conseil.tsx:30-39` retombe sur `room.players` en multi, donc OK.
- `love-or-drink.ts` broadcast `{ type: "love_or_drink_result", choice }`. Le composant lit `data.choice` (`LoveOrDrink.tsx:25`) → OK.
- `show-us.ts:105-110` broadcast `{ type: "show_us_result", correctColor, wrongClerkIds, timedOut }`. Composant lit `data.correctColor`, `data.wrongClerkIds`, `data.timedOut` (`ShowUs.tsx:56-61`, 196+) → OK.
- `smatch-or-pass.ts:24-29` broadcast `{ type: "smatch_or_pass_result", decideur, receveur, choice }`. Composant lit `data.choice` → OK.

**Complément P2 — types**
Ajouter les 4 messages dans la union `ServerMessage` (`src/server/types.ts`) pour restaurer la sûreté de type :

```ts
| { type: "conseil_result"; votes: Record<string, string>; loserClerkIds: string[] }
| { type: "love_or_drink_result"; choice: "bisou" | "cul_sec" }
| { type: "show_us_result"; correctColor: string; wrongClerkIds: string[]; timedOut: boolean }
| { type: "smatch_or_pass_result"; decideur: PlayerSmatchInfo; receveur: PlayerSmatchInfo; choice: "smatch" | "pass" }
```

### FIX #2 — BUG-FLOW-2 : DrinkAlerts fullscreen empilés

**Repro** : `multi-repro-BUG-FLOW-2-drink-alert-stack.spec.ts`, `repro-BUG-love-or-drink-double-alert.spec.ts`

**Design**
Transformer `DrinkAlert` d'un overlay fullscreen `fixed inset-0 z-[100]` en une **file (toast stack)** avec UN seul overlay actif à la fois + queue interne. Les alertes ultérieures s'affichent séquentiellement quand la précédente se ferme.

Changements :
- `stores/alcoholStore.ts` — `drinkAlerts[]` reste une file ; ajouter un champ `currentDrinkAlert: DrinkAlertData | null`. `addDrinkAlert` pousse dans la file ; `removeDrinkAlert` dépile et set `currentDrinkAlert` au suivant.
- `components/alcohol/DrinkAlert.tsx` — inchangé (un seul overlay rendu par le parent).
- `GameScreen.tsx` / `MultiGameScreen.tsx` — au lieu de `drinkAlerts.map(...)`, render uniquement `currentDrinkAlert && <DrinkAlert {...current} onClose={...} />`.

**Alternative considérée et rejetée** : stack vertical de toasts non-fullscreen. Rejeté parce que le produit veut l'emphase dramatique d'un overlay plein écran (c'est un jeu de soirée).

**Effet sur les repros**
- FLOW-2 (petit_buveur 2 losers) : `countDrinkAlerts(page) <= 1` passe car l'UI n'en monte qu'un à la fois.
- Love or drink solo double alert : même chose (idem `countDrinkAlerts` en solo).

Optimisation associée : `LoveOrDrink.tsx:38-45` solo pourrait être simplifié en un seul `addDrinkAlert` agrégé "{a} et {b} boivent — cul sec !" — cosmétique mais améliore l'UX. Optionnel.

### FIX #3 — BUG-FLOW-3 : fenêtre de 1 s stale UI

**Repro** : `multi-repro-BUG-FLOW-3-round-end-gap.spec.ts`

**Design**
Supprimer le `setTimeout(1000)` dans `framework.ts:137-139`. Le callback `_onRoundEnd` (qui appelle `sendQuestion`) est invoqué immédiatement après le broadcast `special_round_end`.

```ts
export function endSpecialRound(room: Room): void {
  const game = room.game;
  if (!game?.alcoholState) return;
  game.alcoholState.activeRound = null;
  broadcast(room, { type: "special_round_end" });
  if (_onRoundEnd) _onRoundEnd(room);
}
```

**Pourquoi c'est sûr**
Le délai de 1 s était là pour laisser l'animation de fermeture jouer côté client, mais le client retire immédiatement l'overlay en réception de `special_round_end`. Le prochain `question` peut arriver immédiatement ; `state.game` est alors reset par le handler `"question"` de `roomStore.ts:223-234`. Pas de course : le message arrive après `special_round_end`, donc dans l'ordre attendu.

**Effet sur les repros**
- FLOW-3 : le texte de `p.text-xl` change dès l'arrivée du nouveau `question` → gap < 300 ms.

### FIX #4 — BUG-FLOW-4 : `courage.pickCourageQuestion` splice

**Repro** : `multi-repro-BUG-FLOW-4-courage-splice.spec.ts` + `src/server/alcohol/rounds/courage.test.ts`

**Design**
Retirer le `splice` et marquer la question comme "utilisée par courage" via un Set `usedByCourage` dans `alcoholState`. Le game-engine skippe ces index lors de `sendQuestion` / `scheduleNextQuestion`.

1. `alcohol/types.ts` — étendre `AlcoholState` :
   ```ts
   interface AlcoholState {
     ...
     usedByCourage: Set<number>;
   }
   ```
   `initAlcoholState` initialise `usedByCourage: new Set()`.

2. `alcohol/rounds/courage.ts:23-34` — `pickCourageQuestion` retourne la question SANS `splice`, et ajoute l'index au Set :
   ```ts
   function pickCourageQuestion(room: Room): QuestionFull | null {
     const game = room.game;
     if (!game) return null;
     const used = game.alcoholState?.usedByCourage;
     for (let i = game.currentQuestionIndex + 1; i < game.questions.length; i++) {
       if (used?.has(i)) continue;
       const q = game.questions[i];
       if (q && q.type === "qcm") {
         used?.add(i);
         return q;
       }
     }
     return null;
   }
   ```

3. `game-engine.ts:468-498` — `scheduleNextQuestion` doit skipper les index consommés par courage :
   ```ts
   function scheduleNextQuestion(room: Room): void {
     ...
     room.nextQuestionTimer = setTimeout(() => {
       ...
       let nextIndex = game.currentQuestionIndex + 1;
       const used = game.alcoholState?.usedByCourage;
       while (used?.has(nextIndex) && nextIndex < game.questions.length) {
         nextIndex++;
       }
       if (nextIndex >= game.questions.length) { endGame(room); return; }
       game.currentQuestionIndex = nextIndex;
       ...
     }, NEXT_QUESTION_DELAY);
   }
   ```

**Alternative considérée et rejetée** : re-présenter la question en QCM plus tard (ne pas marquer consommée). Rejeté parce que le joueur connaîtrait la réponse — pas fair.

**Effet sur les repros**
- Unit test `courage.test.ts` : `game.questions.length` inchangé après accept → passe.
- E2E FLOW-4 : les 6 questions du pack sont toutes broadcast via `question` → `questionCount >= 6` → passe.

### FIX #5 — BUG-conseil-solo-empty : Conseil solo < 2 joueurs

**Repro** : `repro-BUG-conseil-solo-empty.spec.ts`

**Design**
En solo, le trigger de Conseil doit être **skippé** si `players.length < 2`. Le framework solo est dans `gameStore.ts` (client, pas serveur). Ajouter un guard avant `setActiveRound("conseil", ...)`.

Emplacement : dans `gameStore.ts`, au niveau du dispatch solo des special rounds (cherche le `if (roundType === "conseil")`).

```ts
if (roundType === "conseil") {
  if (players.length < 2) {
    // Skip the round in solo with no voters: pick the next round from the queue.
    return useAlcoholStore.getState().checkTrigger();
  }
  useAlcoholStore.getState().setActiveRound("conseil", { ... });
}
```

**Effet sur le repro**
- Solo avec 1 joueur → `Conseil` jamais déclenchée → aucun bouton `🗳️ Alice` → assertion `not.toBeVisible` passe.

Complément mineur : `Conseil.tsx:51-55` solo, remplacer la simulation déterministe (tous votent pour la cible) par une simulation aléatoire pour plus de fun. Hors scope du fix pur, laissé à un ticket UX.

### FIX #6 — BUG-courage-countdown-no-force : solo 10 s pas forcé

**Repro** : `repro-BUG-courage-countdown-no-force.spec.ts`

**Design**
Dans `QuestionDeCourage.tsx:34-49`, quand le countdown atteint 0 côté solo, forcer le refus (`sendChoice(false)`). Le countdown existe déjà dans `useEffect` ; il suffit de trigger le refus quand `countdown === 0`.

```ts
useEffect(() => {
  if (phase !== "decision") return;
  const timer = setInterval(() => {
    setCountdown((c) => {
      if (c <= 1) {
        clearInterval(timer);
        // Force refus when countdown expires — matches server timeout behavior.
        if (isSolo) sendChoice(false);
        return 0;
      }
      return c - 1;
    });
  }, 1000);
  return () => clearInterval(timer);
}, [phase, isSolo]);
```

En multi, le serveur a déjà son propre timeout (`courage.ts:55-66`), donc pas besoin de dupliquer côté client.

**Effet sur le repro**
- Solo : après 10 s, `sendChoice(false)` → `setLocalResult = "refused"` → affichage drink alert "refuse — la moitié du verre !" → `endActiveRound()` → les boutons `J'accepte !` / `Je passe...` disparaissent.

### FIX #7 — BUG-LoveOrDrink solo double alert

**Repro** : `repro-BUG-love-or-drink-double-alert.spec.ts`

**Design**
Déjà couvert par FIX #2 (queue). Côté `LoveOrDrink.tsx:38-45` on peut en plus agréger en un seul alert :

```ts
if (choice === "cul_sec") {
  addDrinkAlert({
    emoji: "🍺",
    message: `${players[0].username} et ${players[1].username} boivent — cul sec !`,
  });
}
```

Moins d'alertes → pas de besoin de file → UX plus propre.

### FIX #8 — BUG-cupidon shuffle biaisé

**Repro** : `src/server/alcohol/rounds/cupidon.test.ts`

**Design**
Remplacer `[...players].sort(() => Math.random() - 0.5)` par `shuffleArray(players)` (Fisher-Yates déjà dans `framework.ts:24-33`).

```ts
// cupidon.ts
import { shuffleArray } from "../framework";
...
const shuffled = shuffleArray(players);
```

Export de `shuffleArray` à rendre public depuis `framework.ts`.

### FIX #9 — BUG-smatch non-random

**Repro** : `src/server/alcohol/rounds/smatch-or-pass.test.ts`

**Design**
Filtrer par genre puis tirer aléatoirement dans chaque sous-liste, au lieu de `find()`.

```ts
// smatch-or-pass.ts:42-43
const hommes = connected.filter((p) => p.gender === "homme");
const femmes = connected.filter((p) => p.gender === "femme");
if (hommes.length === 0 || femmes.length === 0) {
  endSpecialRound(room);
  return;
}
const homme = hommes[Math.floor(Math.random() * hommes.length)]!;
const femme = femmes[Math.floor(Math.random() * femmes.length)]!;
```

### FIX #10 — BUG-distributeur ordre rotation

**Repro** : `src/server/alcohol/rounds/distributeur.test.ts`

**Design**
En cas d'égalité au max score, sélectionner le gagnant par **ordre de rotation** à partir de `currentPlayerIndex`, pas `Object.entries` (ordre d'insertion).

```ts
// distributeur.ts:19-26
const maxScore = Math.max(...Object.values(game.scores));
const rotation = Array.from(room.players.keys());
const startIdx = game.currentPlayerIndex;
let winnerId: string | null = null;
for (let i = 0; i < rotation.length; i++) {
  const idx = (startIdx + i) % rotation.length;
  const id = rotation[idx];
  if (id && (game.scores[id] ?? 0) === maxScore) {
    winnerId = id;
    break;
  }
}
if (!winnerId) { endSpecialRound(room); return; }
```

Cette boucle garantit que l'ex-æquo **le plus proche dans la rotation** (à partir du joueur courant) gagne — cohérent avec l'esprit "tour par tour" de la spec.

---

## Impacts transverses

### Tests de régression

Après application des fix :
- `test.fail` → `test.fail` toujours marqué. Si le bug est bien corrigé, Playwright reporte "expected fail but passed" → échec CI. **Action** : retirer `test.fail` pour que le test devienne une régression normale (vert = comportement correct).
- `test.failing` (Bun) → idem : retirer `.failing`, renommer en `test(...)`.

Le plan d'implémentation liste chaque repro et l'étape où retirer la marque.

### Commits proposés

- Commit 1 : FIX #1 (handlers roomStore + types.ts)
- Commit 2 : FIX #2 (DrinkAlert queue)
- Commit 3 : FIX #3 (endSpecialRound delay)
- Commit 4 : FIX #4 (courage usedByCourage)
- Commit 5 : FIX #5 (Conseil solo guard)
- Commit 6 : FIX #6 (Courage countdown auto-refus)
- Commit 7 : FIX #7 (LoveOrDrink aggregate alert)
- Commit 8 : FIX #8 (Cupidon shuffle)
- Commit 9 : FIX #9 (Smatch random)
- Commit 10 : FIX #10 (Distributeur rotation)
- Commit 11 : retirer `test.fail` / `test.failing` + ajouter 2 nouvelles assertions chacun (score delta, UI cleanup) pour solidifier les tests de régression.

Découpage fin pour faciliter review + revert individuel si un fix introduit une régression.

---

## Hors scope (tickets UX séparés)

- Sons dédiés par manche
- Animations de gorgée / verre qui se vide
- Badge permanent Cupidon sur scoreboard
- Timer visible dans tous les écrans d'attente
- Refonte Solo Conseil vote aléatoire (au-delà du guard `< 2 joueurs`)
- Refonte Solo ShowUs (évite self-vs-self)
- Cleanup des Map d'état serveur au teardown de room (BUG-FLOW-6 / P2 dans audit)

Ces items sont référencés dans l'audit (§ "Rapport UX par manche" et § "Recommandations produit"). À créer en tickets séparés si priorisés.
