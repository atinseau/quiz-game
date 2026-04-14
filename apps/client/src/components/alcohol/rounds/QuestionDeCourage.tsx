import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRoomStore } from "../../../stores/roomStore";

interface Props {
  data: Record<string, unknown>;
}

export function QuestionDeCourage({ data }: Props) {
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const ws = useRoomStore((s) => s.ws);
  const playerClerkId = data.playerClerkId as string;
  const playerName = data.playerName as string;
  const isMe = myClerkId === playerClerkId;
  const [phase, setPhase] = useState<"decision" | "question" | "waiting">(
    "decision",
  );
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
    setPhase(accept ? "question" : "waiting");
  };

  const sendAnswer = () => {
    if (!answer.trim()) return;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({ type: "courage_answer", answer: answer.trim() }),
      );
    }
    setPhase("waiting");
  };

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
              {(data.questionText as string) ?? "Question difficile..."}
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
        {phase === "waiting" && (
          <p className="text-muted-foreground animate-pulse">En attente...</p>
        )}
      </CardContent>
    </Card>
  );
}
