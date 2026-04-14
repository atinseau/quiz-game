import type { ComponentType } from "react";
import { setClientRoundRegistry } from "../SpecialRoundOverlay";
import { Conseil } from "./Conseil";
import { Cupidon } from "./Cupidon";
import { Distributeur } from "./Distributeur";
import { LoveOrDrink } from "./LoveOrDrink";
import { PetitBuveur } from "./PetitBuveur";
import { QuestionDeCourage } from "./QuestionDeCourage";

interface RoundProps {
  data: Record<string, unknown>;
}

export const clientRoundRegistry = new Map<string, ComponentType<RoundProps>>([
  ["petit_buveur", PetitBuveur],
  ["distributeur", Distributeur],
  ["courage", QuestionDeCourage],
  ["cupidon", Cupidon],
  ["conseil", Conseil],
  ["love_or_drink", LoveOrDrink],
]);

// Register with the overlay so it can render rounds
setClientRoundRegistry(clientRoundRegistry);
