import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAlcoholStore } from "../../../stores/alcoholStore";
import { useRoomStore } from "../../../stores/roomStore";

const COLORS = ["Bleu", "Noir", "Blanc", "Rouge", "Autre"] as const;
type Color = (typeof COLORS)[number];

interface Props {
  data: Record<string, unknown>;
}

type Phase = "voting" | "waiting_reveal" | "result";

export function ShowUs({ data }: Props) {
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const ws = useRoomStore((s) => s.ws);
  const addDrinkAlert = useAlcoholStore((s) => s.addDrinkAlert);
  const endActiveRound = useAlcoholStore((s) => s.endActiveRound);

  const targetClerkId = data.targetClerkId as string;
  const targetName = data.targetName as string;

  const isSolo = myClerkId === null;
  const isTarget = isSolo || myClerkId === targetClerkId;

  // Phase driven by server data updates
  const serverPhase = data.phase as Phase | undefined;
  const [localPhase, setLocalPhase] = useState<Phase>("voting");
  const phase = serverPhase ?? localPhase;

  const correctColor = data.correctColor as Color | null | undefined;
  const wrongClerkIds = (data.wrongClerkIds as string[]) ?? [];
  const timedOut = data.timedOut as boolean | undefined;

  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [countdown, setCountdown] = useState(15);
  const [revealed, setRevealed] = useState(false);

  // Countdown for voters
  useEffect(() => {
    if (phase !== "voting" || isTarget) return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, isTarget]);

  // Detect result phase from data
  useEffect(() => {
    if (data.correctColor !== undefined || data.timedOut) {
      setLocalPhase("result");
    }
  }, [data.correctColor, data.timedOut]);

  const sendVote = (color: Color) => {
    if (selectedColor) return;
    setSelectedColor(color);

    if (isSolo) {
      // Solo: target picks color immediately after voters "voted"
      setLocalPhase("waiting_reveal");
      return;
    }

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "show_us_vote", color }));
    }
    setLocalPhase("waiting_reveal");
  };

  const sendReveal = (color: Color) => {
    if (revealed) return;
    setRevealed(true);

    if (isSolo) {
      // Solo: compare with selected voter color (if any)
      const isWrong = selectedColor && selectedColor !== color;
      if (isWrong) {
        addDrinkAlert({
          emoji: "🍺",
          message: `Mauvaise réponse — bois une gorgée !`,
        });
      }
      setTimeout(() => endActiveRound(), 5000);
      setLocalPhase("result");
      return;
    }

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "show_us_reveal", color }));
    }
    setLocalPhase("waiting_reveal");
  };

  const amIWrong = myClerkId ? wrongClerkIds.includes(myClerkId) : false;

  return (
    <Card className="bg-card/90 border-amber-500/30">
      <CardContent className="py-8 text-center">
        <span className="text-6xl block mb-4">👀</span>
        <h2 className="text-2xl font-bold mb-2">Show Us !</h2>

        {/* VOTING PHASE */}
        {phase === "voting" &&
          (isTarget ? (
            <div className="space-y-3">
              <p className="text-muted-foreground mb-4">
                Les autres devinent ta couleur... attends !
              </p>
              <p className="text-sm text-amber-400 animate-pulse">
                Tu révèleras ta couleur ensuite
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-lg mb-2">
                De quelle couleur est{" "}
                <span className="font-bold text-amber-400">{targetName}</span>{" "}
                habillé(e) ?
              </p>
              <p className="text-3xl font-bold text-amber-400 mb-4">
                {countdown}s
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {COLORS.map((color) => (
                  <Button
                    key={color}
                    size="lg"
                    variant={selectedColor === color ? "default" : "outline"}
                    onClick={() => sendVote(color)}
                    disabled={!!selectedColor}
                    className={
                      selectedColor === color
                        ? "border-amber-400 bg-amber-500/20"
                        : ""
                    }
                  >
                    {color}
                  </Button>
                ))}
              </div>
            </div>
          ))}

        {/* WAITING REVEAL PHASE */}
        {phase === "waiting_reveal" &&
          (isTarget ? (
            <div className="space-y-3">
              <p className="text-lg mb-4">
                Les autres ont voté ! Révèle maintenant ta couleur.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {COLORS.map((color) => (
                  <Button
                    key={color}
                    size="lg"
                    onClick={() => sendReveal(color)}
                    disabled={revealed}
                    className="w-full"
                  >
                    {color}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground animate-pulse mb-2">
                {selectedColor
                  ? `Tu as voté : ${selectedColor}`
                  : "En attente de ta réponse..."}
              </p>
              <p className="text-sm text-muted-foreground">
                En attente que {targetName} révèle sa couleur...
              </p>
            </div>
          ))}

        {/* RESULT PHASE */}
        {phase === "result" && (
          <div className="space-y-3">
            {timedOut ? (
              <p className="text-muted-foreground">
                Temps écoulé — personne n'a répondu.
              </p>
            ) : (
              <>
                <p className="text-lg">
                  Couleur de{" "}
                  <span className="font-bold text-amber-400">{targetName}</span>{" "}
                  :
                </p>
                <p className="text-3xl font-bold text-amber-400">
                  {correctColor}
                </p>
                {isSolo ? (
                  <p className="text-sm text-muted-foreground mt-2">
                    {selectedColor === correctColor
                      ? "✅ Bonne réponse !"
                      : "❌ Mauvaise réponse — bois une gorgée !"}
                  </p>
                ) : amIWrong ? (
                  <p className="text-red-400 font-semibold mt-2">
                    ❌ Tu t'es planté(e) — bois une gorgée !
                  </p>
                ) : myClerkId === targetClerkId ? (
                  <p className="text-green-400 font-semibold mt-2">
                    Tu as été deviné(e) !
                  </p>
                ) : (
                  <p className="text-green-400 font-semibold mt-2">
                    ✅ Bonne réponse !
                  </p>
                )}
                {wrongClerkIds.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {wrongClerkIds.length} joueur
                    {wrongClerkIds.length > 1 ? "s" : ""} ont bu.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
