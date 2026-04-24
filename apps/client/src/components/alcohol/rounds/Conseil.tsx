import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAlcoholStore } from "../../../stores/alcoholStore";
import { usePlayerStore } from "../../../stores/playerStore";
import { useRoomStore } from "../../../stores/roomStore";

interface Props {
  data: Record<string, unknown>;
}

export function Conseil({ data }: Props) {
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const room = useRoomStore((s) => s.room);
  const ws = useRoomStore((s) => s.ws);
  const soloPlayers = usePlayerStore((s) => s.players);
  const addDrinkAlert = useAlcoholStore((s) => s.addDrinkAlert);
  const endActiveRound = useAlcoholStore((s) => s.endActiveRound);

  const [voted, setVoted] = useState(false);
  const [soloVotes, setSoloVotes] = useState<Record<string, string>>({});

  const isSolo = myClerkId === null;

  const isResult = data.phase === "result";
  const resultVotes = (data.votes as Record<string, string>) ?? {};
  const loserClerkIds = (data.loserClerkIds as string[]) ?? [];

  // Build list of players from data or stores
  const allPlayers: { clerkId: string; username: string }[] = isSolo
    ? soloPlayers.map((p) => ({ clerkId: p.name, username: p.name }))
    : ((data.players as { clerkId: string; username: string }[]) ??
      room?.players
        .filter((p) => p.connected)
        .map((p) => ({
          clerkId: p.clerkId,
          username: p.username,
        })) ??
      []);

  const otherPlayers = isSolo
    ? allPlayers
    : allPlayers.filter((p) => p.clerkId !== myClerkId);

  const handleVote = (targetClerkId: string) => {
    if (voted) return;
    setVoted(true);

    if (isSolo) {
      // Solo mode: simulate votes for all players, target gets all votes
      const newVotes: Record<string, string> = {};
      for (const p of allPlayers) {
        newVotes[p.clerkId] = targetClerkId;
      }
      setSoloVotes(newVotes);

      addDrinkAlert({
        targetClerkIds: [targetClerkId],
        emoji: "🗳️",
        action: "boire — désigné par le conseil",
      });
      setTimeout(() => endActiveRound(), 5000);
    } else {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "conseil_vote", targetClerkId }));
      }
    }
  };

  // In solo mode, show result after voting
  const showResult =
    isResult || (isSolo && voted && Object.keys(soloVotes).length > 0);
  const displayVotes = isResult ? resultVotes : soloVotes;

  const displayLosers = isResult
    ? loserClerkIds
    : isSolo && Object.keys(soloVotes).length > 0
      ? (() => {
          const counts = new Map<string, number>();
          for (const t of Object.values(soloVotes)) {
            counts.set(t, (counts.get(t) ?? 0) + 1);
          }
          const max = Math.max(0, ...counts.values());
          return max > 0
            ? Array.from(counts.entries())
                .filter(([_, c]) => c === max)
                .map(([id]) => id)
            : [];
        })()
      : [];

  if (showResult) {
    return (
      <Card className="bg-card/90 border-amber-500/30">
        <CardContent className="py-8 text-center">
          <span className="text-6xl block mb-4">🗳️</span>
          <h2 className="text-2xl font-bold mb-4">Résultat du conseil</h2>

          <div className="space-y-2 mb-6">
            {allPlayers.map((p) => {
              const targetId = displayVotes[p.clerkId];
              const targetName =
                allPlayers.find((x) => x.clerkId === targetId)?.username ??
                targetId ??
                "—";
              return (
                <p key={p.clerkId} className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {p.username}
                  </span>{" "}
                  a voté pour{" "}
                  <span className="font-semibold text-amber-400">
                    {targetName}
                  </span>
                </p>
              );
            })}
          </div>

          <div className="space-y-2">
            {displayLosers.map((loserId) => {
              const loserName =
                allPlayers.find((p) => p.clerkId === loserId)?.username ??
                loserId;
              return (
                <p
                  key={loserId}
                  className="text-lg text-amber-400 font-semibold"
                >
                  {loserName} boit une gorgée !
                </p>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/90 border-amber-500/30">
      <CardContent className="py-8 text-center">
        <span className="text-6xl block mb-4">🗳️</span>
        <h2 className="text-2xl font-bold mb-2">Conseil du village</h2>
        <p className="text-muted-foreground mb-6">
          Votez pour quelqu&apos;un — celui qui a le plus de votes boit !
        </p>

        {voted ? (
          <p className="text-muted-foreground">En attente des votes...</p>
        ) : (
          <div className="space-y-3">
            {otherPlayers.map((p) => (
              <Button
                key={p.clerkId}
                size="lg"
                className="w-full"
                onClick={() => handleVote(p.clerkId)}
              >
                🗳️ {p.username}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
