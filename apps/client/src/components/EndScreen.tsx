import { Crown, Medal, PartyPopper, RotateCcw, Trophy } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAlcoholStore } from "../stores/alcoholStore";
import { useGameStore } from "../stores/gameStore";
import { usePlayerStore } from "../stores/playerStore";
import { fireGameEnd } from "../utils/confetti";
import { DrinkAlert } from "./alcohol/DrinkAlert";

const MEDAL_ICONS = [Crown, Medal, Medal] as const;
const MEDAL_COLORS = [
  "text-yellow-400",
  "text-zinc-300",
  "text-amber-600",
] as const;

export function EndScreen() {
  const navigate = useNavigate();

  const scores = useGameStore((s) => s.scores);
  const reset = useGameStore((s) => s.reset);
  const totalQuestions = useGameStore((s) => s.totalQuestions)();
  const players = usePlayerStore((s) => s.players);

  const isSolo = players.length === 1;
  const currentDrinkAlert = useAlcoholStore((s) => s.currentDrinkAlert);
  const dismissCurrentDrinkAlert = useAlcoholStore(
    (s) => s.dismissCurrentDrinkAlert,
  );

  useEffect(() => {
    if (Object.keys(scores).length === 0) {
      navigate("/", { replace: true });
    }
  }, [scores, navigate]);

  useEffect(() => {
    fireGameEnd();
  }, []);

  if (Object.keys(scores).length === 0) return null;

  return (
    <>
      <div className="flex items-center justify-center min-h-screen px-4">
        <Card className="w-full max-w-lg text-center">
          <CardHeader className="pb-2">
            <div className="flex justify-center mb-2">
              <PartyPopper className="size-12 text-party-pink animate-float" />
            </div>
            <CardTitle className="text-4xl bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              Partie terminée !
            </CardTitle>
            <p className="text-muted-foreground mt-1">
              {isSolo ? "Ton score final" : "Voici le classement final"}
            </p>
          </CardHeader>
          <CardContent>
            {isSolo ? (
              <div className="bg-primary/10 border border-primary/30 rounded-2xl px-5 py-6 mb-8 glow-purple">
                <Trophy className="size-10 text-primary mx-auto mb-2" />
                <span className="text-5xl font-bold text-primary">
                  {scores[players[0]?.name ?? ""]}
                </span>
                <span className="text-xl text-muted-foreground ml-2">pts</span>
                <p className="text-muted-foreground mt-2 text-sm">
                  sur {totalQuestions} questions
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-8">
                {[...players]
                  .sort((a, b) => (scores[b.name] ?? 0) - (scores[a.name] ?? 0))
                  .map((p, i) => {
                    const MedalIcon = (i < 3 ? MEDAL_ICONS[i] : Medal) ?? Medal;
                    const medalColor =
                      (i < 3 ? MEDAL_COLORS[i] : "text-muted-foreground") ??
                      "text-muted-foreground";
                    const isWinner = i === 0;
                    return (
                      <div
                        key={p.name}
                        className={`flex items-center justify-between rounded-xl px-5 py-4 transition-all ${
                          isWinner
                            ? "bg-yellow-500/10 border border-yellow-500/30 glow-pink animate-bounce-in"
                            : "bg-card border border-border/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <MedalIcon className={`size-6 ${medalColor}`} />
                          <span
                            className={`font-semibold text-lg ${isWinner ? "text-glow-pink" : ""}`}
                          >
                            {p.name}
                          </span>
                        </div>
                        <span className={`text-2xl font-bold ${medalColor}`}>
                          {scores[p.name]} pts
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}

            <Button onClick={reset} size="lg" className="w-full h-14 text-lg">
              <RotateCcw className="size-5" />
              Nouvelle partie
            </Button>
          </CardContent>
        </Card>
      </div>
      {currentDrinkAlert && (
        <DrinkAlert
          key={currentDrinkAlert.id}
          emoji={currentDrinkAlert.emoji}
          message={currentDrinkAlert.message}
          details={currentDrinkAlert.details}
          onClose={dismissCurrentDrinkAlert}
        />
      )}
    </>
  );
}
