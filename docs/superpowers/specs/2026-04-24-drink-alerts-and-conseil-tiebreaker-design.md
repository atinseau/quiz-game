# Drink alerts personnalisés & roue de la fortune (Conseil) — Design

> Version : 1.0 — 24 avril 2026

## Objectif

Deux changements liés, livrés dans une même spec :

- **A — Drink alerts personnalisés (plateforme)** : les alertes de "verdict" (actuellement le même message pour toute la salle) deviennent personnalisées. Les joueurs concernés lisent `"C'est pour toi !"`, les autres `"C'est pour {noms} !"`. Le message porte aussi l'action à accomplir (`"boire une gorgée"`, `"faire un cul-sec"`, …) de façon générique.
- **B — Roue de la fortune (Conseil du village)** : en cas d'ex æquo dans les votes, une **roue de la fortune** s'affiche et **tire au sort** un seul perdant parmi les ex æquo, au lieu de faire boire tout le monde comme actuellement.

B dépend du format d'alerte introduit par A pour l'affichage final du perdant.

---

## Partie A — Drink alerts personnalisés

### Constat

La fonction `broadcastDrinkAlert(room, targetClerkId, emoji, message)` envoie aujourd'hui un message pré-formaté identique à toute la salle. Chacun voit `"Alice doit boire !"` — y compris Alice. Le champ `message` est une chaîne libre formatée côté serveur au call site.

10 call sites identifiés : `framework.ts` (cul-sec end game), `conseil.ts`, `courage.ts` (×3), `distributeur.ts`, `show-us.ts`, `love-or-drink.ts` (×2), `petit-buveur.ts` (émission directe sans passer par `broadcastDrinkAlert`).

### Nouveau payload

```ts
// apps/client/src/shared/types.ts
type DrinkAlert = {
  type: "drink_alert";
  targetClerkIds: string[];         // qui doit agir (1..N)
  emoji: string;
  action: string;                   // verbe libre : "boire une gorgée",
                                    // "faire un cul-sec", "boire 3 gorgées",
                                    // "boire — lié au cœur", etc.
  details?: DrinkAlertDetails;      // inchangé
};
```

### Server

Nouvelle signature :

```ts
export function broadcastDrinkAlert(
  room: Room,
  targetClerkIds: string[],
  emoji: string,
  action: string,
  details?: DrinkAlertDetails,
): void
```

Les 10 call sites migrent en un seul commit (pas de dual-support — petite codebase, serveur et client déployés ensemble).

**Règle de migration par call site** : on lit le `message` actuel, on isole la portion "verbe + COD" (ex. `"Alice a été désigné par le conseil — boit !"` → action `"boire une gorgée"`) et on la passe en `action`. Le sujet (`"Alice"`, `"Tu"`) disparaît du serveur et renaît côté client via `targetClerkIds`. L'emoji reste identique à l'actuel pour chaque call site.

Mapping cible :

| Call site | emoji actuel | `action` nouvelle |
|---|---|---|
| `framework.handleCulSecEndGame` | `🥃` | `"faire cul-sec — score le plus bas"` |
| `conseil.finalizeConseil` | `🗳️` | `"boire une gorgée"` |
| `courage` (3 branches) | inchangé | `"boire 1 gorgée"` / `"boire 3 gorgées"` / etc. — même taux que le message actuel, juste reformulé en verbe |
| `distributeur` | inchangé | `"boire"` + `details` de distribution (conservés inchangés) |
| `show-us` | inchangé | `"boire une gorgée"` |
| `love-or-drink` (2 branches) | inchangé | `"boire — Love or Drink"` (les 2 branches gardent la même action, les cibles diffèrent) |
| `petit-buveur` | `🍺` | `"boire une gorgée"` — l'agrégation actuelle devient `targetClerkIds: [...drinkers.keys()]` (1 seul message au lieu de N) |

Les chaînes exactes sont arbitrées à l'implémentation en relisant chaque `message` actuel — aucune nouvelle logique métier, seulement un refactor.

La **propagation Cupidon** reste interne à `broadcastDrinkAlert` et émet un second `drink_alert` dédié pour chaque partenaire lié :
```ts
{ targetClerkIds: [partner], emoji: "💘", action: "boire — lié au cœur" }
```

### Client

`DrinkAlert.tsx` reçoit les nouvelles props :

```tsx
interface DrinkAlertProps {
  targetClerkIds: string[];
  emoji: string;
  action: string;
  details?: Details;
  onClose: () => void;
  duration?: number;
}
```

Logique d'affichage :

