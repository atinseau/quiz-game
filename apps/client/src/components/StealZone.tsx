import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Player } from "../types";

interface Props {
  players: Player[];
  currentPlayerIndex: number;
  isSolo: boolean;
  onSteal: (stealer: string) => void;
}

export function StealZone({
  players,
  currentPlayerIndex,
  isSolo,
  onSteal,
}: Props) {
  if (isSolo) return null;

  const otherPlayers = players.filter((_, i) => i !== currentPlayerIndex);

  return (
    <div className="mt-4 border border-amber-500/20 bg-amber-500/5 rounded-xl p-3">
      <p className="text-xs text-amber-400/70 mb-2 text-center uppercase tracking-wider flex items-center justify-center gap-1">
        <Zap className="size-3" />
        Quelqu'un a repondu plus vite ?
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {otherPlayers.map((p) => (
          <Button
            key={p.name}
            variant="outline"
            size="sm"
            onClick={() => onSteal(p.name)}
            className="border-amber-500/30 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400"
          >
            <Zap className="size-3" />
            {p.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
