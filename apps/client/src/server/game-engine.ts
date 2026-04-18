import { shuffle } from "../shared/scoring";
import {
  CHRONO_DURATION,
  CHRONO_TIMEOUT_PENALTY,
  MAX_COMBO,
  STEAL_FAIL_PENALTY,
  STEAL_GAIN,
  STEAL_LOSS,
} from "../types";
import { checkAnswer } from "../utils/fuzzyMatch";
import {
  checkTrigger,
  handleCulSecEndGame,
  initAlcoholState,
  setOnRoundEnd,
} from "./alcohol/framework";
import { broadcast } from "./rooms";
import type {
  GameState,
  PlayerResult,
  QuestionFull,
  QuestionWithoutAnswer,
  RankingEntry,
  Room,
  TurnResult,
} from "./types";

const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337/api";
const NEXT_QUESTION_DELAY = 3_000;

// Register alcohol round-end callback to resume the game
setOnRoundEnd((room) => {
  sendQuestion(room);
});

function stripAnswer(q: QuestionFull): QuestionWithoutAnswer {
  return {
    type: q.type,
    text: q.text,
    choices: q.choices,
    category: q.category,
  };
}

function getConnectedPlayerIds(room: Room): string[] {
  return Array.from(room.players.values())
    .filter((p) => p.connected)
    .map((p) => p.clerkId);
}

function getPlayerRotation(room: Room): string[] {
  return Array.from(room.players.keys());
}

function currentPlayerId(room: Room): string | undefined {
  const rotation = getPlayerRotation(room);
  if (!room.game || rotation.length === 0) return undefined;
  return rotation[room.game.currentPlayerIndex % rotation.length];
}

function advanceToNextConnectedPlayer(room: Room): string | undefined {
  const game = room.game;
  if (!game) return undefined;
  const rotation = getPlayerRotation(room);
  if (rotation.length === 0) return undefined;

  const startIndex = game.currentPlayerIndex;
  for (let i = 0; i < rotation.length; i++) {
    const idx = (startIndex + i) % rotation.length;
    const id = rotation[idx];
    if (!id) continue;
    const player = room.players.get(id);
    if (player?.connected) {
      game.currentPlayerIndex = idx;
      return id;
    }
  }
  // All disconnected — just pick the current one
  return rotation[game.currentPlayerIndex % rotation.length];
}

// --- Chrono timers ---
const chronoTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function clearChronoTimer(roomCode: string) {
  const timer = chronoTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    chronoTimers.delete(roomCode);
  }
}

// --- Fetch questions from Strapi ---

async function fetchQuestions(packSlug: string): Promise<QuestionFull[]> {
  const url = `${STRAPI_URL}/questions?filters[pack][slug][$eq]=${encodeURIComponent(packSlug)}&populate=category&pagination[pageSize]=1000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Strapi fetch failed: ${res.status}`);
  // biome-ignore lint/suspicious/noExplicitAny: Strapi REST shape
  const json: { data: any[] } = await res.json();
  return json.data.map((q) => ({
    type: q.type,
    text: q.text,
    choices: q.choices ?? undefined,
    answer: q.type === "vrai_faux" ? q.answer === "true" : q.answer,
    category: q.category?.name ?? "Divers",
  }));
}

// --- Public API ---

export async function startGame(room: Room): Promise<void> {
  if (!room.packSlug) throw new Error("No pack selected");

  const rawQuestions = await fetchQuestions(room.packSlug);
  const questions = shuffle(rawQuestions);

  const scores: Record<string, number> = {};
  const combos: Record<string, number> = {};
  for (const id of room.players.keys()) {
    scores[id] = 0;
    combos[id] = 0;
  }

  const game: GameState = {
    questions,
    currentQuestionIndex: 0,
    currentPlayerIndex: 0,
    scores,
    combos,
    answers: new Map(),
    questionStartedAt: 0,
    resolved: false,
    alcoholState: null,
  };

  room.game = game;

  if (room.alcoholConfig?.enabled) {
    game.alcoholState = initAlcoholState(room.alcoholConfig);
  }

  // Advance to first connected player
  advanceToNextConnectedPlayer(room);

  sendQuestion(room);
}

export function submitAnswer(
  room: Room,
  clerkId: string,
  answer: string | boolean,
): void {
  const game = room.game;
  if (!game || game.resolved) return;

  // Don't allow double-answering
  if (game.answers.has(clerkId)) return;

  game.answers.set(clerkId, answer);
  broadcast(room, { type: "player_answered", clerkId });

  const mode = room.mode;
  if (mode === "classic" || mode === "chrono") {
    resolveClassicOrChrono(room);
  } else if (mode === "voleur") {
    resolveVoleur(room);
  }
}

export function handlePlayerDisconnect(room: Room): void {
  const game = room.game;
  if (!game || game.resolved) return;

  // Re-trigger voleur resolution — a disconnected stealer should not block the turn
  if (room.mode === "voleur") {
    resolveVoleur(room);
  }
}

