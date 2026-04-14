import type { ServerRound, SpecialRoundType } from "../types";
import { conseilRound } from "./conseil";
import { courageRound } from "./courage";
import { cupidonRound } from "./cupidon";
import { distributeurRound } from "./distributeur";
import { loveOrDrinkRound } from "./love-or-drink";
import { petitBuveurRound } from "./petit-buveur";

export const roundRegistry = new Map<SpecialRoundType, ServerRound>([
  ["petit_buveur", petitBuveurRound],
  ["distributeur", distributeurRound],
  ["courage", courageRound],
  ["cupidon", cupidonRound],
  ["conseil", conseilRound],
  ["love_or_drink", loveOrDrinkRound],
]);
