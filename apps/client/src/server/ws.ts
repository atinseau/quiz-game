import type { ServerWebSocket } from "bun";
import { handleAlcoholMessage } from "./alcohol/framework";
import {
  startGame as startGameEngine,
  submitAnswer as submitAnswerEngine,
} from "./game-engine";
import {
  broadcast,
  createRoom,
  findRoomByPlayer,
  handleDisconnect,
  joinRoom,
  leaveRoom,
  toRoomState,
} from "./rooms";
import type { ClientMessage, WsData } from "./types";

function send(ws: ServerWebSocket<WsData>, msg: Record<string, unknown>) {
  ws.send(JSON.stringify(msg));
}

async function handleMessage(ws: ServerWebSocket<WsData>, raw: string) {
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
      leaveRoom(clerkId);
      createRoom(ws);
      break;
    }
    case "join_room": {
      leaveRoom(clerkId);
      joinRoom(ws, msg.code);
      break;
    }
    case "update_nickname": {
      const room = findRoomByPlayer(clerkId);
      if (!room) return;
      if (room.status !== "lobby") {
        send(ws, {
          type: "error",
          message: "Impossible de changer de nom en cours de partie",
        });
        return;
      }
      const nickname = (msg.nickname as string)?.trim();
      if (!nickname || nickname.length > 20) {
        send(ws, { type: "error", message: "Nom invalide (1-20 caractères)" });
        return;
      }
      const player = room.players.get(clerkId);
      if (player) {
        player.username = nickname;
        broadcast(room, {
          type: "player_updated",
          clerkId,
          username: player.username,
          gender: player.gender,
        });
      }
      break;
    }
    case "update_gender": {
      const room = findRoomByPlayer(clerkId);
      if (!room) return;
      if (room.status !== "lobby") {
        send(ws, {
          type: "error",
          message: "Impossible de changer de genre en cours de partie",
        });
        return;
      }
      const gender = msg.gender as string;
      if (gender !== "homme" && gender !== "femme") {
        send(ws, { type: "error", message: "Genre invalide" });
        return;
      }
      const player = room.players.get(clerkId);
      if (player) {
        player.gender = gender;
        broadcast(room, {
          type: "player_updated",
          clerkId,
          username: player.username,
          gender: player.gender,
        });
      }
      break;
    }
    case "select_pack": {
      const room = findRoomByPlayer(clerkId);
      if (!room || room.hostClerkId !== clerkId) {
        send(ws, {
          type: "error",
          message: "Seul le host peut choisir le pack",
        });
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
        send(ws, {
          type: "error",
          message: "Seul le host peut choisir le mode",
        });
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
        send(ws, {
          type: "error",
          message: "Seul le host peut lancer la partie",
        });
        return;
      }
      if (!room.packSlug || !room.mode) {
        send(ws, { type: "error", message: "Pack et mode requis" });
        return;
      }
      const connectedCount = Array.from(room.players.values()).filter(
        (p) => p.connected,
      ).length;
      if (connectedCount < 2) {
        send(ws, {
          type: "error",
          message: "Il faut au moins 2 joueurs connectés",
        });
        return;
      }
      if (msg.alcoholConfig) {
        room.alcoholConfig = msg.alcoholConfig;
      }
      room.status = "playing";
      broadcast(room, { type: "game_starting" });
      await startGameEngine(room);
      break;
    }
    case "submit_answer": {
      const room = findRoomByPlayer(clerkId);
      if (!room?.game) {
        send(ws, { type: "error", message: "Pas de partie en cours" });
        return;
      }
      submitAnswerEngine(room, clerkId, msg.answer);
      break;
    }
    case "leave_room": {
      leaveRoom(clerkId);
      break;
    }
    case "courage_choice":
    case "courage_answer":
    case "distribute_drink":
    case "conseil_vote":
    case "love_or_drink_choice":
    case "show_us_vote":
    case "show_us_reveal":
    case "smatch_choice": {
      const room = findRoomByPlayer(clerkId);
      if (!room?.game) {
        send(ws, { type: "error", message: "Pas de partie en cours" });
        return;
      }
      handleAlcoholMessage(room, clerkId, msg as Record<string, unknown>);
      break;
    }
    default: {
      send(ws, { type: "error", message: "Unknown message type" });
    }
  }
}

export const websocketHandlers = {
  open(ws: ServerWebSocket<WsData>) {
    console.log(`[ws] Connected: ${ws.data.username} (${ws.data.clerkId})`);
    const room = findRoomByPlayer(ws.data.clerkId);
    if (room) {
      const player = room.players.get(ws.data.clerkId);
      if (player && !player.connected) {
        player.ws = ws;
        player.connected = true;
        player.disconnectedAt = null;
        ws.send(
          JSON.stringify({
            type: "room_joined",
            room: toRoomState(room),
            yourClerkId: ws.data.clerkId,
          }),
        );
        broadcast(
          room,
          { type: "player_reconnected", clerkId: ws.data.clerkId },
          ws.data.clerkId,
        );
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
