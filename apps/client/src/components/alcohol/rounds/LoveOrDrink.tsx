import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAlcoholStore } from "../../../stores/alcoholStore";
import { useRoomStore } from "../../../stores/roomStore";

interface Props {
  data: Record<string, unknown>;
}

type Player = { clerkId: string; username: string };

export function LoveOrDrink({ data }: Props) {
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const ws = useRoomStore((s) => s.ws);
  const endActiveRound = useAlcoholStore((s) => s.endActiveRound);
  const addDrinkAlert = useAlcoholStore((s) => s.addDrinkAlert);

  const players = (data.players as Player[]) ?? [];
  const [player1, player2] = players;

  const isSolo = myClerkId === null;
  const isParticipant = isSolo || players.some((p) => p.clerkId === myClerkId);

  const resultChoice = data.choice as "bisou" | "cul_sec" | undefined;
  const [localResult, setLocalResult] = useState<"bisou" | "cul_sec" | null>(
    null,
  );

  const result = resultChoice ?? localResult;

  const sendChoice = (choice: "bisou" | "cul_sec") => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "love_or_drink_choice", choice }));
    }
    if (isSolo) {
      setLocalResult(choice);
      if (choice === "cul_sec" && player1 && player2) {
        // Single aggregated alert — DrinkAlert is a fullscreen overlay, so
        // emitting one per participant stacked two full-screen modals.
        addDrinkAlert({
          targetClerkIds: [player1.clerkId, player2.clerkId],
          emoji: "🍺",
          action: "faire cul-sec — Love or Drink",
        });
      }
      setTimeout(() => endActiveRound(), 5000);
    }
  };

  if (!player1 || !player2) return null;

  return (
    <Card className="bg-card/90 border-pink-500/30">
      <CardContent className="py-8 text-center">
        <span className="text-6xl block mb-4">💋</span>
        <h2 className="text-2xl font-bold mb-6">Love or Drink !</h2>

        <div className="flex items-center justify-center gap-6 mb-8">
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">👤</span>
            <p className="text-lg font-semibold text-pink-400">
              {player1.username}
            </p>
          </div>
          <span className="text-3xl">❤️</span>
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">👤</span>
            <p className="text-lg font-semibold text-pink-400">
              {player2.username}
            </p>
          </div>
        </div>

        {result === null && isParticipant && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Bisou ou cul sec ?
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => sendChoice("bisou")}
                className="bg-pink-600 hover:bg-pink-700 text-white"
              >
                Bisou 💋
              </Button>
              <Button
                size="lg"
                onClick={() => sendChoice("cul_sec")}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Cul sec 🍺
              </Button>
            </div>
          </div>
        )}

        {result === null && !isParticipant && (
          <p className="text-muted-foreground animate-pulse">En attente...</p>
        )}

        {result === "bisou" && (
          <p className="text-2xl font-bold text-pink-400">
            💋 Bisou ! Trop mignon !
          </p>
        )}

        {result === "cul_sec" && (
          <div className="space-y-2">
            <p className="text-2xl font-bold text-amber-400">🍺 Cul sec !</p>
            <p className="text-muted-foreground">
              {player1.username} et {player2.username} boivent !
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
