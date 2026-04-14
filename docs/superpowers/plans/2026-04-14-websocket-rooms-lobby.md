# WebSocket — Rooms & Lobby Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WebSocket server to the Bun client for multi-device play — room creation, join, lobby with QR code, host config (pack + mode), reconnection.

**Architecture:** WS integrated into existing `Bun.serve()`. Auth via Clerk `__session` cookie verified at HTTP upgrade. Room state in-memory (`Map`). Sync to Strapi at key moments only. Client uses a `useRoom` hook wrapping native `WebSocket`.

**Tech Stack:** Bun WebSocket, @clerk/backend, React, Zustand, qrcode (for QR generation)

**Spec:** `docs/superpowers/specs/2026-04-14-websocket-rooms-lobby-design.md`

---

## File Structure

### New files (server — `apps/client/src/server/`)

```
src/server/types.ts         — Room, RoomPlayer, ClientMessage, ServerMessage types
src/server/rooms.ts         — rooms Map, createRoom, joinRoom, leaveRoom, reconnect, cleanup
src/server/auth.ts          — verifyClerkCookie(req) → { clerkId, username, gender } | null
src/server/ws.ts            — WebSocket handlers (open, message, close) wired to rooms
```

### New files (client components)

```
src/components/ModeChoice.tsx   — /play: "Un seul appareil" vs "Multi-appareil"
src/components/MultiLobby.tsx   — /play/lobby/:code: QR code, players list, host config
src/components/JoinRoom.tsx     — /play/join: code input form
src/hooks/useRoom.ts            — WebSocket connection + room state hook
```

### Modified files

```
apps/client/index.ts            — add websocket handler + /ws upgrade route
apps/client/src/App.tsx         — add new routes (/play/solo, /play/create, /play/join, /play/lobby/:code, /join/:code)
apps/client/package.json        — add @clerk/backend, qrcode, @types/qrcode
```

---

## Task 1: Shared WS Types

**Files:**
- Create: `apps/client/src/server/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// apps/client/src/server/types.ts
import type { ServerWebSocket } from "bun";
import type { GameMode } from "../types";

export type Gender = "homme" | "femme";

export interface WsData {
  clerkId: string;
  username: string;
  gender: Gender;
}

export interface RoomPlayer {
  clerkId: string;
  username: string;
  gender: Gender;
  ws: ServerWebSocket<WsData> | null;
  connected: boolean;
  disconnectedAt: number | null;
}

export interface Room {
  code: string;
  hostClerkId: string;
  players: Map<string, RoomPlayer>;
  status: "lobby" | "playing";
  packSlug: string | null;
  mode: GameMode | null;
}

// Client → Server
export type ClientMessage =
  | { type: "create_room" }
  | { type: "join_room"; code: string }
  | { type: "select_pack"; packSlug: string }
  | { type: "select_mode"; mode: GameMode }
  | { type: "start_game" }
  | { type: "leave_room" };

// Server → Client
export interface PlayerInfo {
  clerkId: string;
  username: string;
  gender: Gender;
  connected: boolean;
}

export interface RoomState {
  code: string;
  hostClerkId: string;
  players: PlayerInfo[];
  status: "lobby" | "playing";
  packSlug: string | null;
  mode: GameMode | null;
}

export type ServerMessage =
  | { type: "room_created"; code: string }
  | { type: "room_joined"; room: RoomState }
  | { type: "player_joined"; player: PlayerInfo }
  | { type: "player_left"; clerkId: string }
  | { type: "player_disconnected"; clerkId: string }
  | { type: "player_reconnected"; clerkId: string }
  | { type: "host_changed"; clerkId: string }
  | { type: "pack_selected"; packSlug: string }
  | { type: "mode_selected"; mode: GameMode }
  | { type: "game_starting" }
  | { type: "error"; message: string };
```

- [ ] **Step 2: Commit**

```bash
cd /Users/arthur/Documents/Dev/projects/quiz-app
git add apps/client/src/server/types.ts
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(ws): add shared WebSocket types (Room, messages, player)"
```

---

## Task 2: Room Management

**Files:**
- Create: `apps/client/src/server/rooms.ts`