```ts
const isMe =
  myClerkId !== null && targetClerkIds.includes(myClerkId);

const names = targetClerkIds.map(resolveName);   // room.players en multi,
                                                 // usePlayerStore en solo
const verdict = isMe
  ? "C'est pour toi !"
  : `C'est pour ${joinNames(names)} !`;
```

Rendu :

- **Ligne 1** (très grosse, bold, blanc) : `verdict`
- **Ligne 2** (amber, plus petite, première lettre capitalisée) : `action`
- **Ligne 3** (optionnel, inchangé) : `<DrinkAlertDetails details={details} />`
- **Ligne 4** (discret, conditionnel) : si `isMe && targetClerkIds.length > 1`, afficher `"(+ {autres noms})"` pour indiquer que le joueur n'est pas seul

### Helper partagé

`joinNames` existe déjà en local dans `petit-buveur.ts`. Il est déplacé vers **`apps/client/src/shared/format.ts`** (nouveau fichier) pour être accessible côté serveur **et** client. Implémentation identique à l'actuelle — on déplace, on ne réécrit pas.

### Mode solo

`myClerkId === null` en solo. Tous les messages sont affichés en mode observateur (`"C'est pour Bob !"`) — cohérent avec le pattern actuel où le joueur n'est pas un participant au sens multi.

---

## Partie B — Roue de la fortune (Conseil)

### Comportement actuel

`resolveVotes` (fichier `server/alcohol/rounds/conseil.ts`) calcule `loserClerkIds` = tous les joueurs avec le nombre de votes maximum, puis envoie un `drink_alert` par perdant. En cas d'ex æquo à 3, toute la pièce boit.

### Nouveau comportement

- `loserClerkIds.length === 0` (timeout sans vote) → personne ne boit, **inchangé**
- `loserClerkIds.length === 1` → 1 seul perdant, **inchangé** — pas de roue
- `loserClerkIds.length >= 2` → **nouvelle phase tiebreaker** : révélation ex æquo + roue + tirage au sort d'un seul perdant

### État serveur étendu

```ts
type ConseilServerState = {
  votes: Map<string, string>;
  timeoutId: ReturnType<typeof setTimeout>;
  phase: "vote" | "tiebreaker" | "done";         // NOUVEAU
  tiebreakerTimeoutId?: ReturnType<typeof setTimeout>;  // NOUVEAU
  tiedClerkIds?: string[];                       // NOUVEAU — snapshot pour reconnexion
  selectedClerkId?: string;                      // NOUVEAU — snapshot pour reconnexion
  spinStartedAt?: number;                        // NOUVEAU — Date.now() au broadcast du tiebreaker
};
```

En phase `tiebreaker`, `handleMessage` rejette silencieusement tout nouveau `conseil_vote` (invariant : plus aucun vote n'est accepté une fois la roue lancée).

### Nouveau message WS

```ts
// serveur → clients (en plus du conseil_result existant)
{
  type: "conseil_tiebreaker",
  tiedClerkIds: string[],          // 2..N, ordre stable (par Map insertion)
  selectedClerkId: string,         // tiré par le serveur via shuffleArray
  spinDurationMs: number,          // ex. 4000
}
```

**Fairness** : le serveur est autoritaire. `selectedClerkId = shuffleArray(loserClerkIds)[0]!`. Tous les clients animent la roue pour converger vers la même slice, calculée déterministiquement à partir de `selectedClerkId` et de l'ordre de `tiedClerkIds`.

### Nouveau flow serveur

```ts
function resolveVotes(room: Room): void {
  // ... count votes (inchangé) ...
  broadcast(room, { type: "conseil_result", votes, loserClerkIds });

  if (loserClerkIds.length <= 1) {
    finalizeConseil(room, loserClerkIds[0]);  // peut être undefined
    return;
  }

  const selectedClerkId = shuffleArray(loserClerkIds)[0]!;
  const REVEAL_DURATION = 1500;
  const SPIN_DURATION = 4000;
  const SETTLE_DURATION = 800;

  broadcast(room, {
    type: "conseil_tiebreaker",
    tiedClerkIds: loserClerkIds,
    selectedClerkId,
    spinDurationMs: SPIN_DURATION,
  });

  cs.phase = "tiebreaker";
  cs.tiebreakerTimeoutId = setTimeout(
    () => finalizeConseil(room, selectedClerkId),
    REVEAL_DURATION + SPIN_DURATION + SETTLE_DURATION,
  );
}