export function handleChronoTimeout(room: Room, playerId: string): void {
  const game = room.game;
  if (!game || game.resolved) return;

  // Player hasn't answered yet
  if (game.answers.has(playerId)) return;

  // Mark as timed out (null answer → not in answers map, we resolve directly)
  game.resolved = true;
  clearChronoTimer(room.code);

  const question = game.questions[game.currentQuestionIndex];
  if (!question) return;

  // Timeout penalty
  game.scores[playerId] = (game.scores[playerId] ?? 0) - CHRONO_TIMEOUT_PENALTY;
  game.combos[playerId] = 0;

  const playerResults: PlayerResult[] = [
    {
      clerkId: playerId,
      answered: false,
      correct: false,
      stole: false,
      pointsDelta: -CHRONO_TIMEOUT_PENALTY,
    },
  ];

  const result: TurnResult = {
    correctAnswer: question.answer,
    playerResults,
    scores: { ...game.scores },
    combos: { ...game.combos },
  };

  broadcast(room, { type: "turn_result", results: result });
  scheduleNextQuestion(room);
}

// --- Internal helpers ---

function sendQuestion(room: Room): void {
  const game = room.game;
  if (!game) return;

  const question = game.questions[game.currentQuestionIndex];
  if (!question) return;

  game.answers = new Map();
  game.resolved = false;
  game.questionStartedAt = Date.now();

  const pid = currentPlayerId(room);
  if (!pid) return;

  broadcast(room, {
    type: "question",
    index: game.currentQuestionIndex,
    currentPlayerClerkId: pid,
    question: stripAnswer(question),
    startsAt: game.questionStartedAt,
  });

  // Set chrono timer if needed
  if (room.mode === "chrono") {
    clearChronoTimer(room.code);
    const timer = setTimeout(() => {
      chronoTimers.delete(room.code);
      handleChronoTimeout(room, pid);
    }, CHRONO_DURATION * 1000);
    chronoTimers.set(room.code, timer);
  }
}

function resolveClassicOrChrono(room: Room): void {
  const game = room.game;
  if (!game) return;

  const pid = currentPlayerId(room);
  if (!pid) return;

  // Only resolve once the current player has answered
  if (!game.answers.has(pid)) return;

  game.resolved = true;
  clearChronoTimer(room.code);

  const question = game.questions[game.currentQuestionIndex];
  if (!question) return;

  const answer = game.answers.get(pid);
  if (answer === undefined) return;
  const correct = checkAnswer(answer, question);

  let pointsDelta = 0;
  if (correct) {
    const combo = Math.min((game.combos[pid] ?? 0) + 1, MAX_COMBO);
    game.combos[pid] = combo;
    pointsDelta = 1;
    game.scores[pid] = (game.scores[pid] ?? 0) + pointsDelta;
  } else {
    game.combos[pid] = 0;
  }

  const playerResults: PlayerResult[] = [
    {
      clerkId: pid,
      answered: true,
      correct,
      stole: false,
      pointsDelta,
      answer,
    },
  ];

  const result: TurnResult = {
    correctAnswer: question.answer,
    playerResults,
    scores: { ...game.scores },
    combos: { ...game.combos },
  };

  broadcast(room, { type: "turn_result", results: result });
  scheduleNextQuestion(room);
}

