import { Crown, Medal, Trophy } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useRoomStore } from "../stores/roomStore";
import { fireGameEnd } from "../utils/confetti";

const MEDAL_ICONS = [Crown, Medal, Medal] as const;
const MEDAL_COLORS = [
  "text-yellow-400",
  "text-zinc-300",
  "text-amber-600",
] as const;

export function MultiEndScreen() {
  const navigate = useNavigate();
  const game = useRoomStore((s) => s.game);
  const room = useRoomStore((s) => s.room);

  useEffect(() => {
    fireGameEnd();
  }, []);

  if (!game.gameOver) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  const { scores } = game.gameOver;

  const rankings = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([clerkId, score], i) => {
      const player = room?.players.find((p) => p.clerkId === clerkId);
      return {
        clerkId,
        username: player?.username ?? clerkId,
        score,
        rank: i + 1,
      };
    });

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <h1 className="text-3xl font-bold text-center text-glow-pink animate-bounce-in">
          Fin de la partie !
        </h1>
        <div className="space-y-3">
          {rankings.map((entry, i) => {
            const MedalIcon = (i < 3 ? MEDAL_ICONS[i] : Trophy) ?? Trophy;
            const medalColor =
              (i < 3 ? MEDAL_COLORS[i] : "text-muted-foreground") ??
              "text-muted-foreground";
            const isWinner = i === 0;
            return (
              <div
                key={entry.clerkId}
                className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                  isWinner
                    ? "bg-yellow-500/10 border border-yellow-500/30 glow-purple animate-bounce-in"
                    : "bg-card border border-border/50"
                }`}
              >
                <div className="w-8 flex justify-center">
                  {i < 3 ? (
                    <MedalIcon className={`size-6 ${medalColor}`} />
                  ) : (
                    <span className="text-muted-foreground font-bold">
                      {entry.rank}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`font-semibold text-lg ${isWinner ? "text-glow-pink" : ""}`}
                  >
                    {entry.username}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${medalColor}`}>
                    {entry.score}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-center pt-4">
          <Button
            size="lg"
            onClick={() => navigate("/play")}
            className="w-full h-14 text-lg glow-purple"
          >
            Nouvelle partie
          </Button>
        </div>
      </div>
    </div>
  );
}
