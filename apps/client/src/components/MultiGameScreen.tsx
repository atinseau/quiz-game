import { CheckCircle2, Clock, User, XCircle, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAlcoholStore } from "../stores/alcoholStore";
import { useRoomStore } from "../stores/roomStore";
import type { Player } from "../types";
import { CHRONO_DURATION } from "../types";
import { QcmChoices, TextInput, VraiFaux } from "./AnswerInputs";
import { DrinkAlert } from "./alcohol/DrinkAlert";
import { SpecialRoundOverlay } from "./alcohol/SpecialRoundOverlay";
import { ScoreBoard } from "./ScoreBoard";
// Side-effect import to trigger round registry initialization
import "./alcohol/rounds";

export function MultiGameScreen() {
  const navigate = useNavigate();
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const room = useRoomStore((s) => s.room);
  const game = useRoomStore((s) => s.game);
  const submitAnswer = useRoomStore((s) => s.submitAnswer);
  const isMyTurn = game.currentPlayerClerkId === myClerkId;

  const activeRound = useAlcoholStore((s) => s.activeRound);
  const activeRoundData = useAlcoholStore((s) => s.activeRoundData);
  const drinkAlerts = useAlcoholStore((s) => s.drinkAlerts);
  const removeDrinkAlert = useAlcoholStore((s) => s.removeDrinkAlert);

  // Local chrono timer
  const [timeLeft, setTimeLeft] = useState(CHRONO_DURATION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mode = room?.mode ?? "classic";
  const isVoleur = mode === "voleur";
  const isChrono = mode === "chrono";

  const question = game.question;

  // Build Player[] from room players for ScoreBoard
  const players: Player[] = (room?.players ?? []).map((p) => ({
    name: p.username,
    gender: p.gender,
  }));

  // ScoreBoard uses p.name (username) as key, but game scores are keyed by clerkId
  // Map clerkId -> username for scores/combos
  const clerkIdToUsername: Record<string, string> = {};
  for (const p of room?.players ?? []) {
    clerkIdToUsername[p.clerkId] = p.username;
  }

  const scoresByName: Record<string, number> = {};
  for (const [clerkId, score] of Object.entries(game.scores)) {
    const username = clerkIdToUsername[clerkId];
    if (username) scoresByName[username] = score;
  }

  const combosByName: Record<string, number> = {};
  for (const [clerkId, combo] of Object.entries(game.combos)) {
    const username = clerkIdToUsername[clerkId];
    if (username) combosByName[username] = combo;
  }

  // Find index of current player (the one whose turn it is)
  const currentPlayerIndex =
    room?.players.findIndex((p) => p.clerkId === game.currentPlayerClerkId) ??
    0;

  const currentPlayerUsername =
    room?.players.find((p) => p.clerkId === game.currentPlayerClerkId)
      ?.username ?? "";

  // Chrono timer: only run when it's my turn in chrono mode
  useEffect(() => {
    if (!isChrono || !isMyTurn || !game.startsAt || game.hasAnswered) {
      setTimeLeft(CHRONO_DURATION);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const startsAt = new Date(game.startsAt).getTime();

    const tick = () => {
      const elapsed = (Date.now() - startsAt) / 1000;
      const remaining = Math.max(0, CHRONO_DURATION - elapsed);
      setTimeLeft(Math.ceil(remaining));
    };

    tick();
    timerRef.current = setInterval(tick, 200);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isChrono, isMyTurn, game.startsAt, game.hasAnswered]);

  // Navigate to /end when game is over
  useEffect(() => {
    if (game.gameOver) {
      navigate("/end");
    }
  }, [game.gameOver, navigate]);

  // Determine if answer inputs should be disabled
  const inputDisabled = isVoleur
    ? game.hasAnswered
    : !(isMyTurn && !game.hasAnswered);

  const timerPercent = (timeLeft / CHRONO_DURATION) * 100;

  const handleAnswer = (value: string | boolean) => {
    submitAnswer(value);
  };

  if (!room || !question) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          En attente de la question...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8">
            {/* Header: question counter + category */}
            <div className="flex justify-between items-center mb-6">
              <Badge
                variant="outline"
                className="text-primary border-primary/30 bg-primary/10"
              >
                {question.category}
              </Badge>
              <div className="flex items-center gap-3">
                {isChrono && isMyTurn && !game.hasAnswered && (
                  <Badge
                    variant={timeLeft <= 5 ? "destructive" : "secondary"}
                    className={timeLeft <= 5 ? "animate-pulse" : ""}
                  >
                    <Clock className="size-3 mr-1" />
                    {timeLeft}s
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {game.questionIndex + 1}
                </span>
              </div>
            </div>

            {/* Chrono progress bar */}
            {isChrono && isMyTurn && !game.hasAnswered && (
              <Progress value={timerPercent} className="h-2 mb-5" />
            )}

            {/* Turn indicator */}
            <div className="mb-4">
              {isMyTurn ? (
                <p className="text-lg font-bold text-party-green">
                  {isVoleur
                    ? "C'est ton tour — Réponds en premier !"
                    : "C'est ton tour !"}
                </p>
              ) : isVoleur ? (
                <p className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
                  <Zap className="size-4" />
                  C'est au tour de{" "}
                  <span className="text-foreground">
                    {currentPlayerUsername}
                  </span>{" "}
                  — Tente de voler !
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  C'est au tour de{" "}
                  <span className="font-semibold text-foreground">
                    {currentPlayerUsername}
                  </span>
                </p>
              )}
            </div>

            {/* Question text */}
            <p className="text-xl font-semibold my-6 leading-relaxed">
              {question.text}
            </p>

            {/* Answer inputs */}
            {question.type === "qcm" && (
              <QcmChoices
                choices={question.choices ?? []}
                disabled={inputDisabled}
                onSelect={handleAnswer}
              />
            )}

            {question.type === "vrai_faux" && (
              <VraiFaux disabled={inputDisabled} onSelect={handleAnswer} />
            )}

            {question.type === "texte" && (
              <TextInput
                key={game.questionIndex}
                disabled={inputDisabled}
                onSubmit={handleAnswer}
              />
            )}

            {/* Answered badges (voleur mode) */}
            {isVoleur && game.answeredPlayers.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {game.answeredPlayers.map((clerkId) => {
                  const username = clerkIdToUsername[clerkId] ?? clerkId;
                  return (
                    <Badge key={clerkId} variant="secondary" className="gap-1">
                      <User className="size-3" />
                      {username} a répondu
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Turn result feedback */}
            {game.turnResult &&
              (() => {
                const myResult = game.turnResult.playerResults.find(
                  (r) => r.clerkId === myClerkId,
                );
                const isCorrect = myResult?.correct ?? false;
                const points = myResult?.pointsDelta ?? 0;
                return (
                  <div
                    className={`mt-6 rounded-lg p-4 flex items-start gap-3 ${
                      isCorrect
                        ? "bg-emerald-500/10 border border-emerald-500/30"
                        : "bg-red-500/10 border border-red-500/30"
                    }`}
                  >
                    {isCorrect ? (
                      <CheckCircle2 className="size-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="size-5 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p
                        className={`font-semibold ${isCorrect ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {isCorrect ? "Bonne réponse !" : "Mauvaise réponse"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Réponse correcte :{" "}
                        <span className="font-medium text-foreground">
                          {String(game.turnResult.correctAnswer)}
                        </span>
                      </p>
                      {points !== 0 && (
                        <p className="text-sm mt-1">
                          {points > 0 ? "+" : ""}
                          {points} pt
                          {Math.abs(points) > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

            {/* Scoreboard */}
            <ScoreBoard
              players={players}
              scores={scoresByName}
              combos={combosByName}
              currentPlayerIndex={
                currentPlayerIndex < 0 ? 0 : currentPlayerIndex
              }
              isSolo={false}
            />
          </CardContent>
        </Card>
      </div>

      {/* Alcohol overlays */}
      {activeRound && activeRoundData && (
        <SpecialRoundOverlay roundType={activeRound} data={activeRoundData} />
      )}
      {drinkAlerts.map((alert) => (
        <DrinkAlert
          key={alert.id}
          emoji={alert.emoji}
          message={alert.message}
          onClose={() => removeDrinkAlert(alert.id)}
        />
      ))}
    </>
  );
}