- [ ] **Step 1: Create rooms module**

```ts
// apps/client/src/server/rooms.ts
import type { ServerWebSocket } from "bun";
import type {
  Room,
  RoomPlayer,
  RoomState,
  PlayerInfo,
  ServerMessage,
  WsData,
} from "./types";

const rooms = new Map<string, Room>();

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion

function generateCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 6 }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join("");
  } while (rooms.has(code));
  return code;
}

function toPlayerInfo(p: RoomPlayer): PlayerInfo {
  return {
    clerkId: p.clerkId,
    username: p.username,
    gender: p.gender,
    connected: p.connected,
  };
}

export function toRoomState(room: Room): RoomState {
  return {
    code: room.code,
    hostClerkId: room.hostClerkId,
    players: Array.from(room.players.values()).map(toPlayerInfo),
    status: room.status,
    packSlug: room.packSlug,
    mode: room.mode,
  };
}

export function broadcast(room: Room, msg: ServerMessage, exclude?: string) {
  const data = JSON.stringify(msg);
  for (const player of room.players.values()) {
    if (player.ws && player.connected && player.clerkId !== exclude) {
      player.ws.send(data);
    }
  }
}

function send(ws: ServerWebSocket<WsData>, msg: ServerMessage) {
  ws.send(JSON.stringify(msg));
}

export function createRoom(ws: ServerWebSocket<WsData>): Room {
  const { clerkId, username, gender } = ws.data;
  const code = generateCode();

  const player: RoomPlayer = {
    clerkId,
    username,
    gender,
    ws,
    connected: true,
    disconnectedAt: null,
  };

  const room: Room = {
    code,
    hostClerkId: clerkId,
    players: new Map([[clerkId, player]]),
    status: "lobby",
    packSlug: null,
    mode: null,
  };

  rooms.set(code, room);
  send(ws, { type: "room_created", code });
  send(ws, { type: "room_joined", room: toRoomState(room) });
  return room;
}

export function joinRoom(ws: ServerWebSocket<WsData>, code: string): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) {
    send(ws, { type: "error", message: "Room introuvable" });
    return null;
  }

  const { clerkId, username, gender } = ws.data;

  // Reconnection?
  const existing = room.players.get(clerkId);
  if (existing) {
    existing.ws = ws;
    existing.connected = true;
    existing.disconnectedAt = null;
    send(ws, { type: "room_joined", room: toRoomState(room) });
    broadcast(room, { type: "player_reconnected", clerkId }, clerkId);
    return room;
  }

  // New player
  if (room.status === "playing") {
    send(ws, { type: "error", message: "La partie a déjà commencé" });
    return null;
  }

  const player: RoomPlayer = {
    clerkId,
    username,
    gender,
    ws,
    connected: true,
    disconnectedAt: null,
  };

  room.players.set(clerkId, player);
  broadcast(room, { type: "player_joined", player: toPlayerInfo(player) }, clerkId);
  send(ws, { type: "room_joined", room: toRoomState(room) });
  return room;
}

export function leaveRoom(clerkId: string): void {
  for (const [code, room] of rooms) {
    if (!room.players.has(clerkId)) continue;

    room.players.delete(clerkId);
    broadcast(room, { type: "player_left", clerkId });

    if (room.players.size === 0) {
      rooms.delete(code);
      return;
    }

    // Host left — transfer
    if (room.hostClerkId === clerkId) {
      const nextHost = Array.from(room.players.values()).find((p) => p.connected);
      if (nextHost) {
        room.hostClerkId = nextHost.clerkId;
        broadcast(room, { type: "host_changed", clerkId: nextHost.clerkId });
      }
    }
    return;
  }
}

export function handleDisconnect(clerkId: string): void {
  for (const [code, room] of rooms) {
    const player = room.players.get(clerkId);
    if (!player) continue;

    player.ws = null;
    player.connected = false;
    player.disconnectedAt = Date.now();
    broadcast(room, { type: "player_disconnected", clerkId });

    // Host disconnected — transfer to next connected player
    if (room.hostClerkId === clerkId) {
      const nextHost = Array.from(room.players.values()).find((p) => p.connected);
      if (nextHost) {
        room.hostClerkId = nextHost.clerkId;
        broadcast(room, { type: "host_changed", clerkId: nextHost.clerkId });
      }
    }

    // Schedule removal after 60s
    setTimeout(() => {
      const current = room.players.get(clerkId);
      if (current && !current.connected) {
        room.players.delete(clerkId);
        broadcast(room, { type: "player_left", clerkId });
        if (room.players.size === 0) {
          rooms.delete(code);
        }
      }
    }, 60_000);

    return;
  }
}

export function findRoomByPlayer(clerkId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.has(clerkId)) return room;
  }
  return undefined;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

// Cleanup stale lobby rooms every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.status !== "lobby") continue;
    const allDisconnected = Array.from(room.players.values()).every(
      (p) => !p.connected && p.disconnectedAt && now - p.disconnectedAt > 10 * 60_000
    );
    if (room.players.size === 0 || allDisconnected) {
      rooms.delete(code);
    }
  }
}, 5 * 60_000);
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/server/rooms.ts
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(ws): add room management (create, join, leave, reconnect, cleanup)"
```

