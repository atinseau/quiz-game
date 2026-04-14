import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAlcoholStore } from "../../../stores/alcoholStore";
import { useRoomStore } from "../../../stores/roomStore";

interface Props {
  data: Record<string, unknown>;
}

export function QuestionDeCourage({ data }: Props) {
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const ws = useRoomStore((s) => s.ws);
  const endActiveRound = useAlcoholStore((s) => s.endActiveRound);
  const addDrinkAlert = useAlcoholStore((s) => s.addDrinkAlert);
  const playerClerkId = data.playerClerkId as string;
  const playerName = data.playerName as string;
  // In solo mode myClerkId is null — treat the local player as "isMe"
  const isSolo = myClerkId === null;
  const isMe = isSolo || myClerkId === playerClerkId;

  // Use server-driven phase from data when available, fall back to local state for the decision countdown
  const serverPhase = data.phase as
    | "decision"
    | "question"
    | "result"
    | undefined;
  const [localPhase, setLocalPhase] = useState<
    "decision" | "question" | "waiting"
  >("decision");
  const phase = serverPhase ?? localPhase;

  const [countdown, setCountdown] = useState(10);
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    if (phase !== "decision") return;
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
  }, [phase]);

  const sendChoice = (accept: boolean) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "courage_choice", accept }));
    }
    if (isSolo) {
      if (!accept) {
        addDrinkAlert({
          emoji: "🥃",
          message: `${playerName} refuse — la moitié du verre !`,
        });
        setTimeout(() => endActiveRound(), 2000);
      } else {
        setLocalPhase("question");
      }
      return;
    }
    setLocalPhase(accept ? "question" : "waiting");
  };

  const sendAnswer = () => {
    if (!answer.trim()) return;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({ type: "courage_answer", answer: answer.trim() }),
      );
    }
    if (isSolo) {
      // In solo mode, show result immediately then end the round
      addDrinkAlert({
        emoji: "🎯",
        message: `${playerName} a répondu au défi !`,
      });
      setTimeout(() => endActiveRound(), 2000);
      return;
    }
    setLocalPhase("waiting");
  };

  const questionText = data.questionText as string | undefined;

  return (
    <Card className="bg-card/90 border-amber-500/30">
      <CardContent className="py-8 text-center">
        <span className="text-6xl block mb-4">🎰</span>
        <h2 className="text-2xl font-bold mb-2">Question de courage !</h2>
        <p className="text-lg mb-4">{playerName} est tiré au sort</p>

        {phase === "decision" && isMe && (
          <div className="space-y-3">
            <p className="text-3xl font-bold text-amber-400">{countdown}s</p>
            <p className="text-sm text-muted-foreground mb-4">
              Accepte le défi ou bois la moitié de ton verre
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                size="lg"
                onClick={() => sendChoice(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                J'accepte !
              </Button>
              <Button
                size="lg"
                variant="destructive"
                onClick={() => sendChoice(false)}
              >
                Je passe...
              </Button>
            </div>
          </div>
        )}
        {phase === "decision" && !isMe && (
          <p className="text-muted-foreground">
            {playerName} décide... {countdown}s
          </p>
        )}
        {phase === "question" && isMe && (
          <div className="space-y-4">
            <p className="text-lg font-semibold">
              {questionText ?? "Question difficile..."}
            </p>
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Ta réponse..."
              className="text-center"
              onKeyDown={(e) => e.key === "Enter" && sendAnswer()}
            />
            <Button onClick={sendAnswer} disabled={!answer.trim()}>
              Valider
            </Button>
          </div>
        )}
        {phase === "question" && !isMe && (
          <p className="text-muted-foreground">
            {playerName} répond au défi...
          </p>
        )}
        {phase === "result" && (
          <div className="space-y-2">
            <p className="text-2xl font-bold">
              {data.correct ? "✅ Bonne réponse !" : "❌ Mauvaise réponse !"}
            </p>
            {(data.pointsDelta as number) > 0 && (
              <p className="text-green-400">
                +{data.pointsDelta as number} pts
              </p>
            )}
          </div>
        )}
        {phase === "waiting" && (
          <p className="text-muted-foreground animate-pulse">En attente...</p>
        )}
      </CardContent>
    </Card>
  );
}
