import { Check, ChevronRight, RotateCcw, Star, X } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useGameStore } from "../stores/gameStore";
import { usePlayerStore } from "../stores/playerStore";
import { CHRONO_DURATION } from "../types";
import { BlindInput, QcmChoices, TextInput, VraiFaux } from "./AnswerInputs";
import { Feedback } from "./Feedback";
import { ScoreBoard, SoloScore } from "./ScoreBoard";
import { StealZone } from "./StealZone";

export function GameScreen() {
  const navigate = useNavigate();

  const questions = useGameStore((s) => s.questions);
  const currentQuestionIndex = useGameStore((s) => s.currentQuestionIndex);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const scores = useGameStore((s) => s.scores);
  const combos = useGameStore((s) => s.combos);
  const answered = useGameStore((s) => s.answered);
  const blindMode = useGameStore((s) => s.blindMode);
  const feedback = useGameStore((s) => s.feedback);
  const showForceBtn = useGameStore((s) => s.showForceBtn);
  const stealConfirmMode = useGameStore((s) => s.stealConfirmMode);
  const gameMode = useGameStore((s) => s.gameMode);
  const timeLeft = useGameStore((s) => s.timeLeft);

  const currentQuestion = useGameStore((s) => s.currentQuestion)();
  const currentPlayer = useGameStore((s) => s.currentPlayer)();
  const totalQuestions = useGameStore((s) => s.totalQuestions)();
  const isSolo = useGameStore((s) => s.isSolo)();
  const canSteal = useGameStore((s) => s.canSteal)();

  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const submitBlindAnswer = useGameStore((s) => s.submitBlindAnswer);
  const revealChoices = useGameStore((s) => s.revealChoices);
  const initiateSteal = useGameStore((s) => s.initiateSteal);
  const confirmSteal = useGameStore((s) => s.confirmSteal);
  const forcePoint = useGameStore((s) => s.forcePoint);
  const nextQuestion = useGameStore((s) => s.nextQuestion);
  const reset = useGameStore((s) => s.reset);

  const players = usePlayerStore((s) => s.players);

  useEffect(() => {
    if (questions.length === 0) {
      navigate("/", { replace: true });
    }
  }, [questions.length, navigate]);

  if (questions.length === 0 || !currentQuestion) return null;

  const timerPercent = (timeLeft / CHRONO_DURATION) * 100;

  return (
    <>
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <Badge
                variant="outline"
                className="text-primary border-primary/30 bg-primary/10"
              >
                {currentQuestion.category}
              </Badge>
              <div className="flex items-center gap-3">
                {gameMode === "chrono" && !answered && (
                  <Badge
                    variant={timeLeft <= 5 ? "destructive" : "secondary"}
                    className={timeLeft <= 5 ? "animate-pulse" : ""}
                  >
                    {timeLeft}s
                  </Badge>
                )}
                {isSolo && (
                  <SoloScore
                    score={scores[players[0] ?? ""] ?? 0}
                    combo={combos[players[0] ?? ""] ?? 0}
                  />
                )}
                <span className="text-sm text-muted-foreground">
                  {currentQuestionIndex + 1} / {totalQuestions}
                </span>
              </div>
            </div>

            {/* Timer bar */}
            {gameMode === "chrono" && !answered && (
              <Progress value={timerPercent} className="h-2 mb-5" />
            )}

            {/* Player turn */}
            {!isSolo && (
              <div className="mb-3">
                <p className="text-sm text-muted-foreground">
                  C'est au tour de
                </p>
                <p className="text-2xl font-bold text-party-green">
                  {currentPlayer}
                </p>
              </div>
            )}

            {/* Question */}
            <p className="text-xl font-semibold my-6 leading-relaxed">
              {currentQuestion.question}
            </p>

            {/* Answer inputs */}
            {currentQuestion.type === "qcm" && blindMode && !answered && (
              <BlindInput
                onSubmit={submitBlindAnswer}
                onReveal={revealChoices}
              />
            )}

            {currentQuestion.type === "qcm" && !blindMode && (
              <QcmChoices
                choices={currentQuestion.choices || []}
                disabled={answered}
                onSelect={(c) => submitAnswer(c)}
              />
            )}

            {currentQuestion.type === "vrai_faux" && (
              <VraiFaux disabled={answered} onSelect={(v) => submitAnswer(v)} />
            )}

            {currentQuestion.type === "texte" && (
              <TextInput
                key={currentQuestionIndex}
                disabled={answered}
                onSubmit={(v) => submitAnswer(v)}
              />
            )}

            {/* Feedback */}
            <Feedback feedback={feedback} />

            {/* Steal zone */}
            {canSteal && !stealConfirmMode && (
              <StealZone
                players={players}
                currentPlayerIndex={currentPlayerIndex}
                isSolo={false}
                onSteal={initiateSteal}
              />
            )}

            {/* Action buttons */}
            {(answered || stealConfirmMode) && (
              <div className="mt-6 flex gap-3">
                {stealConfirmMode ? (
                  <>
                    <Button
                      variant="default"
                      size="lg"
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500"
                      onClick={() => confirmSteal(true)}
                    >
                      <Check className="size-5" />
                      Valider le vol
                    </Button>
                    <Button
                      variant="destructive"
                      size="lg"
                      className="flex-1"
                      onClick={() => confirmSteal(false)}
                    >
                      <X className="size-5" />
                      Refuser
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="lg" className="flex-1" onClick={nextQuestion}>
                      <ChevronRight className="size-5" />
                      Question suivante
                    </Button>
                    {showForceBtn && gameMode !== "chrono" && (
                      <Button
                        variant="outline"
                        size="lg"
                        className="border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
                        onClick={forcePoint}
                      >
                        <Star className="size-5" />
                        Compter le point
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Scores */}
            <ScoreBoard
              players={players}
              scores={scores}
              combos={combos}
              currentPlayerIndex={currentPlayerIndex}
              isSolo={isSolo}
            />
          </CardContent>
        </Card>
      </div>

      {/* Floating reset button */}
      <Button
        variant="destructive"
        size="icon"
        className="fixed bottom-6 right-6 size-12 rounded-full shadow-lg"
        onClick={reset}
        title="Recommencer la partie"
      >
        <RotateCcw className="size-5" />
      </Button>
    </>
  );
}
