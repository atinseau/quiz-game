import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAlcoholStore } from "../../../stores/alcoholStore";
import { usePlayerStore } from "../../../stores/playerStore";
import { useRoomStore } from "../../../stores/roomStore";

interface Props {
  data: Record<string, unknown>;
}

export function Distributeur({ data }: Props) {
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const room = useRoomStore((s) => s.room);
  const ws = useRoomStore((s) => s.ws);
  const soloPlayers = usePlayerStore((s) => s.players);
  const addDrinkAlert = useAlcoholStore((s) => s.addDrinkAlert);
  const endActiveRound = useAlcoholStore((s) => s.endActiveRound);

  const distributorClerkId = data.distributorClerkId as string;
  const distributorName = data.distributorName as string;
  const [localRemaining, setLocalRemaining] = useState(
    (data.remaining as number) ?? 3,
  );

  // Solo mode: myClerkId is null, treat as "you are the distributor"
  const isSolo = myClerkId === null;
  const isDistributor = isSolo || myClerkId === distributorClerkId;

  // In solo mode, get other players from playerStore
  const otherPlayers = isSolo
    ? soloPlayers
        .filter((p) => p.name !== distributorClerkId)
        .map((p) => ({ clerkId: p.name, username: p.name, connected: true }))
    : (room?.players.filter(
        (p) => p.clerkId !== distributorClerkId && p.connected,
      ) ?? []);

  const remaining = isSolo ? localRemaining : ((data.remaining as number) ?? 0);

  const handleDrink = (targetId: string, _targetName: string) => {
    if (isSolo) {
      // Solo: handle locally
      addDrinkAlert({
        targetClerkIds: [targetId],
        emoji: "🍺",
        action: `boire — envoyé par ${distributorName}`,
      });
      const next = localRemaining - 1;
      setLocalRemaining(next);
      if (next <= 0) {
        setTimeout(() => endActiveRound(), 2000);
      }
    } else {
      // Multi: send via WS
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "distribute_drink", targetClerkId: targetId }),
        );
      }
    }
  };

  return (
    <Card className="bg-card/90 border-amber-500/30">
      <CardContent className="py-8 text-center">
        <span className="text-6xl block mb-4">🎯</span>
        <h2 className="text-2xl font-bold mb-2">Distributeur !</h2>
        <p className="text-muted-foreground mb-4">
          {distributorName} distribue {remaining} gorgée
          {remaining > 1 ? "s" : ""}
        </p>
        {isDistributor ? (
          <div className="space-y-3">
            {otherPlayers.map((p) => (
              <Button
                key={p.clerkId ?? p.username}
                size="lg"
                className="w-full"
                onClick={() => handleDrink(p.clerkId, p.username)}
                disabled={remaining <= 0}
              >
                🍺 {p.username}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            En attente de {distributorName}...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
