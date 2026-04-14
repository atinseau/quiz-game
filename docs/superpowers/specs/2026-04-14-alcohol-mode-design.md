# Mode Alcool — Framework + Manches Spéciales — Design

> Version: 1.1 — 14 avril 2026

## Objectif

Ajouter un mode soirée avec des manches spéciales entre les tours de quiz. Compatible 1 appareil et multi-appareil. Ce spec couvre le framework complet + 3 manches simples (Phase A). Les 5 manches interactives seront dans un spec séparé (Phase B).

---

## Architecture

### Principe : Plugin Registry

Chaque manche spéciale est un **module isolé** avec une interface commune. Le framework ne connaît que l'interface, pas les détails. Ajouter une manche = ajouter des fichiers dans `rounds/` + l'enregistrer dans le registry. Zero modification du framework.

```ts
// Interface commune — serveur
interface ServerRound {
  type: SpecialRoundType;
  start(room: Room, state: AlcoholState): void;
  handleMessage(room: Room, clerkId: string, msg: Record<string, unknown>): void;
}

// Interface commune — client
interface ClientRound {
  type: SpecialRoundType;
  component: React.ComponentType<RoundProps>;
}

// Registry — Map<SpecialRoundType, ServerRound | ClientRound>
// On ajoute des manches sans toucher au framework
```

### Logique de déclenchement

- **Solo** : dans `alcoholStore.ts` (Zustand dédié) — après chaque tour, vérifier le compteur
- **Multi** : dans `src/server/alcohol/framework.ts` — le serveur décide et broadcast
- Les stores existants (`gameStore`, `roomStore`) ne contiennent PAS de logique alcool — ils appellent juste `alcoholStore.checkTrigger()` ou le framework serveur

### État alcool

```ts
interface AlcoholConfig {
  enabled: boolean;
  frequency: number;            // tours entre chaque manche (3-10, défaut 5)
  enabledRounds: SpecialRoundType[];
  culSecEndGame: boolean;       // le perdant boit cul sec
}

interface AlcoholState {
  config: AlcoholConfig;
  turnsSinceLastSpecial: number;
  specialRoundQueue: SpecialRoundType[];
}

type SpecialRoundType =
  // Phase A (implémenté dans ce spec)
  | "petit_buveur"
  | "distributeur"
  | "courage"
  // Phase B (prévu, non implémenté — grisé dans la config UI)
  | "conseil"
  | "love_or_drink"
  | "cupidon"
  | "show_us"
  | "smatch_or_pass";
```

### Déclenchement

Après chaque `turn_result` :
1. `turnsSinceLastSpecial++`
2. Si `turnsSinceLastSpecial >= config.frequency` → déclencher une manche spéciale
3. Piocher dans `specialRoundQueue` (file randomisée des manches activées)
4. Quand la queue est vide → la reshuffler
5. Reset `turnsSinceLastSpecial = 0`

---

## Messages WS (multi-appareil)

### Serveur → Client(s)

```ts
| { type: "special_round_start"; round: SpecialRoundData }
| { type: "drink_alert"; targetClerkId: string; emoji: string; message: string }
| { type: "courage_decision"; playerClerkId: string; countdown: number }
| { type: "courage_question"; question: QuestionWithoutAnswer }
| { type: "courage_result"; correct: boolean; pointsDelta: number }
| { type: "distribute_prompt"; distributorClerkId: string; remaining: number }
| { type: "special_round_end" }
```

### Client → Serveur

```ts
| { type: "courage_choice"; accept: boolean }
| { type: "courage_answer"; answer: string | boolean }
| { type: "distribute_drink"; targetClerkId: string }
```

### Config (envoyé au start_game)

```ts
// Ajouté au message start_game existant
| { type: "start_game"; alcoholConfig?: AlcoholConfig }
```

En solo, pas de messages WS — tout dans le gameStore.

---

## Manches spéciales — Phase A

### Petit buveur 🍺