---

## Task 3: Clerk Auth at WS Upgrade

**Files:**
- Create: `apps/client/src/server/auth.ts`
- Modify: `apps/client/package.json` (add `@clerk/backend`)

- [ ] **Step 1: Install @clerk/backend**

```bash
cd apps/client && bun add @clerk/backend
```

- [ ] **Step 2: Create auth module**

```ts
// apps/client/src/server/auth.ts
import { verifyToken } from "@clerk/backend";
import type { WsData } from "./types";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

export async function verifyClerkCookie(req: Request): Promise<WsData | null> {
  if (!CLERK_SECRET_KEY) {
    console.error("[ws/auth] CLERK_SECRET_KEY not set");
    return null;
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [key, ...rest] = c.trim().split("=");
      return [key, rest.join("=")];
    })
  );

  const token = cookies["__session"];
  if (!token) return null;

  try {
    const verified = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    return {
      clerkId: verified.sub,
      username:
        (verified.username as string) ??
        (verified.email as string) ??
        verified.sub,
      gender: "homme", // default — will be updated from Player DB later
    };
  } catch (err) {
    console.error("[ws/auth] Token verification failed:", err);
    return null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/server/auth.ts apps/client/package.json bun.lock
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(ws): add Clerk cookie verification for WS upgrade"
```

---

## Task 4: WebSocket Handlers

**Files:**
- Create: `apps/client/src/server/ws.ts`

- [ ] **Step 1: Create WS handlers**

