import { create } from "zustand";
import { fetchPackQuestions } from "../lib/queries/questions";
import type { FeedbackState, GameMode, Player, Question } from "../types";
import {
  BLIND_MULTIPLIER,
  CHRONO_DURATION,
  CHRONO_TIMEOUT_PENALTY,
  MAX_COMBO,
  STEAL_FAIL_PENALTY,
  STEAL_GAIN,
  STEAL_LOSS,
} from "../types";
import { fireCorrectAnswer } from "../utils/confetti";
import { checkAnswer, fuzzyMatch } from "../utils/fuzzyMatch";
import { sounds } from "../utils/sounds";
import { clearGameState, loadGameState, saveGameState } from "../utils/storage";
import { usePackStore } from "./packStore";
import { usePlayerStore } from "./playerStore";
import { getNavigate } from "./router";

// --- Helpers ---

function randomizeQuestion(questions: Question[], idx: number): void {
  if (idx >= questions.length) return;
  const q = questions[idx];
  if (!q?.choices) return;
  const arr = [...q.choices];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j] as string;
    arr[j] = tmp as string;
  }
  questions[idx] = { ...q, choices: arr };
}

function formatCorrectAnswer(q: Question): string {
  if (q.type === "vrai_faux") return q.answer === true ? "Vrai" : "Faux";
  return String(q.answer);
}

// --- Store ---

interface GameStoreState {
  questions: Question[];
  currentQuestionIndex: number;
  currentPlayerIndex: number;
  scores: Record<string, number>;
  combos: Record<string, number>;
  answered: boolean;
  blindMode: boolean;
  feedback: FeedbackState;
  showForceBtn: boolean;
  stealConfirmMode: boolean;
  pendingStealer: string | null;
  gameMode: GameMode;
  timeLeft: number;
  _timerRef: ReturnType<typeof setInterval> | null;

  // Derived
  currentQuestion: () => Question | null;
  currentPlayer: () => Player;
  totalQuestions: () => number;
  isSolo: () => boolean;
  canSteal: () => boolean;

  // Timer
  _startTimer: () => void;
  _stopTimer: () => void;
  _handleTimeout: () => void;

  // Persistence
  _persist: () => void;

  // Actions
  startGame: (packSlug: string, mode: GameMode) => Promise<void>;
  submitAnswer: (answer: string | boolean) => void;
  submitBlindAnswer: (input: string) => void;
  revealChoices: () => void;
  initiateSteal: (stealer: string) => void;
  confirmSteal: (valid: boolean) => void;
  forcePoint: () => void;
  nextQuestion: () => void;
  reset: () => void;
  restoreFromStorage: () => boolean;
}

const initialFeedback: FeedbackState = {
  visible: false,
  type: "neutral",
  text: "",
};

