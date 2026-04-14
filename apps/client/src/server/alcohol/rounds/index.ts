import type { ServerRound, SpecialRoundType } from "../types";
import { courageRound } from "./courage";
import { distributeurRound } from "./distributeur";
import { petitBuveurRound } from "./petit-buveur";

export const roundRegistry = new Map<SpecialRoundType, ServerRound>([
  ["petit_buveur", petitBuveurRound],
  ["distributeur", distributeurRound],
  ["courage", courageRound],
]);
