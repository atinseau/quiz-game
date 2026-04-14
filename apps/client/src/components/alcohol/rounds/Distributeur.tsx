import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRoomStore } from "../../../stores/roomStore";

interface Props {
  data: Record<string, unknown>;
}

export function Distributeur({ data }: Props) {
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const room = useRoomStore((s) => s.room);
  const ws = useRoomStore((s) => s.ws);
  const distributorClerkId = data.distributorClerkId as string;
  const distributorName = data.distributorName as string;
  const remaining = (data.remaining as number) ?? 0;
  const isDistributor = myClerkId === distributorClerkId;
  const otherPlayers =
    room?.players.filter(
      (p) => p.clerkId !== distributorClerkId && p.connected,
    ) ?? [];

  const sendDrink = (targetClerkId: string) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "distribute_drink", targetClerkId }));
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
                key={p.clerkId}
                size="lg"
                className="w-full"
                onClick={() => sendDrink(p.clerkId)}
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