function finalizeConseil(room: Room, loserId: string | undefined): void {
  if (loserId) {
    broadcastDrinkAlert(room, [loserId], "🗳️", "boire une gorgée");
  }
  setTimeout(() => endSpecialRound(room), 5000);
}
```

### Client — phases de render

`Conseil.tsx` étend les phases existantes :

```ts
type Phase = "vote" | "tiebreaker-reveal" | "tiebreaker-spin" | "result";
```

Transitions :

- `vote` ← `special_round_start`
- `tiebreaker-reveal` ← `conseil_result` si `loserClerkIds.length >= 2` (1,5 s, auto-avance)
- `tiebreaker-spin` ← après 1,5 s de reveal (roue tourne `spinDurationMs`)
- `result` ← après `onTransitionEnd` + settle (0,8 s), avec `displayLosers = [selectedClerkId]`
- `result` (direct) ← `conseil_result` si `loserClerkIds.length <= 1`

Le `selectedClerkId` arrive via `conseil_tiebreaker`. **Fallback simple** : si le message n'est pas reçu dans les 2 s suivant `conseil_result`, le client prend `tiedClerkIds[0]` comme sélectionné.

### Composant `ConseilWheel`

Nouveau fichier `apps/client/src/components/alcohol/rounds/ConseilWheel.tsx` :

```tsx
interface Props {
  tied: { clerkId: string; username: string }[];
  selectedClerkId: string;
  durationMs: number;
  onDone: () => void;
}
```

Implémentation :

- `<svg viewBox="0 0 200 200">` (180×180 px visuels), pointeur fixe en haut (triangle `#fbbf24`)
- N slices de `360 / N` degrés, palette fixe cyclique : `#f59e0b`, `#dc2626`, `#7c3aed`, `#059669`, `#0284c7`, `#db2777`
- Texte par slice : `<text>` centré radialement, `dominant-baseline:middle`, taille adaptative (passe de 14 à 10 pt si N ≥ 6)
- Rotation : `transform: rotate(${finalAngle}deg)` + `transition: transform ${durationMs}ms cubic-bezier(.17, .67, .12, .99)` (ease-out prononcé)
- Angle final déterministe :
  ```ts
  const sliceAngle = 360 / tied.length;
  const selectedIndex = tied.findIndex(p => p.clerkId === selectedClerkId);
  const finalAngle =
    -(selectedIndex * sliceAngle) - sliceAngle / 2 + 360 * 5;  // 5 tours
  ```
- `onTransitionEnd` → `setTimeout(onDone, 800)` (settle 0,8 s)

### Révélation ex æquo (phase `tiebreaker-reveal`)

Overlay bounce-in plein écran (même pattern que `DrinkAlert`) :

- Emoji `⚖️` (très gros)
- Titre : `"Égalité !"`
- Pastilles amber flex-wrap avec les N usernames
- Sous-titre : `"{N} joueurs à {maxVotes} vote(s)"`
- Aucun bouton ; auto-avance vers `tiebreaker-spin` après 1,5 s

### Résumé des cas

| Situation | Phases traversées | Qui boit |
|---|---|---|
| 1 joueur a `maxVotes` | `vote → result` | le 1 |
| 2 ex æquo | `vote → tiebreaker-reveal → tiebreaker-spin → result` | 1 tiré au sort parmi 2 |
| 3 ex æquo | idem, roue à 3 slices | 1 tiré parmi 3 |
| 4+ ex æquo | idem, roue à N slices (max N = nb joueurs connectés) | 1 tiré parmi N |
| 0 votes (timeout) | `vote → result` avec `loserClerkIds = []` | personne (inchangé) |

Le chemin **mono-loser** reste entièrement inchangé côté client : la phase `tiebreaker-*` n'est tout simplement pas traversée.

### Mode solo

En solo, le joueur unique clique sur un joueur cible → les votes simulés vont tous au même joueur → aucun tie possible. **La roue n'est jamais déclenchée en solo.** Le nouveau code reste robuste (la branche `length > 1` n'est pas atteinte).

---

## Edge cases & robustesse

**Reconnexion pendant la roue** : lorsqu'un client se reconnecte et reçoit l'état de la room, le serveur inclut un snapshot de l'état du tiebreaker (`phase`, `tiedClerkIds`, `selectedClerkId`, `spinStartedAt`). Le client reconnecté calcule `elapsed = now - spinStartedAt` et saute directement à la bonne phase : si `elapsed > REVEAL + SPIN` il affiche directement `result`, sinon il démarre la roue à mi-animation (l'angle final est déterministe, le rendu converge).

