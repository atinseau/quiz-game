import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../stores/gameStore";
import { usePlayerStore } from "../stores/playerStore";

const MEDALS = ["text-yellow-400", "text-gray-300", "text-amber-600"];

export function EndScreen() {
  const navigate = useNavigate();

  const scores = useGameStore((s) => s.scores);
  const reset = useGameStore((s) => s.reset);
  const totalQuestions = useGameStore((s) => s.totalQuestions)();
  const players = usePlayerStore((s) => s.players);

  const isSolo = players.length === 1;

  // Route guard: if no scores, redirect home
  useEffect(() => {
    if (Object.keys(scores).length === 0) {
      navigate("/", { replace: true });
    }
  }, [scores, navigate]);

  if (Object.keys(scores).length === 0) return null;

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-gray-900 rounded-2xl shadow-2xl p-10 w-full max-w-lg mx-4 text-center">
        <h2 className="text-4xl font-bold mb-2 text-indigo-400">Partie terminée !</h2>
        <p className="text-gray-400 mb-8">{isSolo ? "Ton score final" : "Voici le classement final"}</p>

        {isSolo ? (
          <div className="bg-indigo-950 border border-indigo-700 rounded-xl px-5 py-6 mb-8">
            <span className="text-5xl font-bold text-indigo-400">{scores[players[0]!]}</span>
            <span className="text-xl text-gray-400 ml-2">pts</span>
            <p className="text-gray-400 mt-2 text-sm">sur {totalQuestions} questions</p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {[...players]
              .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
              .map((p, i) => {
                const medal = i < 3 ? MEDALS[i] : "text-gray-400";
                const bg = i === 0 ? "bg-yellow-950 border-yellow-700" : "bg-gray-800 border-gray-700";
                return (
                  <div key={p} className={`flex items-center justify-between ${bg} border rounded-xl px-5 py-4`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-bold ${medal}`}>#{i + 1}</span>
                      <span className="font-semibold text-lg">{p}</span>
                    </div>
                    <span className={`text-2xl font-bold ${medal}`}>{scores[p]} pts</span>
                  </div>
                );
              })}
          </div>
        )}

        <button
          onClick={reset}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-lg transition-colors"
        >
          Nouvelle partie
        </button>
      </div>
    </div>
  );
}
