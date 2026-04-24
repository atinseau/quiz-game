import type { ComponentType } from "react";
import { setClientRoundRegistry } from "../SpecialRoundOverlay";
import { Conseil } from "./Conseil";
import { Cupidon } from "./Cupidon";
import { Distributeur } from "./Distributeur";
import { LoveOrDrink } from "./LoveOrDrink";
import { QuestionDeCourage } from "./QuestionDeCourage";
import { ShowUs } from "./ShowUs";
import { SmatchOrPass } from "./SmatchOrPass";

interface RoundProps {
  data: Record<string, unknown>;
}

// `petit_buveur` is intentionally NOT registered: it has no card of its own —
// the only visible notification is the fullscreen `<DrinkAlert>` triggered by
// the server-side `drink_alert` broadcast. Registering it here would stack a
// second overlay behind the DrinkAlert and re-announce the loser after the
// alert auto-dismisses.
export const clientRoundRegistry = new Map<string, ComponentType<RoundProps>>([
  ["distributeur", Distributeur],
  ["courage", QuestionDeCourage],
  ["cupidon", Cupidon],
  ["conseil", Conseil],
  ["love_or_drink", LoveOrDrink],
  ["smatch_or_pass", SmatchOrPass],
  ["show_us", ShowUs],
]);

// Register with the overlay so it can render rounds
setClientRoundRegistry(clientRoundRegistry);