- **Condition** : Le joueur avec le moins de points boit une gorgée
- **Égalité** : Tous les ex-æquo au plus bas boivent
- **Flow** :
  1. `special_round_start { round: { type: "petit_buveur", losers: PlayerInfo[] } }`
  2. `drink_alert` envoyé aux joueurs concernés : "🍺 Tu bois une gorgée !"
  3. Pause 5 secondes (les autres voient l'overlay avec "X boit une gorgée")
  4. `special_round_end`

### Distributeur 🎯

- **Condition** : Le joueur avec le plus de points distribue 3 gorgées
- **Égalité** : Premier joueur par ordre de rotation
- **Flow** :
  1. `special_round_start { round: { type: "distributeur", distributor: PlayerInfo } }`
  2. Le distributeur voit les autres joueurs comme des boutons — 3 taps
  3. Chaque tap → `distribute_drink { targetClerkId }` → serveur envoie `drink_alert` au receveur : "🍺 {distributeur} t'envoie une gorgée !"
  4. Après 3 taps → `special_round_end`
  5. En 1 appareil : le joueur tape sur les noms affichés
- **Timeout** : 30s pour distribuer. Timeout = les gorgées restantes sont perdues.

### Question de courage 🎰

- **Condition** : Un joueur tiré au sort
- **Flow** :
  1. `special_round_start { round: { type: "courage", player: PlayerInfo } }`
  2. `courage_decision { playerClerkId, countdown: 10 }` — countdown visible par tous
  3. Le joueur choisit : `courage_choice { accept: true/false }`
    - Timeout 10s sans réponse = refus
  4. Si **refuse** :
    - `drink_alert` : "🥃 Tu bois la moitié de ton verre !"
    - `special_round_end`
  5. Si **accepte** :
    - Le serveur prend une question QCM du pack, la retire du pool, la pose en mode texte (sans choix)
    - `courage_question { question }` — QuestionWithoutAnswer (type forcé à "texte", pas de choices)
    - Le joueur répond : `courage_answer { answer }`
    - Le serveur valide (fuzzy match)
    - `courage_result { correct, pointsDelta }`
    - Correct → +2 pts, pas de drink
    - Incorrect → `drink_alert` : "🍻 CUL SEC !"
    - `special_round_end`

---

## Manches spéciales — Phase B (non implémenté, framework prévu)

### Conseil du village 🗳️
- Vote de tous les joueurs pour élire un "boloss"
- Le joueur élu boit
- Nécessite : phase de vote, comptage, égalité/revote

### Love or Drink 💋
- Les deux joueurs avec le moins de points
- Bisou ou cul sec
- Nécessite : choix entre 2 joueurs

### Cupidon 💘
- Deux joueurs liés au hasard pour le reste de la partie
- Ce qui arrive à l'un arrive à l'autre
- Nécessite : état persistant `cupidLinks` dans AlcoholState

### Show Us 👀
- Deviner la couleur du sous-vêtement d'un joueur
- Timer 15s, vote couleur, révélation
- Nécessite : phase de vote, timer, révélation

### Smatch or Pass 💥
- Deux joueurs de sexe opposé
- Le décideur choisit smatch ou pass
- Nécessite : sélection genrée, choix, résultat visible par tous

---

## Notification plein écran — DrinkAlert

Composant générique réutilisable pour toutes les manches :

```tsx
<DrinkAlert emoji="🍺🍺🍺" message="Alice t'envoie 3 gorgées !" />
```

- Overlay plein écran semi-transparent
- Emoji animé (bounce-in)
- Message texte en gros
- Se ferme automatiquement après 4 secondes ou au tap
- Empilable : si plusieurs alertes arrivent, elles se queulent

Déclenché par le message WS `drink_alert` (multi) ou directement en solo.

---

## Cul sec fin de partie

Quand `culSecEndGame` est activé :

1. À la fin de la partie, avant `game_over`, le serveur identifie le perdant (score le plus bas)
2. Égalité → tous les ex-æquo
3. Envoie `drink_alert` : "🍻 CUL SEC ! Tu as perdu !"
4. Pause 5s
5. Puis envoie `game_over` normalement

---

## UI — Écran de config

### Solo (HomeScreen step 4)

Après la sélection du mode (step 3), si le toggle "Mode Soirée 🍻" est activé :
- Slider fréquence : "Manche spéciale tous les X tours" (3-10, défaut 5)
- Checkboxes manches :
  - ✅ Petit buveur (activé par défaut)
  - ✅ Distributeur (activé par défaut)
  - ✅ Question de courage (activé par défaut)
  - 🔒 Conseil du village (grisé, "Bientôt")
  - 🔒 Love or Drink (grisé, "Bientôt")
  - 🔒 Cupidon (grisé, "Bientôt")
  - 🔒 Show Us (grisé, "Bientôt")
  - 🔒 Smatch or Pass (grisé, "Bientôt")
- Toggle "Cul sec en fin de partie"

### Multi (MultiLobby)

Même config, visible uniquement par le host. Les autres voient "Mode Soirée activé" avec un résumé de la config.

---

## Structure fichiers

### Architecture modulaire

```
src/server/alcohol/
  framework.ts              — déclenchement, queue, registry serveur
  types.ts                  — interfaces ServerRound, AlcoholConfig, AlcoholState
  rounds/
    petit-buveur.ts         — logique serveur petit buveur
    distributeur.ts         — logique serveur distributeur
    courage.ts              — logique serveur question de courage
    index.ts                — registry: exporte Map<SpecialRoundType, ServerRound>

src/stores/
  alcoholStore.ts           — état alcool solo (config, queue, manche active, drink alerts)

src/components/alcohol/
  SpecialRoundOverlay.tsx   — framework overlay modal (switch dynamique sur le type)
  DrinkAlert.tsx            — notification plein écran générique (emoji + message)
  AlcoholConfig.tsx         — écran config (toggle, slider, checkboxes)
  rounds/
    PetitBuveur.tsx         — UI manche petit buveur
    Distributeur.tsx        — UI manche distributeur (3 taps)
    QuestionDeCourage.tsx   — UI manche courage (décision + question)
    index.ts                — registry: exporte Map<SpecialRoundType, ClientRound>
```

### Nouveaux fichiers

| Fichier | Rôle |
|---------|------|
| `src/server/alcohol/framework.ts` | Framework serveur : déclenchement, queue, dispatch |
| `src/server/alcohol/types.ts` | Interfaces ServerRound, messages, types |
| `src/server/alcohol/rounds/petit-buveur.ts` | Logique serveur petit buveur |
| `src/server/alcohol/rounds/distributeur.ts` | Logique serveur distributeur |
| `src/server/alcohol/rounds/courage.ts` | Logique serveur courage |
| `src/server/alcohol/rounds/index.ts` | Registry serveur |
| `src/stores/alcoholStore.ts` | Store Zustand alcool solo |
| `src/components/alcohol/SpecialRoundOverlay.tsx` | Overlay modal framework |
| `src/components/alcohol/DrinkAlert.tsx` | Notification plein écran |
| `src/components/alcohol/AlcoholConfig.tsx` | Écran config |
| `src/components/alcohol/rounds/PetitBuveur.tsx` | UI petit buveur |
| `src/components/alcohol/rounds/Distributeur.tsx` | UI distributeur |
| `src/components/alcohol/rounds/QuestionDeCourage.tsx` | UI courage |
| `src/components/alcohol/rounds/index.ts` | Registry client |

### Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `src/server/game-engine.ts` | Appeler `framework.checkTrigger(room)` après chaque tour |
| `src/server/types.ts` | Messages WS alcool |
| `src/stores/gameStore.ts` | Appeler `alcoholStore.checkTrigger()` après chaque tour (pas de logique alcool inline) |
| `src/stores/roomStore.ts` | Handler messages alcool → déléguer à `alcoholStore` |
| `src/components/HomeScreen.tsx` | Toggle mode soirée + step config (AlcoholConfig) |
| `src/components/MultiLobby.tsx` | Toggle + config pour le host |
| `src/components/GameScreen.tsx` | Intégrer SpecialRoundOverlay + DrinkAlert |
| `src/components/MultiGameScreen.tsx` | Intégrer SpecialRoundOverlay + DrinkAlert |
| `src/components/EndScreen.tsx` | Cul sec avant classement |
| `src/components/MultiEndScreen.tsx` | Cul sec avant classement |

### Extensibilité

Ajouter une manche Phase B :
1. Créer `src/server/alcohol/rounds/conseil.ts` (logique serveur)
2. Créer `src/components/alcohol/rounds/Conseil.tsx` (UI client)
3. Enregistrer dans les deux `index.ts` (registry)
4. Retirer le badge "Bientôt" de la checkbox dans AlcoholConfig

Zero modification du framework, des stores, ou du game engine.

---

## Hors scope

- Les 5 manches Phase B (spec séparé)
- Sync Strapi des événements alcool (pas de persistence)
- Compteur de gorgées (Phase 5 Analytics)
