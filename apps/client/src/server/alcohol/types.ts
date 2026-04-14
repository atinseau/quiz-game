import type { Room } from "../types";

export type SpecialRoundType =
  | "petit_buveur"
  | "distributeur"
  | "courage"
  | "conseil"
  | "love_or_drink"
  | "cupidon"
  | "show_us"
  | "smatch_or_pass";

export interface AlcoholConfig {
  enabled: boolean;
  frequency: number;
  enabledRounds: SpecialRoundType[];
  culSecEndGame: boolean;
}

export interface AlcoholState {
  config: AlcoholConfig;
  turnsSinceLastSpecial: number;
  specialRoundQueue: SpecialRoundType[];
  activeRound: SpecialRoundType | null;
}

export interface ServerRound {
  type: SpecialRoundType;
  start(room: Room, state: AlcoholState): void;
  handleMessage(
    room: Room,
    state: AlcoholState,
    clerkId: string,
    msg: Record<string, unknown>,
  ): void;
}

export const DEFAULT_ALCOHOL_CONFIG: AlcoholConfig = {
  enabled: false,
  frequency: 5,
  enabledRounds: ["petit_buveur", "distributeur", "courage"],
  culSecEndGame: true,
};
