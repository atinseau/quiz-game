import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAlcoholStore } from "../../../stores/alcoholStore";
import { useRoomStore } from "../../../stores/roomStore";

interface Props {
  data: Record<string, unknown>;
}

type PlayerInfo = { clerkId: string; username: string; gender: string };

function genderSymbol(gender: string) {
  return gender === "homme" ? "♂" : "♀";
}

export function SmatchOrPass({ data }: Props) {
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const ws = useRoomStore((s) => s.ws);
  const endActiveRound = useAlcoholStore((s) => s.endActiveRound);

  const decideur = data.decideur as PlayerInfo | undefined;
  const receveur = data.receveur as PlayerInfo | undefined;

  const resultChoice = data.choice as "smatch" | "pass" | undefined;
  const [localResult, setLocalResult] = useState<"smatch" | "pass" | null>(
    null,
  );

  const result = resultChoice ?? localResult;

  const isSolo = myClerkId === null;
  const isDecideur = isSolo || myClerkId === decideur?.clerkId;

  const sendChoice = (choice: "smatch" | "pass") => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "smatch_choice", choice }));
    }
    if (isSolo) {
      setLocalResult(choice);
      setTimeout(() => endActiveRound(), 5000);
    }
  };

  if (!decideur || !receveur) return null;

  return (
    <Card className="bg-card/90 border-rose-500/30">
      <CardContent className="py-8 text-center">
        <span className="text-6xl block mb-4">💋</span>
        <h2 className="text-2xl font-bold mb-6">Smatch or Pass !</h2>

        <div className="flex items-center justify-center gap-6 mb-8">
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">
              {genderSymbol(decideur.gender) === "♂" ? "👨" : "👩"}
            </span>
            <p className="text-lg font-semibold text-rose-400">
              {decideur.username}
            </p>
            <span className="text-xl text-muted-foreground">
              {genderSymbol(decideur.gender)}
            </span>
            {isDecideur && result === null && (
              <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full">
                toi
              </span>
            )}
          </div>

          <span className="text-3xl">🆚</span>

          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">
              {genderSymbol(receveur.gender) === "♂" ? "👨" : "👩"}
            </span>
            <p className="text-lg font-semibold text-rose-400">
              {receveur.username}
            </p>
            <span className="text-xl text-muted-foreground">
              {genderSymbol(receveur.gender)}
            </span>
          </div>
        </div>

        {result === null && isDecideur && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              {decideur.username}, c&apos;est à toi de décider !
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => sendChoice("smatch")}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Smatch 💋
              </Button>
              <Button
                size="lg"
                onClick={() => sendChoice("pass")}
                className="bg-slate-600 hover:bg-slate-700 text-white"
              >
                Pass 👋
              </Button>
            </div>
          </div>
        )}

        {result === null && !isDecideur && (
          <p className="text-muted-foreground animate-pulse">
            En attente de la décision...
          </p>
        )}

        {result === "smatch" && (
          <div className="space-y-2">
            <p className="text-2xl font-bold text-rose-400 animate-bounce">
              💋 Smatch !
            </p>
            <p className="text-muted-foreground">
              {decideur.username} a smatché {receveur.username} !
            </p>
          </div>
        )}

        {result === "pass" && (
          <div className="space-y-2">
            <p className="text-2xl font-bold text-slate-400">👋 Pass !</p>
            <p className="text-muted-foreground">
              {decideur.username} a passé son tour.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
