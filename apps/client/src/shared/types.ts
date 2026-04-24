// Shared types used by both server and client code.
// Server-only types (Room, GameState, WsData, RoomPlayer, ClientMessage) stay in server/types.ts.

import type { SpecialRoundType } from "../server/alcohol/types";
import type { GameMode } from "../types";

export type Gender = "homme" | "femme";

export interface QuestionWithoutAnswer {
  type: "qcm" | "vrai_faux" | "texte";
  text: string;
  choices?: string[];
  category: string;
}

export interface PlayerResult {
  clerkId: string;
  answered: boolean;
  correct: boolean;
  stole: boolean;
  pointsDelta: number;
  answer?: string | boolean;
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
  status: "lobby" | "playing" | "ended";
  packSlug: string | null;
  mode: GameMode | null;
}

/**
 * Discriminated union for extra context attached to a `drink_alert`. Each
 * special round can add its own `kind` to enrich the fullscreen alert
 * without bloating the core message shape — the DrinkAlert component picks
 * the matching renderer by `kind`.
 */
export type DrinkAlertDetails = {
  kind: "courage";
  givenAnswer: string;
  correctAnswer: string;
};

export type ServerMessage =
  | { type: "room_created"; code: string }
  | { type: "room_joined"; room: RoomState; yourClerkId: string }
  | { type: "player_joined"; player: PlayerInfo }
  | { type: "player_left"; clerkId: string }
  | { type: "player_disconnected"; clerkId: string }
  | { type: "player_reconnected"; clerkId: string }
  | { type: "host_changed"; clerkId: string }
  | {
      type: "player_updated";
      clerkId: string;
      username: string;
      gender: Gender;
    }
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
  | { type: "game_aborted"; reason: "not_enough_players" }
  | {
      type: "special_round_start";
      roundType: SpecialRoundType;
      data: Record<string, unknown>;
    }
  | {
      type: "drink_alert";
      targetClerkIds: string[]; // qui doit agir (1..N) — client formate self vs others
      emoji: string;
      action: string; // "boire une gorgée", "faire un cul-sec", "boire 3 gorgées"
      details?: DrinkAlertDetails;
    }
  | { type: "courage_decision"; playerClerkId: string; countdown: number }
  | { type: "courage_question"; question: QuestionWithoutAnswer }
  | {
      type: "courage_result";
      correct: boolean;
      pointsDelta: number;
      givenAnswer: string | boolean;
      correctAnswer: string | boolean;
    }
  | { type: "distribute_prompt"; distributorClerkId: string; remaining: number }
  | { type: "special_round_end" }
  | {
      type: "conseil_result";
      votes: Record<string, string>;
      loserClerkIds: string[];
    }
  | {
      type: "conseil_tiebreaker";
      tiedClerkIds: string[]; // 2..N — les ex æquo, ordre stable
      selectedClerkId: string; // perdant tiré par shuffleArray côté serveur
      spinDurationMs: number; // ex. 4000
    }
  | { type: "show_us_all_voted" }
  | {
      type: "show_us_result";
      correctColor: string | null;
      wrongClerkIds: string[];
      timedOut?: boolean;
    }
  | {
      type: "love_or_drink_result";
      choice: "bisou" | "cul_sec";
      players: { clerkId: string; username: string }[];
    }
  | {
      type: "smatch_or_pass_result";
      decideur: { clerkId: string; username: string; gender: string };
      receveur: { clerkId: string; username: string; gender: string };
      choice: "smatch" | "pass";
    };