```ts
// apps/client/src/server/ws.ts
import type { ServerWebSocket } from "bun";
import type { GameMode } from "../types";
import {
  broadcast,
  createRoom,
  findRoomByPlayer,
  getRoom,
  handleDisconnect,
  joinRoom,
  leaveRoom,
  toRoomState,
} from "./rooms";
import type { ClientMessage, WsData } from "./types";

function send(ws: ServerWebSocket<WsData>, msg: Record<string, unknown>) {
  ws.send(JSON.stringify(msg));
}

function handleMessage(ws: ServerWebSocket<WsData>, raw: string) {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    send(ws, { type: "error", message: "Invalid JSON" });
    return;
  }

  const { clerkId } = ws.data;

  switch (msg.type) {
    case "create_room": {
      // Leave any existing room first
      leaveRoom(clerkId);
      createRoom(ws);
      break;
    }

    case "join_room": {
      leaveRoom(clerkId);
      joinRoom(ws, msg.code);
      break;
    }

    case "select_pack": {
      const room = findRoomByPlayer(clerkId);
      if (!room || room.hostClerkId !== clerkId) {
        send(ws, { type: "error", message: "Seul le host peut choisir le pack" });
        return;
      }
      if (room.status !== "lobby") {
        send(ws, { type: "error", message: "La partie a déjà commencé" });
        return;
      }
      room.packSlug = msg.packSlug;
      broadcast(room, { type: "pack_selected", packSlug: msg.packSlug });
      break;
    }

    case "select_mode": {
      const room = findRoomByPlayer(clerkId);
      if (!room || room.hostClerkId !== clerkId) {
        send(ws, { type: "error", message: "Seul le host peut choisir le mode" });
        return;
      }
      if (room.status !== "lobby") {
        send(ws, { type: "error", message: "La partie a déjà commencé" });
        return;
      }
      room.mode = msg.mode;
      broadcast(room, { type: "mode_selected", mode: msg.mode });
      break;
    }

    case "start_game": {
      const room = findRoomByPlayer(clerkId);
      if (!room || room.hostClerkId !== clerkId) {
        send(ws, { type: "error", message: "Seul le host peut lancer la partie" });
        return;
      }
      if (!room.packSlug || !room.mode) {
        send(ws, { type: "error", message: "Pack et mode requis" });
        return;
      }
      const connectedCount = Array.from(room.players.values()).filter((p) => p.connected).length;
      if (connectedCount < 2) {
        send(ws, { type: "error", message: "Il faut au moins 2 joueurs connectés" });
        return;
      }
      room.status = "playing";
      broadcast(room, { type: "game_starting" });
      // Game engine will take over from here (next spec)
      break;
    }

    case "leave_room": {
      leaveRoom(clerkId);
      break;
    }

    default: {
      send(ws, { type: "error", message: `Unknown message type` });
    }
  }
}

export const websocketHandlers = {
  open(ws: ServerWebSocket<WsData>) {
    console.log(`[ws] Connected: ${ws.data.username} (${ws.data.clerkId})`);
    // Check if reconnecting to an existing room
    const room = findRoomByPlayer(ws.data.clerkId);
    if (room) {
      const player = room.players.get(ws.data.clerkId);
      if (player && !player.connected) {
        player.ws = ws;
        player.connected = true;
        player.disconnectedAt = null;
        ws.send(JSON.stringify({ type: "room_joined", room: toRoomState(room) }));
        broadcast(room, { type: "player_reconnected", clerkId: ws.data.clerkId }, ws.data.clerkId);
      }
    }
  },

  message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
    const raw = typeof message === "string" ? message : message.toString();
    handleMessage(ws, raw);
  },

  close(ws: ServerWebSocket<WsData>) {
    console.log(`[ws] Disconnected: ${ws.data.username} (${ws.data.clerkId})`);
    handleDisconnect(ws.data.clerkId);
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/server/ws.ts
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(ws): add WebSocket message handlers (create, join, config, start)"
```

---

## Task 5: Integrate WS into Bun Server

**Files:**
- Modify: `apps/client/index.ts`

- [ ] **Step 1: Add WS upgrade + websocket handlers to Bun.serve()**

Replace the full content of `apps/client/index.ts`:

```ts
// apps/client/index.ts
import index from "./index.html";
import { verifyClerkCookie } from "./src/server/auth";
import type { WsData } from "./src/server/types";
import { websocketHandlers } from "./src/server/ws";

const server = Bun.serve<WsData>({
  port: 3000,
  routes: {
    "/": index,
    "/play": index,
    "/play/solo": index,
    "/play/create": index,
    "/play/join": index,
    "/play/lobby/*": index,
    "/game": index,
    "/end": index,
    "/join/*": index,
  },
  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const userData = await verifyClerkCookie(req);
      if (!userData) {
        return new Response("Unauthorized", { status: 401 });
      }
      const upgraded = server.upgrade(req, { data: userData });
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    // Audio files
    if (
      url.pathname === "/win.mp3" ||
      url.pathname === "/fail.mp3" ||
      url.pathname === "/steal.mp3"
    ) {
      const filename = url.pathname.slice(1);
      return new Response(Bun.file(`public/assets/${filename}`), {
        headers: { "Content-Type": "audio/mpeg" },
      });
    }

    // SPA fallback
    return new Response(Bun.file("index.html"), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
  websocket: websocketHandlers,
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Quiz app lancée sur http://localhost:${server.port}`);
```

- [ ] **Step 2: Verify server starts**

```bash
cd apps/client && bun run dev
```

Expected: Server starts without errors on port 3000.

- [ ] **Step 3: Commit**

```bash
git add apps/client/index.ts
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(ws): integrate WebSocket handlers into Bun server"
```

---

## Task 6: useRoom Hook (Client)

**Files:**
- Create: `apps/client/src/hooks/useRoom.ts`

- [ ] **Step 1: Create the hook**

```ts
// apps/client/src/hooks/useRoom.ts
import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameMode } from "../types";

