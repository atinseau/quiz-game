import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

  // Route guard: if no questions loaded, redirect home
  useEffect(() => {
    if (questions.length === 0) {
      navigate("/", { replace: true });
    }
  }, [questions.length, navigate]);

  if (questions.length === 0 || !currentQuestion) return null;

  return (
    <>
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-10 w-full max-w-2xl mx-4">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-950 px-3 py-1 rounded-full">
                {currentQuestion.category}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {gameMode === "chrono" && !answered && (
                <span
                  className={`text-sm font-bold px-3 py-1 rounded-full ${
                    timeLeft <= 5
                      ? "bg-red-950 text-red-400 animate-pulse"
                      : "bg-gray-800 text-gray-300"
                  }`}
                >
                  {timeLeft}s
                </span>
              )}
              {isSolo && (
                <SoloScore
                  score={scores[players[0]!] ?? 0}
                  combo={combos[players[0]!] ?? 0}
                />
              )}
              <span className="text-sm text-gray-400">
                Question {currentQuestionIndex + 1} / {totalQuestions}
              </span>
            </div>
          </div>

          {/* Timer bar */}
          {gameMode === "chrono" && !answered && (
            <div className="w-full bg-gray-800 rounded-full h-1.5 mb-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                  timeLeft <= 5 ? "bg-red-500" : "bg-indigo-500"
                }`}
                style={{ width: `${(timeLeft / CHRONO_DURATION) * 100}%` }}
              />
            </div>
          )}

          {/* Player turn */}
          {!isSolo && (
            <div className="mb-2">
              <p className="text-sm text-gray-400">C'est au tour de</p>
              <p className="text-2xl font-bold text-emerald-400">
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
            <BlindInput onSubmit={submitBlindAnswer} onReveal={revealChoices} />
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
            <TextInput disabled={answered} onSubmit={(v) => submitAnswer(v)} />
          )}

          {/* Feedback */}
          <Feedback feedback={feedback} />

          {/* Steal zone */}
          {canSteal && !stealConfirmMode && (
            <StealZone
              players={players}
              currentPlayerIndex={currentPlayerIndex}
              isSolo={false}
              answered={answered}
              onSteal={initiateSteal}
            />
          )}

          {/* Action buttons */}
          {(answered || stealConfirmMode) && (
            <div className="mt-6 flex gap-3">
              {stealConfirmMode ? (
                <>
                  <button
                    onClick={() => confirmSteal(true)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-lg transition-colors"
                  >
                    Valider le vol
                  </button>
                  <button
                    onClick={() => confirmSteal(false)}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-lg transition-colors"
                  >
                    Refuser
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={nextQuestion}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-lg transition-colors"
                  >
                    Question suivante
                  </button>
                  {showForceBtn && gameMode !== "chrono" && (
                    <button
                      onClick={forcePoint}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-5 rounded-xl text-lg transition-colors"
                    >
                      Compter le point
                    </button>
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
        </div>
      </div>

      {/* Floating reset button */}
      <button
        onClick={reset}
        className="fixed bottom-6 right-6 bg-red-600 hover:bg-red-500 text-white p-3 rounded-full shadow-lg transition-colors"
        title="Recommencer la partie"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.36-5.36M20 15a9 9 0 01-15.36 5.36"
          />
        </svg>
      </button>
    </>
  );
}