**Déconnexion du `selectedClerkId` pendant la roue** : la roue continue, le `drink_alert` part quand même. Les autres voient `"C'est pour Bob !"` même si Bob est absent. Comportement cohérent avec le reste de la plateforme (cul-sec pour absent fonctionne déjà).

**Fermeture de room pendant un tiebreaker** : `clearTimeout(cs.tiebreakerTimeoutId)` dans le cleanup de `endSpecialRound` / `deleteRoom` évite les callbacks orphelins.

**Désynchro client** : si `conseil_tiebreaker` arrive avant `conseil_result` (race théorique — même tick côté serveur), on stocke le `selectedClerkId` et la roue démarre dès que `conseil_result` est arrivé. Fallback 2 s : prendre `tiedClerkIds[0]`.

**Breaking change du format `drink_alert`** : migration atomique par commit (pas de dual-support). Serveur et client sont déployés ensemble (un seul build).

---

## Stratégie de tests

### Logique pure → `bun test`

Pattern aligné sur les `.test.ts` existants (`cupidon.test.ts`, `courage.test.ts`) : `Room` factice + capture des `broadcast` calls.

**`server/alcohol/rounds/conseil.test.ts`** (nouveau) :

- 1 winner → `conseil_result` seul, pas de `conseil_tiebreaker`, `drink_alert` direct
- 2 / 3 / 4 ex æquo → `conseil_result` **et** `conseil_tiebreaker` émis, `selectedClerkId ∈ tiedClerkIds`
- 0 votes (timeout) → pas de `conseil_tiebreaker`, pas de `drink_alert`
- `conseil_vote` reçu en phase `tiebreaker` → rejeté silencieusement
- `Math.random` monkey-patché pour rendre la sélection déterministe et asserter sur le `selectedClerkId` exact

**`server/alcohol/framework.test.ts`** (nouveau ou étendu) :

- `broadcastDrinkAlert` nouveau payload → `targetClerkIds[]` + `action`, pas de `message`
- Cupidon propagation → 2 messages distincts, dans l'ordre, avec les bons `targetClerkIds` et `action`

### UI / intégration → nightwatch

**Re-exploration** (après impl, avant scenarios) :

- `apps/client/.discovery/map/multi-game.md` — documenter les 2 nouveaux états d'overlay : `tiebreaker-reveal` (pastilles "Égalité !") et `tiebreaker-spin` (SVG roue)

**Scenarios `.discovery/scenarios/`** :

| Fichier | Action |
|---|---|
| `conseil-tie-all-losers-drink.md` (existant) | Remplacé par `conseil-tie-wheel.md` — documente le nouveau flow 3-phases et l'assertion "un seul perdant après tirage" |
| `drink-alert-personalization.md` | Nouveau — assert que la vue du perdant voit `"C'est pour toi !"` et l'observateur voit `"C'est pour {name} !"`, sur un flow conseil simple (1 vote, pas de tie) |
| `_index.md` | Ajout des 2 scenarios dans la section regression, recalcul de la couverture |

**Specs Playwright** (générées par nightwatch mode `test`, après jeu live avec `playwright-cli`) :

| Spec | Path |
|---|---|
| Conseil tie wheel | `apps/client/tests/e2e/regression/multi-repro-conseil-tie-wheel.spec.ts` |
| Drink alert perso | `apps/client/tests/e2e/regression/drink-alert-personalization.spec.ts` |

**Prérequis technique** : `tests/helpers/multi-fixtures.ts` ne supporte actuellement que 2 joueurs (`host`, `guest`). Ajout d'un `third: Page` (ou API générique `players: Page[]`) nécessaire pour reproduire un tie à 3+. Ce refactor est inclus dans le scope (helper de test, pas de code app).

**Scenarios stale à re-vérifier** post-migration — uniquement ceux qui exercent réellement `drink_alert` (Voleur n'en émet pas) : `cul-sec-end-game`, `courage-solo-flow`, `courage-result-shows-answers`, `distributeur-solo-flow`, `petit-buveur-double-overlay`, `alcohol-solo-trigger`, `alcohol-multi-trigger`. Re-jouer les specs correspondantes pour confirmer que le nouveau rendu (`"C'est pour toi !"` / `"C'est pour {name} !"`) est bien affiché.

---

## Scope hors spec

- Pas d'i18n (la ligne `"C'est pour toi !"` est FR hard-codée côté client — le back ne connaît que l'action en FR)
- Pas de son dédié à la roue (réutilisation si système audio présent, sinon skip)
- Pas de persistance entre sessions du snapshot tiebreaker (si le serveur redémarre pendant un tiebreaker, la room est perdue — comportement existant)
