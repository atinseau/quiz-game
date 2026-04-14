import { create } from "zustand";
import type { GameMode } from "../types";
import type { AlcoholConfig } from "./alcoholStore";
import { useAlcoholStore } from "./alcoholStore";

// --- Types ---

export interface PlayerInfo {
  clerkId: string;
  username: string;
  gender: "homme" | "femme";
  connected: boolean;
}

export interface RoomState {
  code: string;
  hostClerkId: string;
  players: PlayerInfo[];
  status: "lobby" | "playing";
  packSlug: string | null;
  mode: GameMode | null;
}

export interface QuestionData {
  type: "qcm" | "vrai_faux" | "texte";
  text: string;
  choices?: string[];
  category: string;
}

export interface PlayerResult {
  clerkId: string;
  answered: boolean;
  correct: boolean;
  stole: boolean;
  pointsDelta: number;
}

export interface TurnResult {
  correctAnswer: string | boolean;
  playerResults: PlayerResult[];
  scores: Record<string, number>;
  combos: Record<string, number>;
}

export interface RankingEntry {
  clerkId: string;
  username: string;
  score: number;
  rank: number;
}

interface GameState {
  question: QuestionData | null;
  questionIndex: number;
  currentPlayerClerkId: string | null;
  startsAt: number;
  answeredPlayers: string[];
  turnResult: TurnResult | null;
  gameOver: {
    scores: Record<string, number>;
    rankings: RankingEntry[];
  } | null;
  scores: Record<string, number>;
  combos: Record<string, number>;
  hasAnswered: boolean;
}

// --- Store ---

interface RoomStore {
  // Connection
  ws: WebSocket | null;
  connected: boolean;
  error: string | null;
  myClerkId: string | null;

  // Room
  room: RoomState | null;
  gameStarting: boolean;

  // Game
  game: GameState;

  // Actions
  connect: () => void;
  disconnect: () => void;
  createRoom: () => void;
  joinRoom: (code: string) => void;
  leaveRoom: () => void;
  selectPack: (packSlug: string) => void;
  selectMode: (mode: GameMode) => void;
  startGame: (alcoholConfig?: AlcoholConfig) => void;
  submitAnswer: (answer: string | boolean) => void;
  reset: () => void;
}

const initialGame: GameState = {
  question: null,
  questionIndex: 0,
  currentPlayerClerkId: null,
  startsAt: 0,
  answeredPlayers: [],
  turnResult: null,
  gameOver: null,
  scores: {},
  combos: {},
  hasAnswered: false,
};

