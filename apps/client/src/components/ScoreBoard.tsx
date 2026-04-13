import { Flame, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Player } from "../types";

interface Props {
  players: Player[];
  scores: Record<string, number>;
  combos: Record<string, number>;
  currentPlayerIndex: number;
  isSolo: boolean;
}

export function ScoreBoard({
  players,
  scores,
  combos,
  currentPlayerIndex,
  isSolo,
}: Props) {
  if (isSolo) return null;

  return (
    <div className="mt-8">
      <Separator className="mb-4" />
      <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
        <Trophy className="size-3.5" />
        Scores
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {players.map((p, i) => {
          const isActive = i === currentPlayerIndex;
          const combo = combos[p.name] ?? 0;
          return (
            <div
              key={p.name}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                isActive
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-card border border-border/50"
              }`}
            >
              <span
                className={`font-medium text-sm ${isActive ? "text-primary" : "text-foreground"}`}
              >
                {p.name}
              </span>
              {combo >= 2 && (
                <Badge
                  variant="secondary"
                  className="text-xs px-1.5 py-0 text-amber-400 bg-amber-500/15 border-none"
                >
                  <Flame className="size-3 mr-0.5" />x{combo}
                </Badge>
              )}
              <span
                className={`ml-auto font-bold ${isActive ? "text-primary" : "text-foreground"}`}
              >
                {scores[p.name]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SoloScore({ score, combo }: { score: number; combo: number }) {
  return (
    <Badge
      variant="secondary"
      className="text-party-green bg-party-green/15 border-none gap-1"
    >
      {score} pts
      {combo >= 2 && (
        <span className="text-amber-400 flex items-center gap-0.5">
          <Flame className="size-3" />x{combo}
        </span>
      )}
    </Badge>
  );
}
