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

export type ClientMessage =
  | { type: "create_room" }
  | { type: "join_room"; code: string }
  | { type: "select_pack"; packSlug: string }
  | { type: "select_mode"; mode: GameMode }
  | { type: "start_game" }
  | { type: "leave_room" };

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
