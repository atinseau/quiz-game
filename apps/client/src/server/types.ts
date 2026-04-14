import type { ServerWebSocket } from "bun";
import type { GameMode } from "../types";
import type {
  AlcoholConfig,
  AlcoholState,
  SpecialRoundType,
} from "./alcohol/types";

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

// --- Game Engine Types ---

export interface QuestionWithoutAnswer {
  type: "qcm" | "vrai_faux" | "texte";
  text: string;
  choices?: string[];
  category: string;
}

export interface QuestionFull extends QuestionWithoutAnswer {
  answer: string;
}

export interface PlayerResult {
  clerkId: string;
  answered: boolean;
  correct: boolean;
  stole: boolean;
  pointsDelta: number;
}

export interface TurnResult {
  correctAnswer: string | boolean;
  playerResults: PlayerResult[];
  scores: Record<string, number>;
  combos: Record<string, number>;
}

export interface RankingEntry {
  clerkId: string;
  username: string;
  score: number;
  rank: number;
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
  status: "lobby" | "playing";
  packSlug: string | null;
  mode: GameMode | null;
  game: GameState | null;
  alcoholConfig: AlcoholConfig | null;
}

export type ClientMessage =
  | { type: "create_room" }
  | { type: "join_room"; code: string }
  | { type: "select_pack"; packSlug: string }
  | { type: "select_mode"; mode: GameMode }
  | { type: "start_game"; alcoholConfig?: AlcoholConfig }
  | { type: "leave_room" }
  | { type: "submit_answer"; answer: string | boolean }
  | { type: "courage_choice"; accept: boolean }
  | { type: "courage_answer"; answer: string | boolean }
  | { type: "distribute_drink"; targetClerkId: string };

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
  | { type: "room_joined"; room: RoomState; yourClerkId: string }
  | { type: "player_joined"; player: PlayerInfo }
  | { type: "player_left"; clerkId: string }
  | { type: "player_disconnected"; clerkId: string }
  | { type: "player_reconnected"; clerkId: string }
  | { type: "host_changed"; clerkId: string }
  | { type: "pack_selected"; packSlug: string }
  | { type: "mode_selected"; mode: GameMode }
  | { type: "game_starting" }
  | { type: "error"; message: string }
  | {
      type: "question";
      index: number;
      currentPlayerClerkId: string;
      question: QuestionWithoutAnswer;
      startsAt: number;
    }
  | { type: "player_answered"; clerkId: string }
  | { type: "turn_result"; results: TurnResult }
  | {
      type: "game_over";
      scores: Record<string, number>;
      rankings: RankingEntry[];
    }
  | {
      type: "special_round_start";
      roundType: SpecialRoundType;
      data: Record<string, unknown>;
    }
  | {
      type: "drink_alert";
      targetClerkId: string;
      emoji: string;
      message: string;
    }
  | { type: "courage_decision"; playerClerkId: string; countdown: number }
  | { type: "courage_question"; question: QuestionWithoutAnswer }
  | { type: "courage_result"; correct: boolean; pointsDelta: number }
  | { type: "distribute_prompt"; distributorClerkId: string; remaining: number }
  | { type: "special_round_end" };
