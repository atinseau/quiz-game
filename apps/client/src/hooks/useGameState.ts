import { useState, useCallback, useEffect, useRef } from "react";
import type { Question, Screen, GameState, RawQuestionData, FeedbackState, GameMode } from "../types";
import { MAX_COMBO, BLIND_MULTIPLIER, STEAL_GAIN, STEAL_LOSS, STEAL_FAIL_PENALTY, CHRONO_DURATION, CHRONO_TIMEOUT_PENALTY } from "../types";
import { checkAnswer, fuzzyMatch } from "../utils/fuzzyMatch";
import { sounds } from "../utils/sounds";
import { saveGameState, loadGameState, clearGameState, markChunkFinished } from "../utils/storage";

export function useGameState() {
  const [screen, setScreen] = useState<Screen>("home");
  const [players, setPlayers] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [combos, setCombos] = useState<Record<string, number>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [selectedChunk, setSelectedChunk] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [blindMode, setBlindMode] = useState(false);
  const [pendingStealer, setPendingStealer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({ visible: false, type: "neutral", text: "" });
  const [showForceBtn, setShowForceBtn] = useState(false);
  const [stealConfirmMode, setStealConfirmMode] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>("classic");
  const [timeLeft, setTimeLeft] = useState(CHRONO_DURATION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentQuestion = questions[currentQuestionIndex] ?? null;
  const currentPlayer = players[currentPlayerIndex] ?? "";
  const isSolo = players.length === 1;
  const totalQuestions = questions.length;
  const canSteal = gameMode === "voleur" && !isSolo;

  // Timer helpers
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(CHRONO_DURATION);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopTimer]);

  // Persist state to localStorage
  const persistState = useCallback(
    (overrides: Partial<GameState> = {}) => {
      saveGameState({
        players,
        scores,
        combos,
        questions,
        currentQuestionIndex,
        currentPlayerIndex,
        selectedChunk,
        gameMode,
        ...overrides,
      });
    },
    [players, scores, combos, questions, currentQuestionIndex, currentPlayerIndex, selectedChunk, gameMode]
  );

  // Randomize next question (Fisher-Yates step)
  const randomizeCurrentQuestion = useCallback(
    (qs: Question[], idx: number) => {
      const remaining = qs.length - idx;
      if (remaining <= 0) return qs;
      const randomIdx = Math.floor(Math.random() * remaining) + idx;
      const copy = [...qs];
      [copy[idx], copy[randomIdx]] = [copy[randomIdx]!, copy[idx]!];
      return copy;
    },
    []
  );

  // Add player
  const addPlayer = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || players.includes(trimmed)) return false;
      setPlayers((p) => [...p, trimmed]);
      setScores((s) => ({ ...s, [trimmed]: 0 }));
      setCombos((c) => ({ ...c, [trimmed]: 0 }));
      return true;
    },
    [players]
  );

  const removePlayer = useCallback((name: string) => {
    setPlayers((p) => p.filter((n) => n !== name));
    setScores((s) => {
      const next = { ...s };
      delete next[name];
      return next;
    });
    setCombos((c) => {
      const next = { ...c };
      delete next[name];
      return next;
    });
  }, []);

  // Start game
  const startGame = useCallback(
    async (chunk: string, mode: GameMode = "classic") => {
      const res = await fetch("/" + chunk);
      const data = (await res.json()) as RawQuestionData;
      const flat: Question[] = [];
      for (const [category, qs] of Object.entries(data)) {
        for (const q of qs) {
          flat.push({ ...q, category } as Question);
        }
      }

      const initScores: Record<string, number> = {};
      const initCombos: Record<string, number> = {};
      for (const p of players) {
        initScores[p] = 0;
        initCombos[p] = 0;
      }

      // Randomize first question
      const randomized = randomizeCurrentQuestion(flat, 0);

      setQuestions(randomized);
      setScores(initScores);
      setCombos(initCombos);
      setCurrentQuestionIndex(0);
      setCurrentPlayerIndex(0);
      setSelectedChunk(chunk);
      setGameMode(mode);
      setAnswered(false);
      setBlindMode(randomized[0]?.type === "qcm");
      setFeedback({ visible: false, type: "neutral", text: "" });
      setShowForceBtn(false);
      setStealConfirmMode(false);
      setPendingStealer(null);
      setScreen("game");

      if (mode === "chrono") startTimer();

      saveGameState({
        players,
        scores: initScores,
        combos: initCombos,
        questions: randomized,
        currentQuestionIndex: 0,
        currentPlayerIndex: 0,
        selectedChunk: chunk,
        gameMode: mode,
      });
    },
    [players, randomizeCurrentQuestion, startTimer]
  );

  // Chrono timeout
  const handleTimeout = useCallback(() => {
    if (answered) return;
    stopTimer();
    setAnswered(true);

    const player = currentPlayer;
    const newScores = { ...scores };
    newScores[player] = (newScores[player] ?? 0) - CHRONO_TIMEOUT_PENALTY;
    const newCombos = { ...combos };
    newCombos[player] = 0;
    sounds.fail();

    const correctAnswer =
      currentQuestion?.type === "vrai_faux"
        ? currentQuestion.answer ? "Vrai" : "Faux"
        : String(currentQuestion?.answer);

    setFeedback({
      visible: true,
      type: "error",
      text: `Temps écoulé ! -0.5 pts. La bonne réponse était : ${correctAnswer}`,
    });
    setScores(newScores);
    setCombos(newCombos);
    setShowForceBtn(false);
  }, [answered, currentPlayer, currentQuestion, scores, combos, stopTimer]);

  // Watch timeLeft for timeout
  useEffect(() => {
    if (gameMode === "chrono" && timeLeft === 0 && !answered && screen === "game") {
      handleTimeout();
    }
  }, [timeLeft, gameMode, answered, screen, handleTimeout]);

  // Submit normal answer (QCM click, Vrai/Faux, Text)
  const submitAnswer = useCallback(
    (answer: string | boolean) => {
      if (answered) return;
      setAnswered(true);
      if (gameMode === "chrono") stopTimer();

      const correct = checkAnswer(answer, currentQuestion!);
      const player = currentPlayer;

      const newScores = { ...scores };
      const newCombos = { ...combos };

      if (correct) {
        newCombos[player] = Math.min((newCombos[player] ?? 0) + 1, MAX_COMBO);
        newScores[player] = (newScores[player] ?? 0) + newCombos[player]!;
        sounds.win();
        const combo = newCombos[player]!;
        const comboText = combo > 1 ? ` (x${combo} combo — +${combo} pts)` : "";
        setFeedback({ visible: true, type: "success", text: `Bonne réponse !${comboText}` });
        setShowForceBtn(false);
      } else {
        newCombos[player] = 0;
        sounds.fail();
        const correctAnswer =
          currentQuestion!.type === "vrai_faux"
            ? currentQuestion!.answer
              ? "Vrai"
              : "Faux"
            : String(currentQuestion!.answer);
        setFeedback({
          visible: true,
          type: "error",
          text: `Mauvaise réponse ! La bonne réponse était : ${correctAnswer}`,
        });
        setShowForceBtn(true);
      }

      setScores(newScores);
      setCombos(newCombos);
      setStealConfirmMode(false);
    },
    [answered, currentQuestion, currentPlayer, scores, combos]
  );

  // Submit blind answer (QCM without seeing choices)
  const submitBlindAnswer = useCallback(
    (input: string) => {
      if (!input.trim() || answered) return;

      const correct = fuzzyMatch(input, String(currentQuestion!.answer));
      if (correct) {
        setAnswered(true);
        setBlindMode(false);
        if (gameMode === "chrono") stopTimer();

        const player = currentPlayer;
        const newScores = { ...scores };
        const newCombos = { ...combos };
        newCombos[player] = Math.min((newCombos[player] ?? 0) + 1, MAX_COMBO);
        const multiplier = newCombos[player]!;
        const pts = BLIND_MULTIPLIER * multiplier;
        newScores[player] = (newScores[player] ?? 0) + pts;

        sounds.win();
        const comboText = multiplier > 1 ? ` (x${multiplier} combo)` : "";
        setFeedback({
          visible: true,
          type: "warning",
          text: `Réponse en aveugle ! +${pts} pts${comboText}`,
        });
        setScores(newScores);
        setCombos(newCombos);
        setShowForceBtn(false);
      } else {
        // Wrong blind: reveal choices
        setBlindMode(false);
      }
    },
    [answered, currentQuestion, currentPlayer, scores, combos]
  );

  const revealChoices = useCallback(() => {
    setBlindMode(false);
  }, []);

  // Steal flow
  const initiateSteal = useCallback(
    (stealer: string) => {
      if (answered) return;
      setPendingStealer(stealer);
      setStealConfirmMode(true);

      const correctAnswer =
        currentQuestion!.type === "vrai_faux"
          ? currentQuestion!.answer
            ? "Vrai"
            : "Faux"
          : String(currentQuestion!.answer);

      setFeedback({
        visible: true,
        type: "warning",
        text: "",
        html: `<span class="text-amber-400">${stealer}</span> tente de voler !<br><span class="text-sm text-amber-200 mt-1 block">Bonne réponse : <strong>${correctAnswer}</strong></span>`,
      });
    },
    [answered, currentQuestion]
  );

  const confirmSteal = useCallback(
    (valid: boolean) => {
      const stealer = pendingStealer!;
      const activePlayer = currentPlayer;
      setPendingStealer(null);
      setAnswered(true);
      setStealConfirmMode(false);

      const newScores = { ...scores };
      const newCombos = { ...combos };

      if (valid) {
        newScores[stealer] = (newScores[stealer] ?? 0) + STEAL_GAIN;
        newCombos[stealer] = Math.min((newCombos[stealer] ?? 0) + 1, MAX_COMBO);
        newScores[activePlayer] = (newScores[activePlayer] ?? 0) - STEAL_LOSS;
        newCombos[activePlayer] = 0;
        sounds.steal();
        setFeedback({
          visible: true,
          type: "warning",
          text: `${stealer} a volé la réponse ! (+0.5 pts) — ${activePlayer} perd 0.5 pts`,
        });
      } else {
        newScores[stealer] = (newScores[stealer] ?? 0) - STEAL_FAIL_PENALTY;
        newCombos[stealer] = 0;
        sounds.fail();
        setFeedback({
          visible: true,
          type: "error",
          text: `Vol raté ! ${stealer} perd 1 pt`,
        });
      }

      setScores(newScores);
      setCombos(newCombos);
      setShowForceBtn(false);
    },
    [pendingStealer, currentPlayer, scores, combos]
  );

  // Force point
  const forcePoint = useCallback(() => {
    const player = currentPlayer;
    const newScores = { ...scores };
    const newCombos = { ...combos };
    newCombos[player] = Math.min((newCombos[player] ?? 0) + 1, MAX_COMBO);
    const multiplier = newCombos[player]!;
    newScores[player] = (newScores[player] ?? 0) + multiplier;
    const comboText = multiplier > 1 ? ` (x${multiplier} combo — +${multiplier} pts)` : "";
    setFeedback({
      visible: true,
      type: "success",
      text: `Point accordé !${comboText}`,
    });
    setScores(newScores);
    setCombos(newCombos);
    setShowForceBtn(false);
  }, [currentPlayer, scores, combos]);

  // Next question
  const nextQuestion = useCallback(() => {
    const nextIdx = currentQuestionIndex + 1;
    const nextPlayerIdx = (currentPlayerIndex + 1) % players.length;

    if (nextIdx >= questions.length) {
      stopTimer();
      if (selectedChunk) markChunkFinished(selectedChunk);
      clearGameState();
      setScreen("end");
      return;
    }

    const randomized = randomizeCurrentQuestion(questions, nextIdx);
    setQuestions(randomized);
    setCurrentQuestionIndex(nextIdx);
    setCurrentPlayerIndex(nextPlayerIdx);
    setAnswered(false);
    setBlindMode(randomized[nextIdx]?.type === "qcm");
    setFeedback({ visible: false, type: "neutral", text: "" });
    setShowForceBtn(false);
    setStealConfirmMode(false);
    setPendingStealer(null);

    if (gameMode === "chrono") startTimer();

    saveGameState({
      players,
      scores,
      combos,
      questions: randomized,
      currentQuestionIndex: nextIdx,
      currentPlayerIndex: nextPlayerIdx,
      selectedChunk,
      gameMode,
    });
  }, [currentQuestionIndex, currentPlayerIndex, players, questions, scores, combos, selectedChunk, randomizeCurrentQuestion]);

  // Reset game
  const resetGame = useCallback(() => {
    stopTimer();
    setPlayers([]);
    setScores({});
    setCombos({});
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setCurrentPlayerIndex(0);
    setSelectedChunk(null);
    setGameMode("classic");
    setAnswered(false);
    setBlindMode(false);
    setFeedback({ visible: false, type: "neutral", text: "" });
    setShowForceBtn(false);
    setStealConfirmMode(false);
    setPendingStealer(null);
    clearGameState();
    setScreen("home");
  }, [stopTimer]);

  // Save state on score/combo changes during game
  useEffect(() => {
    if (screen === "game" && questions.length > 0) {
      persistState();
    }
  }, [scores, combos]);

  // Restore state on mount
  useEffect(() => {
    const saved = loadGameState();
    if (saved && saved.questions.length > 0) {
      setPlayers(saved.players);
      setScores(saved.scores);
      setCombos(saved.combos || {});
      setQuestions(saved.questions);
      setCurrentQuestionIndex(saved.currentQuestionIndex);
      setCurrentPlayerIndex(saved.currentPlayerIndex);
      setSelectedChunk(saved.selectedChunk);
      setGameMode(saved.gameMode || "classic");
      setBlindMode(saved.questions[saved.currentQuestionIndex]?.type === "qcm");
      setScreen("game");
      if (saved.gameMode === "chrono") startTimer();
    }
  }, []);

  return {
    // State
    screen,
    players,
    scores,
    combos,
    currentQuestion,
    currentQuestionIndex,
    currentPlayerIndex,
    currentPlayer,
    selectedChunk,
    answered,
    blindMode,
    feedback,
    showForceBtn,
    stealConfirmMode,
    pendingStealer,
    isSolo,
    totalQuestions,
    gameMode,
    canSteal,
    timeLeft,
    // Actions
    addPlayer,
    removePlayer,
    setSelectedChunk,
    startGame,
    submitAnswer,
    submitBlindAnswer,
    revealChoices,
    initiateSteal,
    confirmSteal,
    forcePoint,
    nextQuestion,
    resetGame,
  };
}
