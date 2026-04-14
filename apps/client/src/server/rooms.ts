import type { ServerWebSocket } from "bun";
import type {
  PlayerInfo,
  Room,
  RoomPlayer,
  RoomState,
  ServerMessage,
  WsData,
} from "./types";

const rooms = new Map<string, Room>();

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
    game: null,
  };

  rooms.set(code, room);
  send(ws, { type: "room_created", code });
  send(ws, { type: "room_joined", room: toRoomState(room) });
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
    send(ws, { type: "room_joined", room: toRoomState(room) });
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
  };

  room.players.set(clerkId, player);
  broadcast(
    room,
    { type: "player_joined", player: toPlayerInfo(player) },
    clerkId,
  );
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

    if (room.hostClerkId === clerkId) {
      const nextHost = Array.from(room.players.values()).find(
        (p) => p.connected,
      );
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

    if (room.hostClerkId === clerkId) {
      const nextHost = Array.from(room.players.values()).find(
        (p) => p.connected,
      );
      if (nextHost) {
        room.hostClerkId = nextHost.clerkId;
        broadcast(room, { type: "host_changed", clerkId: nextHost.clerkId });
      }
    }

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
      rooms.delete(code);
    }
  }
}, 5 * 60_000);
