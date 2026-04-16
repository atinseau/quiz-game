import { create } from "zustand";
import { fetchPackQuestions } from "../lib/queries/questions";
import { shuffle } from "../shared/scoring";
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
import { useAlcoholStore } from "./alcoholStore";
import { usePackStore } from "./packStore";
import { usePlayerStore } from "./playerStore";
import { getNavigate } from "./router";

// --- Helpers ---

function randomizeQuestion(questions: Question[], idx: number): void {
  if (idx >= questions.length) return;
  const q = questions[idx];
  if (!q?.choices) return;
  questions[idx] = { ...q, choices: shuffle(q.choices) };
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

    const shuffled = shuffle(questions);
    questions.length = 0;
    questions.push(...shuffled);

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

      // Cul sec solo — loser drinks before end screen
      const alcoholStore = useAlcoholStore.getState();
      if (alcoholStore.config.enabled && alcoholStore.config.culSecEndGame) {
        const scores = get().scores;
        const scoreValues = Object.values(scores);
        if (scoreValues.length > 0) {
          const minScore = Math.min(...scoreValues);
          const losers = Object.entries(scores)
            .filter(([_, s]) => s === minScore)
            .map(([name]) => name);
          for (const name of losers) {
            alcoholStore.addDrinkAlert({
              emoji: "🍻",
              message: `CUL SEC ! ${name} a perdu !`,
            });
          }
        }
      }

      clearGameState();
      getNavigate()("/end");
      return;
    }

    // Check alcohol trigger (solo mode only — multiplayer is server-driven)
    const alcoholStore = useAlcoholStore.getState();
    const roundType = alcoholStore.checkTrigger();
    if (roundType) {
      const scores = get().scores;
      const players = usePlayerStore.getState().players;

      if (roundType === "petit_buveur") {
        const scoreValues = Object.values(scores);
        const minScore = scoreValues.length > 0 ? Math.min(...scoreValues) : 0;
        const losers = Object.entries(scores)
          .filter(([_, s]) => s === minScore)
          .map(([name]) => ({ clerkId: name, username: name }));
        alcoholStore.setActiveRound("petit_buveur", { losers });
        for (const loser of losers) {
          alcoholStore.addDrinkAlert({
            emoji: "🍺",
            message: `${loser.username} boit une gorgée !`,
          });
        }
      } else if (roundType === "distributeur") {
        const scoreValues = Object.values(scores);
        const maxScore = scoreValues.length > 0 ? Math.max(...scoreValues) : 0;
        const winner =
          Object.entries(scores).find(([_, s]) => s === maxScore)?.[0] ?? "";
        alcoholStore.setActiveRound("distributeur", {
          distributorClerkId: winner,
          distributorName: winner,
          remaining: 3,
        });
      } else if (roundType === "courage") {
        const randomPlayer =
          players[Math.floor(Math.random() * players.length)];
        alcoholStore.setActiveRound("courage", {
          playerClerkId: randomPlayer?.name,
          playerName: randomPlayer?.name,
        });
      } else if (roundType === "conseil") {
        alcoholStore.setActiveRound("conseil", {
          players: players.map((p) => ({ clerkId: p.name, username: p.name })),
        });
      } else if (roundType === "love_or_drink") {
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        const pair = shuffled.slice(0, 2);
        alcoholStore.setActiveRound("love_or_drink", {
          players: pair.map((p) => ({ clerkId: p.name, username: p.name })),
        });
      } else if (roundType === "cupidon") {
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        const [a, b] = shuffled;
        alcoholStore.setActiveRound("cupidon", {
          playerA: { clerkId: a?.name, username: a?.name },
          playerB: { clerkId: b?.name, username: b?.name },
        });
        // Cupidon is display-only — auto-end after 5 seconds
        setTimeout(() => useAlcoholStore.getState().endActiveRound(), 5000);
      } else if (roundType === "show_us") {
        const randomPlayer =
          players[Math.floor(Math.random() * players.length)];
        alcoholStore.setActiveRound("show_us", {
          targetClerkId: randomPlayer?.name,
          targetName: randomPlayer?.name,
        });
      } else if (roundType === "smatch_or_pass") {
        // Find opposite-gender pairs
        const hommes = players.filter((p) => p.gender === "homme");
        const femmes = players.filter((p) => p.gender === "femme");
        if (hommes.length > 0 && femmes.length > 0) {
          // biome-ignore lint/style/noNonNullAssertion: length > 0 guaranteed above
          const decideur = hommes[Math.floor(Math.random() * hommes.length)]!;
          // biome-ignore lint/style/noNonNullAssertion: length > 0 guaranteed above
          const receveur = femmes[Math.floor(Math.random() * femmes.length)]!;
          alcoholStore.setActiveRound("smatch_or_pass", {
            decideur: {
              clerkId: decideur.name,
              username: decideur.name,
              gender: decideur.gender,
            },
            receveur: {
              clerkId: receveur.name,
              username: receveur.name,
              gender: receveur.gender,
            },
          });
        } else {
          // No opposite-gender pair available — skip this round, let game advance
        }
      }

      // Don't advance — wait for the round overlay to call endActiveRound
      // (unless the round was skipped due to missing conditions)
      if (useAlcoholStore.getState().activeRound) return;
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

    getNavigate()("/play");
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