interface PlayerInfo {
  clerkId: string;
  username: string;
  gender: "homme" | "femme";
  connected: boolean;
}

interface RoomState {
  code: string;
  hostClerkId: string;
  players: PlayerInfo[];
  status: "lobby" | "playing";
  packSlug: string | null;
  mode: GameMode | null;
}

type ServerMessage =
  | { type: "room_created"; code: string }
  | { type: "room_joined"; room: RoomState }
  | { type: "player_joined"; player: PlayerInfo }
  | { type: "player_left"; clerkId: string }
  | { type: "player_disconnected"; clerkId: string }
  | { type: "player_reconnected"; clerkId: string }
  | { type: "host_changed"; clerkId: string }
  | { type: "pack_selected"; packSlug: string }
  | { type: "mode_selected"; mode: GameMode }
  | { type: "game_starting" }
  | { type: "error"; message: string };

export function useRoom() {
  const { userId } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameStarting, setGameStarting] = useState(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };

    ws.onerror = () => {
      setError("Connexion perdue");
      setConnected(false);
    };

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);

      switch (msg.type) {
        case "room_created":
          // room_joined follows immediately after
          break;

        case "room_joined":
          setRoom(msg.room);
          setError(null);
          break;

        case "player_joined":
          setRoom((prev) => {
            if (!prev) return prev;
            return { ...prev, players: [...prev.players, msg.player] };
          });
          break;

        case "player_left":
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.filter((p) => p.clerkId !== msg.clerkId),
            };
          });
          break;

        case "player_disconnected":
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.map((p) =>
                p.clerkId === msg.clerkId ? { ...p, connected: false } : p
              ),
            };
          });
          break;

        case "player_reconnected":
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.map((p) =>
                p.clerkId === msg.clerkId ? { ...p, connected: true } : p
              ),
            };
          });
          break;

        case "host_changed":
          setRoom((prev) => {
            if (!prev) return prev;
            return { ...prev, hostClerkId: msg.clerkId };
          });
          break;

        case "pack_selected":
          setRoom((prev) => {
            if (!prev) return prev;
            return { ...prev, packSlug: msg.packSlug };
          });
          break;

        case "mode_selected":
          setRoom((prev) => {
            if (!prev) return prev;
            return { ...prev, mode: msg.mode };
          });
          break;

        case "game_starting":
          setGameStarting(true);
          break;

        case "error":
          setError(msg.message);
          break;
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setRoom(null);
    setConnected(false);
  }, []);

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const createRoom = useCallback(() => {
    connect();
    // Wait for connection then send
    const check = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: "create_room" });
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  }, [connect, sendMessage]);

  const joinRoom = useCallback(
    (code: string) => {
      connect();
      const check = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          sendMessage({ type: "join_room", code });
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    },
    [connect, sendMessage]
  );

  const selectPack = useCallback(
    (packSlug: string) => sendMessage({ type: "select_pack", packSlug }),
    [sendMessage]
  );

  const selectMode = useCallback(
    (mode: GameMode) => sendMessage({ type: "select_mode", mode }),
    [sendMessage]
  );

  const startGame = useCallback(
    () => sendMessage({ type: "start_game" }),
    [sendMessage]
  );

  const leaveRoom = useCallback(() => {
    sendMessage({ type: "leave_room" });
    disconnect();
  }, [sendMessage, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const isHost = room?.hostClerkId === userId;

  return {
    room,
    connected,
    error,
    isHost,
    gameStarting,
    createRoom,
    joinRoom,
    leaveRoom,
    selectPack,
    selectMode,
    startGame,
  };
}
```

- [ ] **Step 2: Verify types**

```bash
cd apps/client && bunx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/hooks/useRoom.ts
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(client): add useRoom hook for WebSocket room management"
```

---

## Task 7: ModeChoice Component

**Files:**
- Create: `apps/client/src/components/ModeChoice.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/client/src/components/ModeChoice.tsx
import { Monitor, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function ModeChoice() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-3xl font-bold text-glow-purple">Comment tu veux jouer ?</h1>
        <p className="text-muted-foreground">
          Choisis ton mode de jeu avant de commencer.
        </p>
        <div className="space-y-4">
          <Button
            size="lg"
            className="w-full py-8 text-lg glow-purple"
            onClick={() => navigate("/play/solo")}
          >
            <Monitor className="size-6 mr-3" />
            Un seul appareil
          </Button>
          <div className="grid grid-cols-2 gap-4">
            <Button
              size="lg"
              variant="secondary"
              className="py-8 text-base"
              onClick={() => navigate("/play/create")}
            >
              <Wifi className="size-5 mr-2" />
              Créer une partie
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="py-8 text-base"
              onClick={() => navigate("/play/join")}
            >
              <Wifi className="size-5 mr-2" />
              Rejoindre
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/components/ModeChoice.tsx
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(client): add ModeChoice screen (solo vs multi-device)"
```

---

## Task 8: JoinRoom Component

**Files:**
- Create: `apps/client/src/components/JoinRoom.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/client/src/components/JoinRoom.tsx
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoom } from "../hooks/useRoom";

export function JoinRoom() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  const { joinRoom, room, error } = useRoom();

  const handleJoin = () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) return;
    joinRoom(trimmed);
  };

  // Redirect to lobby once joined
  if (room) {
    navigate(`/play/lobby/${room.code}`, { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm w-full space-y-6 text-center">
        <Button variant="ghost" size="sm" onClick={() => navigate("/play")}>
          <ArrowLeft className="size-4 mr-1" />
          Retour
        </Button>
        <h1 className="text-2xl font-bold">Rejoindre une partie</h1>
        <p className="text-muted-foreground">
          Entre le code de la room donné par le host.
        </p>
        <Input
          placeholder="Ex: A3K9F2"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="text-center text-2xl tracking-widest font-mono h-14"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          size="lg"
          className="w-full"
          onClick={handleJoin}
          disabled={code.trim().length !== 6}
        >
          Rejoindre
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/components/JoinRoom.tsx
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(client): add JoinRoom screen with code input"
```

---

## Task 9: MultiLobby Component

**Files:**
- Create: `apps/client/src/components/MultiLobby.tsx`
- Modify: `apps/client/package.json` (add qrcode)

- [ ] **Step 1: Install qrcode**

```bash
cd apps/client && bun add qrcode @types/qrcode
```

- [ ] **Step 2: Create the component**

```tsx
// apps/client/src/components/MultiLobby.tsx
import { Copy, Crown, Wifi, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePacks } from "../hooks/usePacks";
import { useRoom } from "../hooks/useRoom";
import type { GameMode } from "../types";
import { GAME_MODES } from "../types";

export function MultiLobby() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const {
    room,
    connected,
    error,
    isHost,
    gameStarting,
    joinRoom,
    leaveRoom,
    selectPack,
    selectMode,
    startGame,
  } = useRoom();
  const { data: packs = [] } = usePacks();
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  // Auto-join room if not already in it
  useEffect(() => {
    if (!room && code && connected) {
      joinRoom(code);
    }
  }, [room, code, connected, joinRoom]);

  // Connect if not connected
  useEffect(() => {
    if (!connected && code) {
      joinRoom(code);
    }
  }, [connected, code, joinRoom]);

  // Generate QR code
  useEffect(() => {
    if (!qrCanvasRef.current || !room) return;
    const joinUrl = `${window.location.origin}/join/${room.code}`;
    QRCode.toCanvas(qrCanvasRef.current, joinUrl, {
      width: 200,
      margin: 2,
      color: { dark: "#ffffff", light: "#00000000" },
    });
  }, [room]);

  // Redirect when game starts
  useEffect(() => {
    if (gameStarting) {
      navigate("/game");
    }
  }, [gameStarting, navigate]);

  const copyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Connexion à la room...
        </div>
      </div>
    );
  }

  const connectedPlayers = room.players.filter((p) => p.connected);
  const canStart = isHost && room.packSlug && room.mode && connectedPlayers.length >= 2;

  return (
    <div className="min-h-screen p-4 pt-20 max-w-4xl mx-auto">
      {/* Room code + QR */}
      <div className="text-center mb-8">
        <p className="text-sm text-muted-foreground mb-2">Code de la room</p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl font-mono font-bold tracking-widest text-glow-purple">
            {room.code}
          </span>
          <Button variant="ghost" size="icon" onClick={copyCode}>
            <Copy className="size-5" />
          </Button>
        </div>
        {copied && (
          <p className="text-xs text-party-green mt-1">Copié !</p>
        )}
        <canvas ref={qrCanvasRef} className="mx-auto mt-4" />
      </div>

      {/* Players list */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">
            Joueurs ({connectedPlayers.length}/{room.players.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {room.players.map((player) => (
              <div
                key={player.clerkId}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card/50"
              >
                {player.connected ? (
                  <Wifi className="size-4 text-party-green" />
                ) : (
                  <WifiOff className="size-4 text-destructive" />
                )}
                <span className="font-medium flex-1">
                  {player.username}
                  {player.gender === "homme" ? " ♂" : " ♀"}
                </span>
                {player.clerkId === room.hostClerkId && (
                  <Badge variant="secondary">
                    <Crown className="size-3 mr-1" />
                    Host
                  </Badge>
                )}
                {!player.connected && (
                  <Badge variant="destructive" className="text-xs">
                    Déconnecté
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Host config: pack + mode selection */}
      {isHost ? (
        <div className="space-y-6">
          {/* Pack selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Choisis un pack</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {packs.map((pack) => (
                  <button
                    type="button"
                    key={pack.slug}
                    onClick={() => selectPack(pack.slug)}
                    className={`bg-gradient-to-br ${pack.gradient} rounded-xl p-3 text-left transition-all ${
                      room.packSlug === pack.slug
                        ? "ring-2 ring-primary scale-[1.02]"
                        : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    <span className="text-2xl">{pack.icon}</span>
                    <p className="text-sm font-semibold text-white mt-1">
                      {pack.name}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Mode selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Choisis un mode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {GAME_MODES.map((mode) => (
                  <button
                    type="button"
                    key={mode.id}
                    onClick={() => selectMode(mode.id)}
                    className={`bg-gradient-to-br ${mode.gradient} rounded-xl p-4 text-center transition-all ${
                      room.mode === mode.id
                        ? "ring-2 ring-primary scale-[1.02]"
                        : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    <span className="text-2xl">{mode.icon}</span>
                    <p className="text-sm font-bold text-white mt-1">
                      {mode.name}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Launch button */}
          <Button
            size="lg"
            className="w-full py-6 text-lg glow-purple"
            disabled={!canStart}
            onClick={startGame}
          >
            Lancer la partie
          </Button>
          {!canStart && (
            <p className="text-xs text-muted-foreground text-center">
              {connectedPlayers.length < 2
                ? "Il faut au moins 2 joueurs"
                : !room.packSlug
                  ? "Choisis un pack"
                  : "Choisis un mode"}
            </p>
          )}
        </div>
      ) : (
        /* Non-host view */
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {room.packSlug && room.mode
                ? `Le host a choisi — en attente du lancement...`
                : "En attente de la configuration du host..."}
            </p>
            {room.packSlug && (
              <p className="mt-2 text-sm">
                Pack : <strong>{packs.find((p) => p.slug === room.packSlug)?.name ?? room.packSlug}</strong>
              </p>
            )}
            {room.mode && (
              <p className="text-sm">
                Mode : <strong>{GAME_MODES.find((m) => m.id === room.mode)?.name ?? room.mode}</strong>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leave button */}
      <div className="text-center mt-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            leaveRoom();
            navigate("/play");
          }}
        >
          Quitter la room
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive text-center mt-4">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/MultiLobby.tsx apps/client/package.json bun.lock
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(client): add MultiLobby with QR code, player list, host config"
```

---

## Task 10: Update Routing (App.tsx)

**Files:**
- Modify: `apps/client/src/App.tsx`
- Modify: `apps/client/index.ts` (already done in Task 5, verify routes match)

- [ ] **Step 1: Update App.tsx with new routes**

Replace the `AppRoutes` function in `apps/client/src/App.tsx`:

```tsx
// Add imports at the top:
import { ModeChoice } from "./components/ModeChoice";
import { MultiLobby } from "./components/MultiLobby";
import { JoinRoom } from "./components/JoinRoom";

// Replace AppRoutes:
function AppRoutes() {
  const navigate = useNavigate();

  useEffect(() => {
    setNavigate(navigate);
    useGameStore.getState().restoreFromStorage();
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/play"
        element={
          <AuthGuard>
            <InGameHeader />
            <ModeChoice />
          </AuthGuard>
        }
      />
      <Route
        path="/play/solo"
        element={
          <AuthGuard>
            <InGameHeader />
            <HomeScreen />
          </AuthGuard>
        }
      />
      <Route
        path="/play/create"
        element={
          <AuthGuard>
            <InGameHeader />
            <CreateRoom />
          </AuthGuard>
        }
      />
      <Route
        path="/play/join"
        element={
          <AuthGuard>
            <InGameHeader />
            <JoinRoom />
          </AuthGuard>
        }
      />
      <Route
        path="/play/lobby/:code"
        element={
          <AuthGuard>
            <InGameHeader />
            <MultiLobby />
          </AuthGuard>
        }
      />
      <Route
        path="/join/:code"
        element={
          <AuthGuard>
            <InGameHeader />
            <JoinRoom />
          </AuthGuard>
        }
      />
      <Route
        path="/game"
        element={
          <AuthGuard>
            <InGameHeader />
            <GameScreen />
          </AuthGuard>
        }
      />
      <Route
        path="/end"
        element={
          <AuthGuard>
            <InGameHeader />
            <EndScreen />
          </AuthGuard>
        }
      />
    </Routes>
  );
}
```

Also add a small `CreateRoom` inline component that auto-creates a room and redirects:

```tsx
function CreateRoom() {
  const { createRoom, room } = useRoom();
  const navigate = useNavigate();

  useEffect(() => {
    createRoom();
  }, [createRoom]);

  useEffect(() => {
    if (room) {
      navigate(`/play/lobby/${room.code}`, { replace: true });
    }
  }, [room, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Création de la room...</div>
    </div>
  );
}
```

Add the `useRoom` import at the top of App.tsx.

- [ ] **Step 2: Handle /join/:code in JoinRoom**

Update `JoinRoom.tsx` to also handle the `/join/:code` route (auto-fill code from URL params):

Add at the top of the component:

```tsx
const { code: urlCode } = useParams<{ code: string }>();

useEffect(() => {
  if (urlCode && urlCode.length === 6) {
    setCode(urlCode.toUpperCase());
    joinRoom(urlCode.toUpperCase());
  }
}, [urlCode, joinRoom]);
```

Import `useParams` from `react-router-dom`.

- [ ] **Step 3: Verify types and unit tests**

```bash
cd apps/client && bunx tsc --noEmit && bun test src/
```

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/App.tsx apps/client/src/components/JoinRoom.tsx
LEFTHOOK_EXCLUDE=e2e git commit -m "feat(client): wire all multi-device routes (create, join, lobby)"
```

---

## Task 11: Update E2E Tests

**Files:**
- Modify: `apps/client/tests/helpers/fixtures.ts`

- [ ] **Step 1: Update navigation in fixtures**

The `mockApp` fixture navigates to `/play` which now shows `ModeChoice`, not `HomeScreen`. Update it to navigate to `/play/solo`:

```ts
// In the mockApp fixture, change:
await page.goto("/play");
// To:
await page.goto("/play/solo");
```

- [ ] **Step 2: Run E2E tests**

```bash
cd apps/client && bunx playwright test
```

Fix any failures.

- [ ] **Step 3: Commit**

```bash
git add apps/client/tests/
LEFTHOOK_EXCLUDE=e2e git commit -m "test(e2e): update fixtures for /play/solo route"
```