export const useGameStore = create<GameStoreState>((set, get) => ({
  questions: [],
  currentQuestionIndex: 0,
  currentPlayerIndex: 0,
  scores: {},
  combos: {},
  answered: false,
  blindMode: false,
  feedback: initialFeedback,
  showForceBtn: false,
  stealConfirmMode: false,
  pendingStealer: null,
  gameMode: "classic",
  timeLeft: CHRONO_DURATION,
  _timerRef: null,

  // --- Derived ---
  currentQuestion: () => {
    const { questions, currentQuestionIndex } = get();
    return questions[currentQuestionIndex] ?? null;
  },

  currentPlayer: () => {
    const { currentPlayerIndex } = get();
    const players = usePlayerStore.getState().players;
    return (
      players[currentPlayerIndex] ?? { name: "", gender: "homme" as const }
    );
  },

  totalQuestions: () => get().questions.length,

  isSolo: () => usePlayerStore.getState().players.length <= 1,

  canSteal: () => {
    const { gameMode, answered } = get();
    return (
      gameMode === "voleur" &&
      answered &&
      usePlayerStore.getState().players.length > 1
    );
  },

  // --- Timer ---
  _startTimer: () => {
    get()._stopTimer();
    set({ timeLeft: CHRONO_DURATION });
    const ref = setInterval(() => {
      const { timeLeft } = get();
      if (timeLeft <= 1) {
        get()._handleTimeout();
      } else {
        set({ timeLeft: timeLeft - 1 });
      }
    }, 1000);
    set({ _timerRef: ref });
  },

  _stopTimer: () => {
    const { _timerRef } = get();
    if (_timerRef) {
      clearInterval(_timerRef);
      set({ _timerRef: null });
    }
  },

  _handleTimeout: () => {
    get()._stopTimer();
    const player = get().currentPlayer().name;
    const q = get().currentQuestion();
    if (!q) return;

    const scores = { ...get().scores };
    scores[player] = (scores[player] ?? 0) - CHRONO_TIMEOUT_PENALTY;

    sounds.fail();
    set({
      scores,
      combos: { ...get().combos, [player]: 0 },
      answered: true,
      feedback: {
        visible: true,
        type: "error",
        text: `Temps écoulé ! La réponse était : ${formatCorrectAnswer(q)}`,
      },
    });
    get()._persist();
  },

  // --- Persistence ---
  _persist: () => {
    const {
      questions,
      currentQuestionIndex,
      currentPlayerIndex,
      scores,
      combos,
      gameMode,
    } = get();
    const players = usePlayerStore.getState().players;
    const selectedPackSlug = usePackStore.getState().selectedPack?.slug ?? null;
    saveGameState({
      players,
      scores,
      combos,
      questions,
      currentQuestionIndex,
      currentPlayerIndex,
      selectedPackSlug,
      gameMode,
    });
  },

  // --- Actions ---
  startGame: async (packSlug: string, mode: GameMode) => {
    const questions = await fetchPackQuestions(packSlug);

    // Shuffle all questions (Fisher-Yates)
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = questions[i];
      questions[i] = questions[j] as Question;
      questions[j] = tmp as Question;
    }

    // Randomize choices of first question
    randomizeQuestion(questions, 0);

    const players = usePlayerStore.getState().players;
    const scores: Record<string, number> = {};
    const combos: Record<string, number> = {};
    for (const p of players) {
      scores[p.name] = 0;
      combos[p.name] = 0;
    }

    set({
      questions,
      currentQuestionIndex: 0,
      currentPlayerIndex: 0,
      scores,
      combos,
      answered: false,
      blindMode: false,
      feedback: initialFeedback,
      showForceBtn: false,
      stealConfirmMode: false,
      pendingStealer: null,
      gameMode: mode,
      timeLeft: CHRONO_DURATION,
    });

    get()._persist();

    if (mode === "chrono") get()._startTimer();

    getNavigate()("/game");
  },

  submitAnswer: (answer: string | boolean) => {
    const {
      currentQuestion: getCQ,
      currentPlayer: getCP,
      answered,
      gameMode,
    } = get();
    if (answered) return;

    const q = getCQ();
    if (!q) return;
    const player = getCP().name;
    const correct = checkAnswer(answer, q);

    const scores = { ...get().scores };
    const combos = { ...get().combos };

    if (correct) {
      const combo = Math.min((combos[player] ?? 0) + 1, MAX_COMBO);
      combos[player] = combo;
      const points = 1 + (combo - 1) * 0.5;
      scores[player] = (scores[player] ?? 0) + points;
      sounds.win();
      fireCorrectAnswer();
      set({
        scores,
        combos,
        answered: true,
        feedback: {
          visible: true,
          type: "success",
          text:
            combo > 1
              ? `Correct ! Combo x${combo} (+${points} pts)`
              : "Correct ! +1 pt",
        },
        showForceBtn: false,
      });
    } else {
      combos[player] = 0;
      sounds.fail();
      set({
        scores,
        combos,
        answered: true,
        feedback: {
          visible: true,
          type: "error",
          text: `Mauvaise réponse ! C'était : ${formatCorrectAnswer(q)}`,
        },
        showForceBtn: gameMode !== "voleur",
      });
    }

    if (gameMode === "chrono") get()._stopTimer();
    get()._persist();
  },

  submitBlindAnswer: (input: string) => {
    const { currentQuestion: getCQ, currentPlayer: getCP, answered } = get();
    if (answered) return;

    const q = getCQ();
    if (!q || q.type !== "qcm" || !q.choices) return;
    const player = getCP().name;

    const correct = fuzzyMatch(input, String(q.answer));

    const scores = { ...get().scores };
    const combos = { ...get().combos };

    if (correct) {
      const combo = Math.min((combos[player] ?? 0) + 1, MAX_COMBO);
      combos[player] = combo;
      const basePoints = 1 + (combo - 1) * 0.5;
      const points = basePoints * BLIND_MULTIPLIER;
      scores[player] = (scores[player] ?? 0) + points;
      sounds.win();
      fireCorrectAnswer();
      set({
        scores,
        combos,
        answered: true,
        blindMode: false,
        feedback: {
          visible: true,
          type: "success",
          text: `Blind correct ! x${BLIND_MULTIPLIER} → +${points} pts`,
        },
        showForceBtn: false,
      });
    } else {
      combos[player] = 0;
      sounds.fail();
      set({
        scores,
        combos,
        answered: true,
        blindMode: false,
        feedback: {
          visible: true,
          type: "error",
          text: `Raté en blind ! La réponse était : ${formatCorrectAnswer(q)}`,
        },
        showForceBtn: false,
      });
    }

    get()._persist();
  },

  revealChoices: () => {
    set({ blindMode: false });
  },

  initiateSteal: (stealer: string) => {
    set({ stealConfirmMode: true, pendingStealer: stealer });
  },

  confirmSteal: (valid: boolean) => {
    const { pendingStealer, currentPlayer: getCP } = get();
    if (!pendingStealer) return;

    const victim = getCP().name;
    const scores = { ...get().scores };
    const combos = { ...get().combos };

    if (valid) {
      scores[pendingStealer] = (scores[pendingStealer] ?? 0) + STEAL_GAIN;
      scores[victim] = (scores[victim] ?? 0) - STEAL_LOSS;
      sounds.steal();
      set({
        scores,
        stealConfirmMode: false,
        pendingStealer: null,
        feedback: {
          visible: true,
          type: "warning",
          text: `${pendingStealer} vole ${STEAL_GAIN} pt à ${victim} !`,
        },
      });
    } else {
      scores[pendingStealer] =
        (scores[pendingStealer] ?? 0) - STEAL_FAIL_PENALTY;
      combos[pendingStealer] = 0;
      sounds.fail();
      set({
        scores,
        combos,
        stealConfirmMode: false,
        pendingStealer: null,
        feedback: {
          visible: true,
          type: "error",
          text: `Vol raté ! ${pendingStealer} perd ${STEAL_FAIL_PENALTY} pt.`,
        },
      });
    }

    get()._persist();
  },

  forcePoint: () => {
    const player = get().currentPlayer().name;
    const scores = { ...get().scores };
    const combos = { ...get().combos };

    const combo = Math.min((combos[player] ?? 0) + 1, MAX_COMBO);
    combos[player] = combo;
    const points = 1 + (combo - 1) * 0.5;
    scores[player] = (scores[player] ?? 0) + points;

    sounds.win();
    fireCorrectAnswer();
    set({
      scores,
      combos,
      showForceBtn: false,
      feedback: {
        visible: true,
        type: "success",
        text:
          combo > 1
            ? `Point forcé ! Combo x${combo} (+${points} pts)`
            : "Point forcé ! +1 pt",
      },
    });

    get()._persist();
  },

  nextQuestion: () => {
    get()._stopTimer();
    const { currentQuestionIndex, questions } = get();
    const nextIdx = currentQuestionIndex + 1;

    if (nextIdx >= questions.length) {
      // Game over
      const slug = usePackStore.getState().selectedPack?.slug;
      if (slug) usePackStore.getState().markCompleted(slug);
      clearGameState();
      getNavigate()("/end");
      return;
    }

    const players = usePlayerStore.getState().players;
    const nextPlayerIdx = (get().currentPlayerIndex + 1) % players.length;

    randomizeQuestion(questions, nextIdx);

    set({
      currentQuestionIndex: nextIdx,
      currentPlayerIndex: nextPlayerIdx,
      answered: false,
      blindMode: false,
      feedback: initialFeedback,
      showForceBtn: false,
      stealConfirmMode: false,
      pendingStealer: null,
      questions: [...questions],
    });

    if (get().gameMode === "chrono") get()._startTimer();
    get()._persist();
  },

  reset: () => {
    get()._stopTimer();
    usePlayerStore.getState().resetPlayers();
    usePackStore.getState().reset();
    clearGameState();

    set({
      questions: [],
      currentQuestionIndex: 0,
      currentPlayerIndex: 0,
      scores: {},
      combos: {},
      answered: false,
      blindMode: false,
      feedback: initialFeedback,
      showForceBtn: false,
      stealConfirmMode: false,
      pendingStealer: null,
      gameMode: "classic",
      timeLeft: CHRONO_DURATION,
      _timerRef: null,
    });

    getNavigate()("/");
  },

  restoreFromStorage: () => {
    const saved = loadGameState();
    if (!saved) return false;

    // Hydrate player store
    usePlayerStore.setState({ players: saved.players });

    // Pack store will be hydrated when packs are loaded from API

    set({
      questions: saved.questions,
      currentQuestionIndex: saved.currentQuestionIndex,
      currentPlayerIndex: saved.currentPlayerIndex,
      scores: saved.scores,
      combos: saved.combos,
      gameMode: saved.gameMode ?? "classic",
      answered: false,
      blindMode: false,
      feedback: initialFeedback,
      showForceBtn: false,
      stealConfirmMode: false,
      pendingStealer: null,
    });

    getNavigate()("/game");
    return true;
  },
}));
