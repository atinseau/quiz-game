# Game Engine Multi-Appareil — Design

> Version: 1.0 — 14 avril 2026

## Objectif

Porter la logique de jeu côté serveur pour les 3 modes (classique, voleur, chrono) en multi-appareil. Le serveur est la source de vérité, les clients sont des thin clients qui affichent l'état reçu par WebSocket.

---

## Architecture

### Game Engine (serveur)

Module `src/server/game-engine.ts` qui opère sur la Room existante. Prend le relais quand `start_game` est déclenché.

**État de jeu ajouté à la Room :**

```ts
interface GameState {
  questions: Question[];              // avec réponses (source de vérité)
  currentQuestionIndex: number;
  currentPlayerIndex: number;         // répondeur principal (rotation)
  scores: Record<string, number>;     // clerkId → score
  combos: Record<string, number>;     // clerkId → combo
  answers: Map<string, string | boolean>; // clerkId → réponse soumise ce tour
  questionStartedAt: number;          // timestamp pour chrono
  resolved: boolean;                  // tour résolu ou pas
}
```

Le game engine est stateless — il opère directement sur `room.game` et broadcast via les fonctions existantes.

### Flow général

```
start_game
  → charger questions depuis Strapi API
  → shuffle questions
  → stocker dans room.game
  → envoyer première question à tous

question envoyée
  → clients affichent la question
  → joueurs soumettent (submit_answer)
  → serveur collecte, valide, résout
  → envoie turn_result à tous
  → attend 3s
  → envoie question suivante

dernière question résolue
  → game_over envoyé à tous
  → sync Strapi (scores, game answers, packs complétés)
  → clients naviguent vers /end
```

---

## Protocole WS — Messages de jeu

### Client → Serveur

```ts
| { type: "submit_answer"; answer: string | boolean }
```

Un seul message. Le serveur identifie le joueur via `ws.data.clerkId`.

### Serveur → Client(s)

```ts
| { type: "question"; index: number; currentPlayerClerkId: string; question: QuestionWithoutAnswer; startsAt: number }
| { type: "player_answered"; clerkId: string }
| { type: "turn_result"; results: TurnResult }
| { type: "game_over"; scores: Record<string, number>; rankings: RankingEntry[] }
```

### Types

```ts
interface QuestionWithoutAnswer {
  type: "qcm" | "vrai_faux" | "texte";
  text: string;
  choices?: string[];
  category: string;
}

interface TurnResult {
  correctAnswer: string | boolean;
  playerResults: {
    clerkId: string;
    answered: boolean;
    correct: boolean;
    stole: boolean;
    pointsDelta: number;
  }[];
  scores: Record<string, number>;
  combos: Record<string, number>;
}

interface RankingEntry {
  clerkId: string;
  username: string;
  score: number;
  rank: number;
}
```

---

## Logique par mode

### Classique multi-appareil

- Rotation : un joueur par tour (`currentPlayerClerkId`)
- Seul le joueur actif a ses inputs débloqués
- Les autres voient "C'est au tour de {username}"
- Le joueur soumet → serveur valide → `turn_result` → 3s → question suivante
- Scoring : +1pt base + combo (jusqu'à x5). Mauvaise réponse : 0pt, combo reset.

### Chrono multi-appareil

- Même rotation qu'en classique (un joueur par tour)
- Le serveur envoie `startsAt` (timestamp) dans le message `question`
- Le client fait son countdown localement (15s)
- Timeout côté serveur : `setInterval` check `Date.now() - questionStartedAt >= 15000`
  - Si timeout → -0.5pt, combo reset, `turn_result` envoyé
- Réponse dans le temps → scoring normal

### Voleur multi-appareil

- Rotation : un répondeur principal par tour
- **Tous** les joueurs ont leurs inputs débloqués en même temps
- **1 seule tentative** par joueur par question
- Quand un joueur soumet → `player_answered` broadcast (sans révéler correct/incorrect)
- Après soumission → inputs verrouillés pour ce joueur
- Le tour se termine quand : le principal a répondu ET (un vol réussi OU tous les voleurs ont tenté)
- Résolution :
  - Principal correct + pas de vol réussi → +1pt + combo
  - Principal incorrect → 0pt, combo reset
  - Premier voleur correct → +0.5pt voleur, -0.5pt principal
  - Voleur incorrect → -1pt voleur
- `turn_result` envoyé avec le détail complet

### Joueurs déconnectés

- Skip dans la rotation des tours
- Si c'est leur tour → passer au joueur suivant connecté
- Pas de pénalité pendant la déconnexion

---

## Délai entre les tours

Après `turn_result`, le serveur attend **3 secondes** puis envoie automatiquement la question suivante. Les clients affichent le feedback (bonne réponse, points) pendant ce délai. Pas de bouton "Question suivante" en multi-appareil.

---

## Fin de partie

Quand `currentQuestionIndex >= questions.length` :

1. Serveur calcule le classement final
2. Envoie `game_over` à tous les clients
3. Sync Strapi :
   - `PUT /api/game-sessions/:id` → status: finished, scores
   - `POST /api/game-answers` en batch → toutes les réponses (pour analytics)
   - Marquer le pack comme complété pour chaque joueur
4. Les clients naviguent vers `/end`

---

## Composants client

### Nouveaux fichiers

| Fichier | Rôle |
|---------|------|
| `src/components/MultiGameScreen.tsx` | Écran de jeu multi-appareil |
| `src/components/MultiEndScreen.tsx` | Écran de fin multi-appareil |
| `src/hooks/useMultiGame.ts` | Hook qui étend useRoom avec les messages de jeu |

### Composants partagés (existants, réutilisés)

- `AnswerInputs.tsx` (QcmChoices, VraiFaux, TextInput) — identiques
- `Feedback.tsx` — identique
- `ScoreBoard.tsx` — identique

### MultiGameScreen affiche

- La question (composant partagé)
- Les inputs de réponse :
  - Classique/Chrono : verrouillés si pas ton tour
  - Voleur : débloqués pour tous, verrouillés après ta tentative
- Indicateur "C'est au tour de {username}" (classique/chrono)
- Indicateur "{username} a répondu" temps réel (voleur)
- Countdown timer (chrono — calculé localement depuis `startsAt`)
- Feedback après résolution (bonne réponse, points)
- ScoreBoard (composant partagé)
- Pas de bouton "Question suivante"

### Routing

`/game` rend `MultiGameScreen` quand `useRoom().room !== null`, sinon `GameScreen` (solo).

`/end` rend `MultiEndScreen` quand les données `game_over` sont présentes dans le hook, sinon `EndScreen` (solo).

---

## Fichiers serveur

| Fichier | Rôle |
|---------|------|
| `src/server/game-engine.ts` | startGame, submitAnswer, resolveRound, nextQuestion, endGame |
| `src/server/types.ts` | Ajouter GameState, QuestionWithoutAnswer, TurnResult, RankingEntry, nouveaux messages |
| `src/server/ws.ts` | Ajouter handler pour `submit_answer`, déléguer au game engine |

---

## Hors scope

- Mode alcool (Phase 3)
- Sync Strapi GameAnswer en détail (Phase 5 Analytics)
- Reconnexion pendant une partie en cours (géré au niveau Room, le game engine skip les déconnectés)
