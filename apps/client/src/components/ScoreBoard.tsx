interface Props {
  players: string[];
  scores: Record<string, number>;
  combos: Record<string, number>;
  currentPlayerIndex: number;
  isSolo: boolean;
}

export function ScoreBoard({
  players,
  scores,
  combos,
  currentPlayerIndex,
  isSolo,
}: Props) {
  if (isSolo) return null;

  return (
    <div className="mt-8 border-t border-gray-800 pt-4">
      <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
        Scores
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {players.map((p, i) => {
          const isActive = i === currentPlayerIndex;
          const combo = combos[p] ?? 0;
          return (
            <div
              key={p}
              className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${
                isActive
                  ? "bg-indigo-950 border-indigo-700"
                  : "bg-gray-800 border-gray-700"
              }`}
            >
              <span
                className={`font-medium text-sm ${isActive ? "text-indigo-300" : "text-gray-300"}`}
              >
                {p}
              </span>
              {combo >= 2 && (
                <span className="text-xs text-amber-400">x{combo}</span>
              )}
              <span
                className={`ml-auto font-bold ${isActive ? "text-indigo-400" : "text-white"}`}
              >
                {scores[p]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SoloScore({ score, combo }: { score: number; combo: number }) {
  const comboText = combo >= 2 ? ` x${combo}` : "";
  return (
    <span className="text-sm font-bold text-emerald-400">
      {score} pts{comboText}
    </span>
  );
}