function resolveVoleur(room: Room): void {
  const game = room.game;
  if (!game) return;

  const mainPlayerId = currentPlayerId(room);
  if (!mainPlayerId) return;

  // Main player must have answered
  if (!game.answers.has(mainPlayerId)) return;

  const question = game.questions[game.currentQuestionIndex];
  if (!question) return;

  const mainAnswer = game.answers.get(mainPlayerId);
  if (mainAnswer === undefined) return;
  const mainCorrect = checkAnswer(mainAnswer, question);

  // If main player answered correctly → turn ends immediately, no steal window
  if (mainCorrect) {
    game.resolved = true;

    const combo = Math.min((game.combos[mainPlayerId] ?? 0) + 1, MAX_COMBO);
    game.combos[mainPlayerId] = combo;
    game.scores[mainPlayerId] = (game.scores[mainPlayerId] ?? 0) + 1;

    const playerResults: PlayerResult[] = [
      {
        clerkId: mainPlayerId,
        answered: true,
        correct: true,
        stole: false,
        pointsDelta: 1,
        answer: mainAnswer,
      },
    ];

    const result: TurnResult = {
      correctAnswer: question.answer,
      playerResults,
      scores: { ...game.scores },
      combos: { ...game.combos },
    };

    broadcast(room, { type: "turn_result", results: result });
    scheduleNextQuestion(room);
    return;
  }

  // Main answered incorrectly → stealers get a chance
  const otherPlayerIds = getConnectedPlayerIds(room).filter(
    (id) => id !== mainPlayerId,
  );

  // Check if a stealer already answered correctly
  let stealerWon: string | null = null;
  for (const id of otherPlayerIds) {
    const ans = game.answers.get(id);
    if (ans !== undefined && checkAnswer(ans, question)) {
      stealerWon = id;
      break;
    }
  }

  // If no stealer won yet, check if all others have tried (or are disconnected)
  if (!stealerWon) {
    const allOthersTried = otherPlayerIds.every(
      (id) => game.answers.has(id) || !room.players.get(id)?.connected,
    );
    if (!allOthersTried) return; // Still waiting for more answers
  }

  game.resolved = true;

  const playerResults: PlayerResult[] = [];

  if (stealerWon) {
    // Stealer gets STEAL_GAIN, main player loses STEAL_LOSS
    game.scores[stealerWon] = (game.scores[stealerWon] ?? 0) + STEAL_GAIN;
    game.combos[stealerWon] = Math.min(
      (game.combos[stealerWon] ?? 0) + 1,
      MAX_COMBO,
    );
    game.scores[mainPlayerId] = (game.scores[mainPlayerId] ?? 0) - STEAL_LOSS;
    game.combos[mainPlayerId] = 0;

    // Main player result
    playerResults.push({
      clerkId: mainPlayerId,
      answered: true,
      correct: false,
      stole: false,
      pointsDelta: -STEAL_LOSS,
      answer: mainAnswer,
    });

    // Stealer result
    playerResults.push({
      clerkId: stealerWon,
      answered: true,
      correct: true,
      stole: true,
      pointsDelta: STEAL_GAIN,
      answer: game.answers.get(stealerWon),
    });

    // Other stealers who answered wrong
    for (const id of otherPlayerIds) {
      if (id === stealerWon) continue;
      if (game.answers.has(id)) {
        game.scores[id] = (game.scores[id] ?? 0) - STEAL_FAIL_PENALTY;
        game.combos[id] = 0;
        playerResults.push({
          clerkId: id,
          answered: true,
          correct: false,
          stole: false,
          pointsDelta: -STEAL_FAIL_PENALTY,
          answer: game.answers.get(id),
        });
      }
    }
  } else {
    // No stealer won — main already incorrect
    game.combos[mainPlayerId] = 0;
    playerResults.push({
      clerkId: mainPlayerId,
      answered: true,
      correct: false,
      stole: false,
      pointsDelta: 0,
      answer: mainAnswer,
    });

    // Stealers who tried and failed
    for (const id of otherPlayerIds) {
      if (game.answers.has(id)) {
        game.scores[id] = (game.scores[id] ?? 0) - STEAL_FAIL_PENALTY;
        game.combos[id] = 0;
        playerResults.push({
          clerkId: id,
          answered: true,
          correct: false,
          stole: false,
          pointsDelta: -STEAL_FAIL_PENALTY,
          answer: game.answers.get(id),
        });
      }
    }
  }

  const result: TurnResult = {
    correctAnswer: question.answer,
    playerResults,
    scores: { ...game.scores },
    combos: { ...game.combos },
  };

  broadcast(room, { type: "turn_result", results: result });
  scheduleNextQuestion(room);
}

function scheduleNextQuestion(room: Room): void {
  if (room.nextQuestionTimer) {
    clearTimeout(room.nextQuestionTimer);
  }
  room.nextQuestionTimer = setTimeout(() => {
    room.nextQuestionTimer = null;
    const game = room.game;
    if (!game) return;

    const nextIndex = game.currentQuestionIndex + 1;
    if (nextIndex >= game.questions.length) {
      endGame(room);
      return;
    }

    game.currentQuestionIndex = nextIndex;

    // Advance to next connected player in rotation
    const rotation = getPlayerRotation(room);
    const nextPlayerIdx = (game.currentPlayerIndex + 1) % rotation.length;
    game.currentPlayerIndex = nextPlayerIdx;
    advanceToNextConnectedPlayer(room);

    const triggered = checkTrigger(room);
    if (triggered) {
      // Special round active — sendQuestion will be called by endSpecialRound → onRoundEnd
      return;
    }
    sendQuestion(room);
  }, NEXT_QUESTION_DELAY);
}

function endGame(room: Room): void {
  const game = room.game;
  if (!game) return;

  clearChronoTimer(room.code);

  const scores = { ...game.scores };

  // Build rankings sorted by score descending
  const entries: RankingEntry[] = Array.from(room.players.values()).map(
    (p) => ({
      clerkId: p.clerkId,
      username: p.username,
      score: scores[p.clerkId] ?? 0,
      rank: 0,
    }),
  );

  entries.sort((a, b) => b.score - a.score);

  let currentRank = 1;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    if (i > 0) {
      const prev = entries[i - 1];
      if (prev && entry.score < prev.score) {
        currentRank = i + 1;
      }
    }
    entry.rank = currentRank;
  }

  // Handle cul-sec end-of-game drink alerts
  const hasCulSec = game.alcoholState?.config.culSecEndGame;
  if (hasCulSec) {
    handleCulSecEndGame(room);
  }

  // Delay game_over to let drink_alerts show
  const delay = hasCulSec ? 5000 : 0;
  setTimeout(() => {
    broadcast(room, { type: "game_over", scores, rankings: entries });
    room.status = "lobby";
    room.game = null;
  }, delay);
}
