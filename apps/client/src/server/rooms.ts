import type { ServerWebSocket } from "bun";
import {
  cleanupConseilRoom,
  getConseilSnapshot,
} from "./alcohol/rounds/conseil";
import { clearChronoTimer, onPlayerLeft } from "./game-engine";
import type {
  PlayerInfo,
  Room,
  RoomPlayer,
  RoomState,
  ServerMessage,
  WsData,
} from "./types";

const rooms = new Map<string, Room>();

/** Reverse index: clerkId → room code for O(1) lookups. */
const playerToRoom = new Map<string, string>();

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let code: string;
  do {
    code = Array.from(
      { length: 6 },
      () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
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

function reassignHost(room: Room, oldHostId: string): void {
  if (room.hostClerkId !== oldHostId) return;
  const nextHost = Array.from(room.players.values()).find((p) => p.connected);
  if (nextHost) {
    room.hostClerkId = nextHost.clerkId;
    broadcast(room, { type: "host_changed", clerkId: nextHost.clerkId });
  }
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

/**
 * Build the optional conseilSnapshot attached to a `room_joined` payload
 * when the active round is "conseil". Returns `undefined` in every other
 * case so reconnecting clients don't receive stale tiebreaker data.
 */
function conseilSnapshotForRoom(room: Room) {
  if (room.game?.alcoholState?.activeRound !== "conseil") return undefined;
  return getConseilSnapshot(room.code) ?? undefined;
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
    graceTimer: null,
  };

  const room: Room = {
    code,
    hostClerkId: clerkId,
    players: new Map([[clerkId, player]]),
    status: "lobby",
    packSlug: null,
    mode: null,
    game: null,
    alcoholConfig: null,
    endedAt: null,
    nextQuestionTimer: null,
  };

  rooms.set(code, room);
  playerToRoom.set(clerkId, code);
  send(ws, { type: "room_created", code });
  send(ws, {
    type: "room_joined",
    room: toRoomState(room),
    yourClerkId: ws.data.clerkId,
    conseilSnapshot: conseilSnapshotForRoom(room),
  });
  return room;
}

export function joinRoom(
  ws: ServerWebSocket<WsData>,
  code: string,
): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) {
    send(ws, { type: "error", message: "Room introuvable" });
    return null;
  }

  const { clerkId, username, gender } = ws.data;

  const existing = room.players.get(clerkId);
  if (existing) {
    existing.ws = ws;
    existing.connected = true;
    existing.disconnectedAt = null;
    send(ws, {
      type: "room_joined",
      room: toRoomState(room),
      yourClerkId: ws.data.clerkId,
      conseilSnapshot: conseilSnapshotForRoom(room),
    });
    broadcast(room, { type: "player_reconnected", clerkId }, clerkId);
    return room;
  }

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
    graceTimer: null,
  };

  room.players.set(clerkId, player);
  playerToRoom.set(clerkId, room.code);
  broadcast(
    room,
    { type: "player_joined", player: toPlayerInfo(player) },
    clerkId,
  );
  send(ws, {
    type: "room_joined",
    room: toRoomState(room),
    yourClerkId: ws.data.clerkId,
    conseilSnapshot: conseilSnapshotForRoom(room),
  });
  return room;
}

export function leaveRoom(clerkId: string): void {
  const code = playerToRoom.get(clerkId);
  if (!code) return;

  const room = rooms.get(code);
  if (!room?.players.has(clerkId)) {
    playerToRoom.delete(clerkId);
    return;
  }

  room.players.delete(clerkId);
  playerToRoom.delete(clerkId);
  broadcast(room, { type: "player_left", clerkId });

  if (room.players.size === 0) {
    deleteRoom(code);
    return;
  }

  reassignHost(room, clerkId);
  if (room.game) onPlayerLeft(room, clerkId);
}

export function handleDisconnect(clerkId: string): void {
  const code = playerToRoom.get(clerkId);
  if (!code) return;

  const room = rooms.get(code);
  if (!room) {
    playerToRoom.delete(clerkId);
    return;
  }

  const player = room.players.get(clerkId);
  if (!player) {
    playerToRoom.delete(clerkId);
    return;
  }

  player.ws = null;
  player.connected = false;
  player.disconnectedAt = Date.now();
  broadcast(room, { type: "player_disconnected", clerkId });

  reassignHost(room, clerkId);

  setTimeout(() => {
    const current = room.players.get(clerkId);
    if (current && !current.connected) {
      room.players.delete(clerkId);
      playerToRoom.delete(clerkId);
      broadcast(room, { type: "player_left", clerkId });
      if (room.players.size === 0) {
        deleteRoom(code);
        return;
      }
      if (room.game) onPlayerLeft(room, clerkId);
    }
  }, 60_000);
}

export function findRoomByPlayer(clerkId: string): Room | undefined {
  const code = playerToRoom.get(clerkId);
  if (!code) return undefined;
  return rooms.get(code);
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

/**
 * Single chokepoint for room removal. Clears every timer attached to the room
 * (chrono, scheduleNextQuestion, per-player grace) and removes the reverse
 * index entries. Safe to call on an unknown code.
 */
export function deleteRoom(code: string): void {
  const room = rooms.get(code);
  if (!room) return;

  if (room.nextQuestionTimer) {
    clearTimeout(room.nextQuestionTimer);
    room.nextQuestionTimer = null;
  }

  for (const player of room.players.values()) {
    if (player.graceTimer) {
      clearTimeout(player.graceTimer);
      player.graceTimer = null;
    }
    playerToRoom.delete(player.clerkId);
  }

  clearChronoTimer(code);
  cleanupConseilRoom(code);
  rooms.delete(code);
}

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.status !== "lobby") continue;
    const allDisconnected = Array.from(room.players.values()).every(
      (p) =>
        !p.connected &&
        p.disconnectedAt &&
        now - p.disconnectedAt > 10 * 60_000,
    );
    if (room.players.size === 0 || allDisconnected) {
      deleteRoom(code);
    }
  }
}, 5 * 60_000);
