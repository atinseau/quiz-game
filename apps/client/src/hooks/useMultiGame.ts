import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameMode } from "../types";

interface PlayerInfo {
  clerkId: string;
  username: string;
  gender: "homme" | "femme";
  connected: boolean;
}

interface RoomState {
  code: string;
  hostClerkId: string;
  players: PlayerInfo[];
  status: "lobby" | "playing";
  packSlug: string | null;
  mode: GameMode | null;
}

interface TurnResult {
  correct: boolean;
  answer: string;
  points: number;
  scores: Record<string, number>;
  combos: Record<string, number>;
}

interface GameOver {
  scores: Record<string, number>;
  winner: string | null;
}

interface MultiGameState {
  question: string | null;
  questionIndex: number;
  currentPlayerClerkId: string | null;
  startsAt: string | null;
  answeredPlayers: Set<string>;
  turnResult: TurnResult | null;
  gameOver: GameOver | null;
  scores: Record<string, number>;
  combos: Record<string, number>;
  hasAnswered: boolean;
}

type ServerMessage =
  | { type: "room_joined"; room: RoomState }
  | { type: "player_joined"; player: PlayerInfo }
  | { type: "player_left"; clerkId: string }
  | { type: "player_disconnected"; clerkId: string }
  | { type: "player_reconnected"; clerkId: string }
  | { type: "host_changed"; clerkId: string }
  | { type: "pack_selected"; packSlug: string }
  | { type: "mode_selected"; mode: GameMode }
  | {
      type: "question";
      question: string;
      questionIndex: number;
      currentPlayerClerkId: string;
      startsAt: string | null;
    }
  | { type: "player_answered"; clerkId: string }
  | { type: "turn_result"; result: TurnResult }
  | { type: "game_over"; scores: Record<string, number>; winner: string | null }
  | { type: "error"; message: string };

const initialGameState: MultiGameState = {
  question: null,
  questionIndex: 0,
  currentPlayerClerkId: null,
  startsAt: null,
  answeredPlayers: new Set(),
  turnResult: null,
  gameOver: null,
  scores: {},
  combos: {},
  hasAnswered: false,
};

export function useMultiGame() {
  const { userId } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [game, setGame] = useState<MultiGameState>(initialGameState);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };

    ws.onerror = () => {
      setError("Connexion perdue");
      setConnected(false);
    };

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);

      switch (msg.type) {
        case "room_joined":
          setRoom(msg.room);
          setError(null);
          break;
        case "player_joined":
          setRoom((prev) => {
            if (!prev) return prev;
            return { ...prev, players: [...prev.players, msg.player] };
          });
          break;
        case "player_left":
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.filter((p) => p.clerkId !== msg.clerkId),
            };
          });
          break;
        case "player_disconnected":
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.map((p) =>
                p.clerkId === msg.clerkId ? { ...p, connected: false } : p,
              ),
            };
          });
          break;
        case "player_reconnected":
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: prev.players.map((p) =>
                p.clerkId === msg.clerkId ? { ...p, connected: true } : p,
              ),
            };
          });
          break;
        case "host_changed":
          setRoom((prev) => {
            if (!prev) return prev;
            return { ...prev, hostClerkId: msg.clerkId };
          });
          break;
        case "pack_selected":
          setRoom((prev) => {
            if (!prev) return prev;
            return { ...prev, packSlug: msg.packSlug };
          });
          break;
        case "mode_selected":
          setRoom((prev) => {
            if (!prev) return prev;
            return { ...prev, mode: msg.mode };
          });
          break;
        case "question":
          setGame((prev) => ({
            ...prev,
            question: msg.question,
            questionIndex: msg.questionIndex,
            currentPlayerClerkId: msg.currentPlayerClerkId,
            startsAt: msg.startsAt,
            answeredPlayers: new Set(),
            turnResult: null,
            hasAnswered: false,
          }));
          break;
        case "player_answered":
          setGame((prev) => ({
            ...prev,
            answeredPlayers: new Set([...prev.answeredPlayers, msg.clerkId]),
          }));
          break;
        case "turn_result":
          setGame((prev) => ({
            ...prev,
            turnResult: msg.result,
            scores: msg.result.scores,
            combos: msg.result.combos,
          }));
          break;
        case "game_over":
          setGame((prev) => ({
            ...prev,
            gameOver: { scores: msg.scores, winner: msg.winner },
            scores: msg.scores,
          }));
          break;
        case "error":
          setError(msg.message);
          break;
      }
    };
  }, []);

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const joinRoom = useCallback(
    (code: string) => {
      connect();
      const check = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          sendMessage({ type: "join_room", code });
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    },
    [connect, sendMessage],
  );

  const submitAnswer = useCallback(
    (answer: string) => {
      sendMessage({ type: "submit_answer", answer });
      setGame((prev) => ({ ...prev, hasAnswered: true }));
    },
    [sendMessage],
  );

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const isHost = room?.hostClerkId === userId;
  const isMyTurn = game.currentPlayerClerkId === userId;

  return {
    room,
    game,
    connected,
    error,
    isHost,
    isMyTurn,
    submitAnswer,
    joinRoom,
    sendMessage,
  };
}
