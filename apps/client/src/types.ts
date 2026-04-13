export type Gender = "homme" | "femme";

export interface Player {
  name: string;
  gender: Gender;
}

export type QuestionType = "qcm" | "vrai_faux" | "texte";

export interface Question {
  type: QuestionType;
  question: string;
  choices?: string[];
  answer: string | boolean;
  category: string;
}

export interface RawQuestionData {
  [category: string]: Omit<Question, "category">[];
}
export type GameMode = "classic" | "voleur" | "chrono";

export interface GameModeInfo {
  id: GameMode;
  name: string;
  description: string;
  icon: string;
  gradient: string;
}

export const GAME_MODES: GameModeInfo[] = [
  {
    id: "classic",
    name: "Classique",
    description: "Chacun son tour, pas de vol. Une réponse par joueur.",
    icon: "🎯",
    gradient: "from-indigo-600 to-blue-700",
  },
  {
    id: "voleur",
    name: "Voleur",
    description: "Les autres joueurs peuvent voler la réponse avant toi.",
    icon: "🦹",
    gradient: "from-amber-600 to-red-700",
  },
  {
    id: "chrono",
    name: "Contre la montre",
    description:
      "Réponds avant la fin du temps ! +1 si correct, -0.5 si timeout.",
    icon: "⏱️",
    gradient: "from-rose-600 to-pink-700",
  },
];

export const CHRONO_DURATION = 15; // seconds
export const CHRONO_TIMEOUT_PENALTY = 0.5;

export interface GameState {
  players: Player[];
  scores: Record<string, number>;
  combos: Record<string, number>;
  questions: Question[];
  currentQuestionIndex: number;
  currentPlayerIndex: number;
  selectedPackSlug: string | null;
  gameMode?: GameMode;
}

export interface FeedbackState {
  visible: boolean;
  type: "success" | "error" | "warning" | "neutral";
  text: string;
  html?: string;
}

export interface PackMeta {
  file: string;
  name: string;
  description: string;
  icon: string;
  gradient: string;
  questionCount?: number;
}

export interface ApiPack {
  documentId: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  gradient: string;
  isFree: boolean;
  published: boolean;
  displayOrder: number;
  questionCount?: number;
}

export const MAX_COMBO = 5;
export const BLIND_MULTIPLIER = 2;
export const STEAL_GAIN = 0.5;
export const STEAL_LOSS = 0.5;
export const STEAL_FAIL_PENALTY = 1;