function sendMsg(ws: WebSocket | null, msg: Record<string, unknown>) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  ws: null,
  connected: false,
  error: null,
  myClerkId: null,
  room: null,
  gameStarting: false,
  game: { ...initialGame },

  connect: () => {
    const { ws } = get();
    if (ws?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const newWs = new WebSocket(`${protocol}//${window.location.host}/ws`);

    newWs.onopen = () => {
      set({ connected: true, error: null });
    };

    newWs.onclose = () => {
      set({ connected: false, ws: null });
    };

    newWs.onerror = () => {
      set({ error: "Connexion perdue", connected: false });
    };

    newWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const state = get();

      switch (msg.type) {
        case "room_created":
          break;

        case "room_joined":
          set({
            room: msg.room,
            myClerkId: msg.yourClerkId,
            error: null,
            gameStarting: false,
          });
          break;

        case "player_joined":
          if (state.room) {
            set({
              room: {
                ...state.room,
                players: [...state.room.players, msg.player],
              },
            });
          }
          break;

        case "player_left":
          if (state.room) {
            set({
              room: {
                ...state.room,
                players: state.room.players.filter(
                  (p: PlayerInfo) => p.clerkId !== msg.clerkId,
                ),
              },
            });
          }
          break;

        case "player_disconnected":
          if (state.room) {
            set({
              room: {
                ...state.room,
                players: state.room.players.map((p: PlayerInfo) =>
                  p.clerkId === msg.clerkId ? { ...p, connected: false } : p,
                ),
              },
            });
          }
          break;

        case "player_reconnected":
          if (state.room) {
            set({
              room: {
                ...state.room,
                players: state.room.players.map((p: PlayerInfo) =>
                  p.clerkId === msg.clerkId ? { ...p, connected: true } : p,
                ),
              },
            });
          }
          break;

        case "host_changed":
          if (state.room) {
            set({ room: { ...state.room, hostClerkId: msg.clerkId } });
          }
          break;

        case "pack_selected":
          if (state.room) {
            set({ room: { ...state.room, packSlug: msg.packSlug } });
          }
          break;

        case "mode_selected":
          if (state.room) {
            set({ room: { ...state.room, mode: msg.mode } });
          }
          break;

        case "game_starting":
          set({ gameStarting: true });
          break;

        // Game messages
        case "question":
          set({
            game: {
              ...initialGame,
              question: msg.question,
              questionIndex: msg.index,
              currentPlayerClerkId: msg.currentPlayerClerkId,
              startsAt: msg.startsAt,
              scores: state.game.scores,
              combos: state.game.combos,
            },
          });
          break;

        case "player_answered":
          set({
            game: {
              ...state.game,
              answeredPlayers: [...state.game.answeredPlayers, msg.clerkId],
            },
          });
          break;

        case "turn_result":
          set({
            game: {
              ...state.game,
              turnResult: msg.results,
              scores: msg.results.scores,
              combos: msg.results.combos,
            },
          });
          break;

        case "game_over":
          set({
            game: {
              ...state.game,
              gameOver: { scores: msg.scores, rankings: msg.rankings },
            },
          });
          break;

        case "special_round_start":
          useAlcoholStore.getState().setActiveRound(msg.roundType, msg.data);
          break;
        case "special_round_end":
          useAlcoholStore.getState().endActiveRound();
          break;
        case "drink_alert":
          useAlcoholStore
            .getState()
            .addDrinkAlert({ emoji: msg.emoji, message: msg.message });
          break;
        case "distribute_prompt":
          useAlcoholStore.getState().setActiveRound("distributeur", {
            ...useAlcoholStore.getState().activeRoundData,
            remaining: msg.remaining,
            distributorClerkId: msg.distributorClerkId,
          });
          break;
        case "courage_decision":
          useAlcoholStore.getState().setActiveRound("courage", {
            ...useAlcoholStore.getState().activeRoundData,
            ...msg,
            phase: "decision",
          });
          break;
        case "courage_question":
          useAlcoholStore.getState().setActiveRound("courage", {
            ...useAlcoholStore.getState().activeRoundData,
            questionText: msg.question?.text ?? msg.question,
            phase: "question",
          });
          break;
        case "courage_result":
          useAlcoholStore.getState().setActiveRound("courage", {
            ...useAlcoholStore.getState().activeRoundData,
            phase: "result",
            correct: msg.correct,
            pointsDelta: msg.pointsDelta,
          });
          break;

        case "error":
          set({ error: msg.message });
          break;
      }
    };

    set({ ws: newWs });
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) ws.close();
    set({ ws: null, connected: false, room: null, game: { ...initialGame } });
  },

  createRoom: () => {
    const { connect } = get();
    connect();
    // Wait for connection then send
    const check = () => {
      const { ws } = get();
      if (ws?.readyState === WebSocket.OPEN) {
        sendMsg(ws, { type: "create_room" });
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  },

  joinRoom: (code: string) => {
    const { connect } = get();
    connect();
    const check = () => {
      const { ws } = get();
      if (ws?.readyState === WebSocket.OPEN) {
        sendMsg(ws, { type: "join_room", code });
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  },

  leaveRoom: () => {
    const { ws } = get();
    sendMsg(ws, { type: "leave_room" });
    get().disconnect();
  },

  selectPack: (packSlug: string) => {
    sendMsg(get().ws, { type: "select_pack", packSlug });
  },

  selectMode: (mode: GameMode) => {
    sendMsg(get().ws, { type: "select_mode", mode });
  },

  startGame: (alcoholConfig?: AlcoholConfig) => {
    sendMsg(get().ws, {
      type: "start_game",
      ...(alcoholConfig?.enabled ? { alcoholConfig } : {}),
    });
  },

  submitAnswer: (answer: string | boolean) => {
    sendMsg(get().ws, { type: "submit_answer", answer });
    set((s) => ({ game: { ...s.game, hasAnswered: true } }));
  },

  reset: () => {
    get().disconnect();
    set({
      room: null,
      myClerkId: null,
      gameStarting: false,
      game: { ...initialGame },
      error: null,
    });
  },
}));
