# WebSocket — Infrastructure, Rooms & Lobby — Design

> Version: 1.0 — 14 avril 2026

## Objectif

Ajouter un serveur WebSocket à l'app pour permettre le jeu multi-appareil. Ce spec couvre uniquement l'infrastructure WS, la gestion des rooms et le lobby. La logique de jeu multi-appareil (game engine) fera l'objet d'un spec séparé.

---

## Serveur WebSocket

**Intégré dans `apps/client/index.ts`** — même process Bun, même port 3000.

**Auth** : Cookie Clerk `__session` envoyé automatiquement à l'upgrade HTTP. Le serveur vérifie le JWT via `@clerk/backend` dans le `fetch` handler avant d'appeler `server.upgrade()`. Si invalide → `401 Unauthorized`, pas d'upgrade.

**Données joueur** : Extraites du JWT Clerk et attachées à `ws.data` :
```ts
interface WsData {
  clerkId: string;
  username: string;
  gender: Gender;
}
```

Disponibles dans tous les handlers WS (`ws.data.clerkId`, etc.).

**Dépendance** : Ajouter `@clerk/backend` aux dépendances de `apps/client`.

---

## Structure des rooms

```ts
interface RoomPlayer {
  clerkId: string;
  username: string;
  gender: Gender;
  ws: ServerWebSocket | null;  // null = déconnecté
  connected: boolean;
  disconnectedAt: number | null; // timestamp pour timeout reconnexion
}

interface Room {
  code: string;               // 6 chars alphanumériques (ex: "A3K9F2")
  hostClerkId: string;
  players: Map<string, RoomPlayer>; // clerkId → player
  status: "lobby" | "playing";
  packSlug: string | null;
  mode: GameMode | null;
  questions: Question[];      // chargées au lancement, avec réponses (source de vérité serveur)
}

const rooms = new Map<string, Room>(); // code → room
```

**Codes** : 6 caractères, lettres majuscules + chiffres, vérifiés uniques dans la Map.

---

## Protocole WS

### Client → Serveur

```ts
type ClientMessage =
  | { type: "create_room" }
  | { type: "join_room"; code: string }
  | { type: "select_pack"; packSlug: string }
  | { type: "select_mode"; mode: GameMode }
  | { type: "start_game" }
  | { type: "leave_room" }
```

Pas d'infos joueur dans les messages — elles viennent du cookie Clerk vérifié à l'upgrade.

### Serveur → Client(s)

```ts
type ServerMessage =
  | { type: "room_created"; code: string }
  | { type: "room_joined"; room: RoomState }
  | { type: "player_joined"; player: PlayerInfo }
  | { type: "player_left"; clerkId: string }
  | { type: "player_disconnected"; clerkId: string }
  | { type: "player_reconnected"; clerkId: string }
  | { type: "host_changed"; clerkId: string }
  | { type: "pack_selected"; packSlug: string; packName: string }
  | { type: "mode_selected"; mode: GameMode }
  | { type: "game_starting" }
  | { type: "error"; message: string }
```

`RoomState` = snapshot complet (code, players, pack, mode, status) envoyé au join/reconnexion pour rattraper l'état.

---

## Chargement des questions

1. Host sélectionne un pack dans le lobby → `select_pack` envoyé au serveur
2. Le serveur appelle l'API Strapi (`GET /api/questions?filters[pack][slug][$eq]=xxx`) pour charger les questions
3. Les questions (avec réponses) sont stockées dans `room.questions` — source de vérité serveur
4. Au lancement, le serveur envoie `game_starting` à tous
5. À chaque tour, le serveur envoie la question **sans la réponse** aux clients
6. Après résolution du tour, le serveur envoie `answer_result` avec la bonne réponse révélée

Les clients ne voient jamais la réponse avant d'avoir soumis.

---

## Sync Strapi (moments clés)

L'état de jeu vit en mémoire. Strapi est synchronisé uniquement à :

| Moment | Action Strapi |
|--------|--------------|
| Création room | `POST /api/game-sessions` (status: lobby, roomCode, hostClerkId) |
| Lancement partie | `PUT /api/game-sessions/:id` (status: playing, pack, mode, players) |
| Fin de partie | `PUT /api/game-sessions/:id` (status: finished, scores, GameAnswers en batch) |

