import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAlcoholStore } from "../../../stores/alcoholStore";
import { usePlayerStore } from "../../../stores/playerStore";
import { useRoomStore } from "../../../stores/roomStore";
import { ConseilWheel } from "./ConseilWheel";

interface Props {
  data: Record<string, unknown>;
}

type Phase = "vote" | "tiebreaker-reveal" | "tiebreaker-spin" | "result";

const REVEAL_MS = 1500;
const FALLBACK_MS = 2000;

export function Conseil({ data }: Props) {
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const room = useRoomStore((s) => s.room);
  const ws = useRoomStore((s) => s.ws);
  const soloPlayers = usePlayerStore((s) => s.players);
  const addDrinkAlert = useAlcoholStore((s) => s.addDrinkAlert);
  const endActiveRound = useAlcoholStore((s) => s.endActiveRound);

  const [voted, setVoted] = useState(false);
  const [soloVotes, setSoloVotes] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("vote");
  const [fallbackSelected, setFallbackSelected] = useState<string | null>(null);

  const isSolo = myClerkId === null;

  const resultVotes = (data.votes as Record<string, string>) ?? {};
  const loserClerkIds = (data.loserClerkIds as string[]) ?? [];
  const tiebreaker = data.tiebreaker as
    | {
        tiedClerkIds: string[];
        selectedClerkId: string;
        spinDurationMs: number;
      }
    | undefined;

  const allPlayers: { clerkId: string; username: string }[] = isSolo
    ? soloPlayers.map((p) => ({ clerkId: p.name, username: p.name }))
    : ((data.players as { clerkId: string; username: string }[]) ??
      room?.players
        .filter((p) => p.connected)
        .map((p) => ({ clerkId: p.clerkId, username: p.username })) ??
      []);

  const otherPlayers = isSolo
    ? allPlayers
    : allPlayers.filter((p) => p.clerkId !== myClerkId);

  // Phase transitions driven by incoming `data`
  useEffect(() => {
    if (phase === "vote" && loserClerkIds.length >= 2) {
      setPhase("tiebreaker-reveal");
    } else if (phase === "vote" && loserClerkIds.length === 1) {
      setPhase("result");
    }
  }, [loserClerkIds.length, phase]);

  // reveal → spin (1.5s)
  useEffect(() => {
    if (phase !== "tiebreaker-reveal") return;
    const t = setTimeout(() => setPhase("tiebreaker-spin"), REVEAL_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Fallback 2s: if conseil_tiebreaker never arrives, take tied[0]
  useEffect(() => {
    if (phase !== "tiebreaker-spin") return;
    if (tiebreaker) return;
    const t = setTimeout(() => {
      setFallbackSelected(loserClerkIds[0] ?? null);
    }, FALLBACK_MS);
    return () => clearTimeout(t);
  }, [phase, tiebreaker, loserClerkIds]);

  const handleVote = (targetClerkId: string) => {
    if (voted) return;
    setVoted(true);
    if (isSolo) {
      const newVotes: Record<string, string> = {};
      for (const p of allPlayers) newVotes[p.clerkId] = targetClerkId;
      setSoloVotes(newVotes);
      const loserName =
        allPlayers.find((p) => p.clerkId === targetClerkId)?.username ?? "?";
      addDrinkAlert({
        targetClerkIds: [targetClerkId],
        emoji: "🗳️",
        action: `boire une gorgée — ${loserName} désigné par le conseil`,
      });
      setTimeout(() => endActiveRound(), 5000);
    } else if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "conseil_vote", targetClerkId }));
    }
  };

  // Solo: show result in-memory after voting (no tiebreaker in solo —
  // all simulated votes point at the same target, never an ex æquo)
  const soloShowResult = isSolo && voted && Object.keys(soloVotes).length > 0;
  const soloLosers: string[] = soloShowResult
    ? Object.values(soloVotes).slice(0, 1)
    : [];

  // ====== Renders ======

  if (phase === "vote" && !soloShowResult) {
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

  if (phase === "tiebreaker-reveal") {
    const tiedNames = loserClerkIds.map(
      (id) => allPlayers.find((p) => p.clerkId === id)?.username ?? id,
    );
    return (
      <Card className="bg-card/90 border-amber-500/30 animate-bounce-in">
        <CardContent className="py-8 text-center">
          <span className="text-6xl block mb-4">⚖️</span>
          <h2 className="text-3xl font-bold mb-2 text-amber-400">Égalité !</h2>
          <p className="text-muted-foreground mb-4">
            {loserClerkIds.length} joueurs à égalité
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {tiedNames.map((name) => (
              <span
                key={name}
                className="px-3 py-1 rounded-full bg-amber-500 text-black font-semibold text-sm"
              >
                {name}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "tiebreaker-spin") {
    const tied = loserClerkIds.map((id) => ({
      clerkId: id,
      username: allPlayers.find((p) => p.clerkId === id)?.username ?? id,
    }));
    const selected =
      tiebreaker?.selectedClerkId ?? fallbackSelected ?? tied[0]?.clerkId ?? "";
    const duration = tiebreaker?.spinDurationMs ?? 4000;
    return (
      <Card className="bg-card/90 border-amber-500/30">
        <CardContent className="py-6 text-center">
          <h2 className="text-xl font-bold mb-4 text-amber-400">
            Tirage au sort...
          </h2>
          {selected && (
            <ConseilWheel
              tied={tied}
              selectedClerkId={selected}
              durationMs={duration}
              onDone={() => setPhase("result")}
            />
          )}
        </CardContent>
      </Card>
    );
  }

  // phase === "result" (multi) OR solo result
  const displayLosers = (() => {
    if (isSolo) return soloLosers;
    if (tiebreaker) return [tiebreaker.selectedClerkId];
    if (fallbackSelected) return [fallbackSelected];
    return loserClerkIds.slice(0, 1); // mono-loser or 0-vote (empty)
  })();
  const displayVotes = isSolo ? soloVotes : resultVotes;

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
              <p key={loserId} className="text-lg text-amber-400 font-semibold">
                {loserName} boit une gorgée !
              </p>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
