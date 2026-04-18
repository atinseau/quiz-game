import type { ServerWebSocket } from "bun";
import type { Gender, QuestionWithoutAnswer } from "../shared/types";
import type { GameMode } from "../types";
import type { AlcoholConfig, AlcoholState } from "./alcohol/types";

// Re-export shared types so existing server imports keep working
export type {
  Gender,
  PlayerInfo,
  PlayerResult,
  QuestionWithoutAnswer,
  RankingEntry,
  RoomState,
  ServerMessage,
  TurnResult,
} from "../shared/types";

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
  graceTimer: ReturnType<typeof setTimeout> | null;
}

// --- Game Engine Types ---

export interface QuestionFull extends QuestionWithoutAnswer {
  answer: string;
}

export interface GameState {
  questions: QuestionFull[];
  currentQuestionIndex: number;
  currentPlayerIndex: number;
  scores: Record<string, number>;
  combos: Record<string, number>;
  answers: Map<string, string | boolean>;
  questionStartedAt: number;
  resolved: boolean;
  alcoholState: AlcoholState | null;
}

export interface Room {
  code: string;
  hostClerkId: string;
  players: Map<string, RoomPlayer>;
  status: "lobby" | "playing" | "ended";
  packSlug: string | null;
  mode: GameMode | null;
  game: GameState | null;
  alcoholConfig: AlcoholConfig | null;
  endedAt: number | null;
  nextQuestionTimer: ReturnType<typeof setTimeout> | null;
}

export type ClientMessage =
  | { type: "create_room" }
  | { type: "join_room"; code: string }
  | { type: "select_pack"; packSlug: string }
  | { type: "select_mode"; mode: GameMode }
  | { type: "start_game"; alcoholConfig?: AlcoholConfig }
  | { type: "leave_room" }
  | { type: "update_nickname"; nickname: string }
  | { type: "update_gender"; gender: Gender }
  | { type: "submit_answer"; answer: string | boolean }
  | { type: "courage_choice"; accept: boolean }
  | { type: "courage_answer"; answer: string | boolean }
  | { type: "distribute_drink"; targetClerkId: string }
  | { type: "conseil_vote"; targetClerkId: string }
  | { type: "love_or_drink_choice"; choice: "bisou" | "cul_sec" }
  | { type: "show_us_vote"; color: string }
  | { type: "show_us_reveal"; color: string }
  | { type: "smatch_choice"; choice: "smatch" | "pass" };
