import { create } from "zustand";

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

export interface DrinkAlertData {
  id: string;
  emoji: string;
  message: string;
}

interface AlcoholStore {
  config: AlcoholConfig;
  turnsSinceLastSpecial: number;
  specialRoundQueue: SpecialRoundType[];
  activeRound: SpecialRoundType | null;
  activeRoundData: Record<string, unknown> | null;
  drinkAlerts: DrinkAlertData[];
  cupidLinks: [string, string][];

  setConfig: (config: AlcoholConfig) => void;
  checkTrigger: () => SpecialRoundType | null;
  setActiveRound: (
    type: SpecialRoundType | null,
    data?: Record<string, unknown>,
  ) => void;
  endActiveRound: () => void;
  addDrinkAlert: (alert: Omit<DrinkAlertData, "id">) => void;
  removeDrinkAlert: (id: string) => void;
  reset: () => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j] as T;
    a[j] = tmp as T;
  }
  return a;
}

const AVAILABLE_ROUNDS: SpecialRoundType[] = [
  "petit_buveur",
  "distributeur",
  "courage",
  "conseil",
  "love_or_drink",
  "cupidon",
  "show_us",
  "smatch_or_pass",
];

export const useAlcoholStore = create<AlcoholStore>((set, get) => ({
  config: {
    enabled: false,
    frequency: 5,
    enabledRounds: [
      "petit_buveur",
      "distributeur",
      "courage",
      "conseil",
      "love_or_drink",
      "cupidon",
      "show_us",
      "smatch_or_pass",
    ],
    culSecEndGame: true,
  },
  turnsSinceLastSpecial: 0,
  specialRoundQueue: [],
  activeRound: null,
  activeRoundData: null,
  drinkAlerts: [],
  cupidLinks: [],

  setConfig: (config) =>
    set({
      config,
      specialRoundQueue: shuffleArray(
        config.enabledRounds.filter((r) => AVAILABLE_ROUNDS.includes(r)),
      ),
      turnsSinceLastSpecial: 0,
    }),

  checkTrigger: () => {
    const state = get();
    if (!state.config.enabled) return null;
    const next = state.turnsSinceLastSpecial + 1;
    if (next < state.config.frequency) {
      set({ turnsSinceLastSpecial: next });
      return null;
    }
    let queue = [...state.specialRoundQueue];
    if (queue.length === 0) {
      queue = shuffleArray(
        state.config.enabledRounds.filter((r) => AVAILABLE_ROUNDS.includes(r)),
      );
    }
    const roundType = queue.shift() ?? null;
    set({ turnsSinceLastSpecial: 0, specialRoundQueue: queue });
    return roundType;
  },

  setActiveRound: (type, data) =>
    set({ activeRound: type, activeRoundData: data ?? null }),
  endActiveRound: () => set({ activeRound: null, activeRoundData: null }),

  addDrinkAlert: (alert) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((s) => ({ drinkAlerts: [...s.drinkAlerts, { ...alert, id }] }));
  },

  removeDrinkAlert: (id) =>
    set((s) => ({ drinkAlerts: s.drinkAlerts.filter((a) => a.id !== id) })),

  reset: () =>
    set({
      turnsSinceLastSpecial: 0,
      specialRoundQueue: [],
      activeRound: null,
      activeRoundData: null,
      drinkAlerts: [],
      cupidLinks: [],
    }),
}));
