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

type ServerMessage =
  | { type: "room_created"; code: string }
  | { type: "room_joined"; room: RoomState }
  | { type: "player_joined"; player: PlayerInfo }
  | { type: "player_left"; clerkId: string }
  | { type: "player_disconnected"; clerkId: string }
  | { type: "player_reconnected"; clerkId: string }
  | { type: "host_changed"; clerkId: string }
  | { type: "pack_selected"; packSlug: string }
  | { type: "mode_selected"; mode: GameMode }
  | { type: "game_starting" }
  | { type: "error"; message: string };

export function useRoom() {
  const { userId } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameStarting, setGameStarting] = useState(false);

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
        case "room_created":
          break;
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
        case "game_starting":
          setGameStarting(true);
          break;
        case "error":
          setError(msg.message);
          break;
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setRoom(null);
    setConnected(false);
  }, []);

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const createRoom = useCallback(() => {
    connect();
    const check = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: "create_room" });
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  }, [connect, sendMessage]);

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

  const selectPack = useCallback(
    (packSlug: string) => sendMessage({ type: "select_pack", packSlug }),
    [sendMessage],
  );

  const selectMode = useCallback(
    (mode: GameMode) => sendMessage({ type: "select_mode", mode }),
    [sendMessage],
  );

  const startGame = useCallback(
    () => sendMessage({ type: "start_game" }),
    [sendMessage],
  );

  const leaveRoom = useCallback(() => {
    sendMessage({ type: "leave_room" });
    disconnect();
  }, [sendMessage, disconnect]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const isHost = room?.hostClerkId === userId;

  return {
    room,
    connected,
    error,
    isHost,
    gameStarting,
    createRoom,
    joinRoom,
    leaveRoom,
    selectPack,
    selectMode,
    startGame,
  };
}
