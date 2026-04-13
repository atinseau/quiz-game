interface Props {
  players: string[];
  currentPlayerIndex: number;
  isSolo: boolean;
  answered: boolean;
  onSteal: (stealer: string) => void;
}

export function StealZone({ players, currentPlayerIndex, isSolo, answered, onSteal }: Props) {
  if (isSolo || answered) return null;

  const otherPlayers = players.filter((_, i) => i !== currentPlayerIndex);

  return (
    <div className="mt-4 border border-gray-800 rounded-xl p-3">
      <p className="text-xs text-gray-500 mb-2 text-center uppercase tracking-wider">
        Quelqu'un a répondu plus vite ?
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {otherPlayers.map((p) => (
          <button
            key={p}
            onClick={() => onSteal(p)}
            className="bg-gray-800 hover:bg-amber-900 border border-gray-700 hover:border-amber-500 text-gray-300 hover:text-amber-300 font-medium text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
