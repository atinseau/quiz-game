import { Beer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AlcoholConfig as AlcoholConfigType,
  SpecialRoundType,
} from "../../stores/alcoholStore";

interface AlcoholConfigProps extends AlcoholConfigType {
  onChange: (config: AlcoholConfigType) => void;
}

const ROUNDS: {
  id: SpecialRoundType;
  name: string;
  emoji: string;
  available: boolean;
}[] = [
  { id: "petit_buveur", name: "Petit buveur", emoji: "🍺", available: true },
  { id: "distributeur", name: "Distributeur", emoji: "🎯", available: true },
  { id: "courage", name: "Question de courage", emoji: "🎰", available: true },
  { id: "conseil", name: "Conseil du village", emoji: "🗳️", available: false },
  { id: "love_or_drink", name: "Love or Drink", emoji: "💋", available: false },
  { id: "cupidon", name: "Cupidon", emoji: "💘", available: false },
  { id: "show_us", name: "Show Us", emoji: "👀", available: false },
  {
    id: "smatch_or_pass",
    name: "Smatch or Pass",
    emoji: "💥",
    available: false,
  },
];

export function AlcoholConfig({
  enabled,
  frequency,
  enabledRounds,
  culSecEndGame,
  onChange,
}: AlcoholConfigProps) {
  const toggle = () =>
    onChange({ enabled: !enabled, frequency, enabledRounds, culSecEndGame });
  const setFreq = (f: number) =>
    onChange({ enabled, frequency: f, enabledRounds, culSecEndGame });
  const toggleRound = (id: SpecialRoundType) => {
    const next = enabledRounds.includes(id)
      ? enabledRounds.filter((r) => r !== id)
      : [...enabledRounds, id];
    onChange({ enabled, frequency, enabledRounds: next, culSecEndGame });
  };
  const toggleCulSec = () =>
    onChange({
      enabled,
      frequency,
      enabledRounds,
      culSecEndGame: !culSecEndGame,
    });

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Beer className="size-5 text-amber-500" />
            Mode Soirée
          </span>
          <Button
            variant={enabled ? "default" : "outline"}
            size="sm"
            onClick={toggle}
            className={enabled ? "bg-amber-600 hover:bg-amber-700" : ""}
          >
            {enabled ? "Activé 🍻" : "Désactivé"}
          </Button>
        </CardTitle>
      </CardHeader>
      {enabled && (
        <CardContent className="space-y-6">
          <div>
            <p className="text-sm font-medium mb-2">
              Manche spéciale tous les{" "}
              <strong className="text-amber-400">{frequency}</strong> tours
            </p>
            <div className="flex gap-2 flex-wrap">
              {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={frequency === n ? "default" : "outline"}
                  className={frequency === n ? "bg-amber-600" : ""}
                  onClick={() => setFreq(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Manches actives</p>
            <div className="space-y-2">
              {ROUNDS.map((round) => (
                <button
                  type="button"
                  key={round.id}
                  disabled={!round.available}
                  onClick={() => round.available && toggleRound(round.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                    !round.available
                      ? "opacity-40 cursor-not-allowed"
                      : enabledRounds.includes(round.id)
                        ? "bg-amber-500/20 ring-1 ring-amber-500/30"
                        : "bg-card/50 hover:bg-card/80"
                  }`}
                >
                  <span className="text-xl">{round.emoji}</span>
                  <span className="flex-1 text-sm font-medium">
                    {round.name}
                  </span>
                  {!round.available && (
                    <Badge variant="secondary" className="text-xs">
                      Bientôt
                    </Badge>
                  )}
                  {round.available && enabledRounds.includes(round.id) && (
                    <span className="text-amber-400 text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleCulSec}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
              culSecEndGame
                ? "bg-red-500/20 ring-1 ring-red-500/30"
                : "bg-card/50 hover:bg-card/80"
            }`}
          >
            <span className="text-xl">🍻</span>
            <span className="flex-1 text-sm font-medium">
              Le perdant boit cul sec
            </span>
            {culSecEndGame && <span className="text-red-400 text-sm">✓</span>}
          </button>
        </CardContent>
      )}
    </Card>
  );
}