---

## Flow UI

### Routing

```
/play              → ModeChoice (un seul appareil vs multi-appareil)
/play/solo         → HomeScreen actuel (pack → joueurs manuels → mode)
/play/create       → crée room WS → redirige vers /play/lobby/:code
/play/join         → saisie du code → rejoint → redirige vers /play/lobby/:code
/play/lobby/:code  → MultiLobby
/join/:code        → raccourci direct (lien QR) → rejoint → redirige vers /play/lobby/:code
```

### Composants

| Composant | Rôle |
|-----------|------|
| `ModeChoice.tsx` | Écran `/play` : 2 boutons "Un seul appareil" / "Multi-appareil" |
| `MultiLobby.tsx` | Lobby : QR code, code affiché, liste joueurs, config pack/mode (host), bouton lancer (host) |
| `JoinRoom.tsx` | Écran `/play/join` : saisie code room |

### Lobby (MultiLobby)

**Vue host :**
- Code de la room affiché en gros + QR code (lien vers `/join/:code`)
- Liste des joueurs connectés (temps réel)
- Sélection du pack (même grid que HomeScreen)
- Sélection du mode (même cards que HomeScreen)
- Bouton "Lancer la partie" (actif si pack + mode choisis + ≥2 joueurs)

**Vue joueur :**
- Code de la room
- Liste des joueurs connectés (temps réel)
- Pack et mode choisis par le host (lecture seule)
- Message "En attente du lancement..."

---

## Déconnexion & reconnexion

**Joueur déconnecté :**
- `ws.close` → `ws` mis à `null`, `connected: false`, `disconnectedAt: Date.now()`
- Les autres reçoivent `player_disconnected`
- Timer **60s** — si pas reconnecté, le joueur est retiré définitivement (`player_left`)
- Pendant la déconnexion en jeu : le joueur est **skip** dans la rotation des tours (pas de points, pas de pénalité)

**Reconnexion :**
- Nouvelle connexion WS, même cookie Clerk → même `clerkId`
- Le serveur retrouve la room et le joueur via `clerkId`
- Remplace le `ws`, `connected: true`, `disconnectedAt: null`
- Le joueur reçoit `room_joined` avec le state complet
- Les autres reçoivent `player_reconnected`
- Le joueur reprend sa place dans la rotation au prochain tour

**Host déconnecté :**
- Le joueur suivant (connecté) dans la Map devient host
- Tous reçoivent `host_changed`

**Dernier joueur quitte / timeout :**
- La room est supprimée de la Map

**Cleanup rooms inactives :**
- `setInterval` toutes les 5 min, supprime les rooms en `lobby` sans joueurs connectés depuis plus de 10 min

---

## Fichiers

### Nouveaux

| Fichier | Rôle |
|---------|------|
| `src/server/ws.ts` | Handlers WS (open, message, close) |
| `src/server/rooms.ts` | Map des rooms, logique create/join/leave/reconnect/cleanup |
| `src/server/auth.ts` | Vérification cookie Clerk à l'upgrade |
| `src/server/types.ts` | Types WS (Room, RoomPlayer, ClientMessage, ServerMessage) |
| `src/components/ModeChoice.tsx` | Choix un appareil / multi-appareil |
| `src/components/MultiLobby.tsx` | Lobby multi-appareil (QR code, joueurs, config host) |
| `src/components/JoinRoom.tsx` | Saisie code room pour rejoindre |
| `src/hooks/useRoom.ts` | Hook React pour la connexion WS et l'état de la room |

### Modifiés

| Fichier | Changement |
|---------|------------|
| `apps/client/index.ts` | Ajouter `websocket` handler à `Bun.serve()`, route `/ws` upgrade |
| `apps/client/src/App.tsx` | Nouvelles routes (`/play/solo`, `/play/create`, `/play/join`, `/play/lobby/:code`, `/join/:code`) |
| `apps/client/package.json` | Ajouter `@clerk/backend` |

---

## Hors scope

- Logique de jeu multi-appareil (questions, réponses, scoring, timer) — spec séparée "Game Engine"
- Mode alcool
- Marketplace
