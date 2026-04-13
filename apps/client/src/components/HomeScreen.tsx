import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from "react";
import type { PackMeta, GameMode } from "../types";
import { GAME_MODES } from "../types";
import { getFinishedChunks } from "../utils/storage";

interface Props {
  players: string[];
  selectedChunk: string | null;
  onAddPlayer: (name: string) => boolean;
  onRemovePlayer: (name: string) => void;
  onSelectChunk: (chunk: string) => void;
  onStart: (chunk: string, mode: GameMode) => void;
}

export function HomeScreen({ players, selectedChunk, onAddPlayer, onRemovePlayer, onSelectChunk, onStart }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");
  const [packs, setPacks] = useState<PackMeta[]>([]);
  const [step, setStep] = useState<"pack" | "mode" | "players">("pack");
  const [selectedMode, setSelectedMode] = useState<GameMode>("classic");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(6);
  const gridRef = useRef<HTMLDivElement>(null);
  const finishedChunks = getFinishedChunks();

  // Calcul dynamique du nombre de cards par page selon l'espace dispo
  const computePerPage = useCallback(() => {
    const vh = window.innerHeight;
    const headerHeight = 200; // titre + search bar + marges
    const paginationHeight = 60;
    const available = vh - headerHeight - paginationHeight;
    // Estimer la hauteur d'une card (~160px) et le nombre de colonnes
    const cardHeight = 160;
    const gap = 16;
    const w = window.innerWidth;
    const cols = w >= 1024 ? 3 : w >= 640 ? 2 : 1;
    const rows = Math.max(1, Math.floor(available / (cardHeight + gap)));
    return cols * rows;
  }, []);

  useEffect(() => {
    const update = () => setPerPage(computePerPage());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [computePerPage]);

  useEffect(() => {
    fetch("/packs.json")
      .then((r) => r.json())
      .then((data: PackMeta[]) => {
        setPacks(data);
        if (!selectedChunk) {
          const firstUnfinished = data.find((p) => !finishedChunks.includes(p.file));
          onSelectChunk(firstUnfinished?.file || data[0]?.file || "");
        }
      });
  }, []);

  const handleAdd = () => {
    if (onAddPlayer(inputValue)) setInputValue("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  const selectedPack = packs.find((p) => p.file === selectedChunk);
  const canStart = players.length >= 1 && selectedChunk;

  // Step 1: Pack selection
  if (step === "pack") {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-center mb-2 text-indigo-400">Quiz</h1>
          <p className="text-center text-gray-400 mb-6 sm:mb-8">Choisis ton pack de questions</p>

          <div className="mb-5 sm:mb-6">
            <input
              type="text"
              placeholder="Rechercher un pack..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-5 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm sm:text-base"
            />
          </div>

          {(() => {
            const filtered = packs.filter((p) => {
              if (!search.trim()) return true;
              const q = search.toLowerCase();
              return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
            });
            const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
            const safePage = Math.min(page, totalPages - 1);
            const pageItems = filtered.slice(safePage * perPage, (safePage + 1) * perPage);

            return (
              <>
                <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {pageItems.map((pack) => {
                    const done = finishedChunks.includes(pack.file);
                    const active = pack.file === selectedChunk;
                    return (
                      <button
                        key={pack.file}
                        onClick={() => {
                          onSelectChunk(pack.file);
                          setStep("players");
                        }}
                        className={`relative text-left rounded-xl overflow-hidden transition-all duration-200 ${
                          active
                            ? "ring-2 ring-indigo-400 scale-[1.02]"
                            : "ring-1 ring-gray-800 hover:ring-gray-600 hover:scale-[1.01]"
                        }`}
                      >
                        <div className={`bg-gradient-to-br ${pack.gradient} px-4 sm:px-5 py-5 sm:py-6 flex items-center gap-3 sm:gap-4`}>
                          <span className="text-3xl sm:text-4xl">{pack.icon}</span>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-white text-base sm:text-lg leading-tight truncate">{pack.name}</h3>
                            {done && (
                              <span className="inline-block mt-1 text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                                Terminé
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="bg-gray-900 px-4 sm:px-5 py-3 sm:py-4">
                          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">{pack.description}</p>
                          {pack.questionCount != null && (
                            <p className="text-xs text-gray-500 mt-2">{pack.questionCount} questions</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      className="px-3 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                          i === safePage
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage === totalPages - 1}
                      className="px-3 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    );
  }

  // Step 2: Players
  if (step === "players") {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-md">
          <button
            onClick={() => setStep("pack")}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Changer de mode
        </button>

        {/* Pack summary */}
        {selectedPack && (
          <div className={`bg-gradient-to-br ${selectedPack.gradient} rounded-xl px-5 py-4 flex items-center gap-4 mb-8`}>
            <span className="text-3xl">{selectedPack.icon}</span>
            <div>
              <h2 className="font-bold text-white text-lg">{selectedPack.name}</h2>
              <p className="text-white/70 text-sm">{selectedPack.description}</p>
            </div>
          </div>
        )}

        <div className="bg-gray-900 rounded-2xl shadow-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Qui joue ?</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Nom du joueur"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              maxLength={20}
              autoFocus
            />
            <button
              onClick={handleAdd}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              Ajouter
            </button>
          </div>

          {players.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <div key={p} className="flex items-center gap-2 bg-gray-800 rounded-full px-4 py-1.5">
                  <span className="font-medium text-sm">{p}</span>
                  <button
                    onClick={() => onRemovePlayer(p)}
                    className="text-gray-500 hover:text-red-400 text-lg leading-none"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          {players.length === 0 && (
            <p className="text-sm text-gray-500">Ajoute au moins un joueur pour commencer</p>
          )}
        </div>

        <button
          onClick={() => setStep("mode")}
          disabled={players.length < 1}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-xl text-lg transition-colors shadow-lg"
        >
          Choisir le mode de jeu
        </button>
      </div>
    </div>
    );
  }

  // Step 3: Game mode selection
  const availableModes = GAME_MODES.filter((m) => {
    if (m.id === "voleur" && players.length < 2) return false;
    return true;
  });

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-lg">
        <button
          onClick={() => setStep("players")}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Retour aux joueurs
        </button>

        {selectedPack && (
          <div className={`bg-gradient-to-br ${selectedPack.gradient} rounded-xl px-5 py-4 flex items-center gap-4 mb-4`}>
            <span className="text-3xl">{selectedPack.icon}</span>
            <div>
              <h2 className="font-bold text-white text-lg">{selectedPack.name}</h2>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-400 mb-6">
          {players.length} joueur{players.length > 1 ? "s" : ""} : {players.join(", ")}
        </p>

        <h2 className="text-lg font-semibold text-gray-200 mb-4">Choisis un mode de jeu</h2>
        <div className="space-y-3 mb-8">
          {availableModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => {
                setSelectedMode(mode.id);
                if (selectedChunk) onStart(selectedChunk, mode.id);
              }}
              className="w-full text-left rounded-xl overflow-hidden ring-1 ring-gray-800 hover:ring-gray-600 hover:scale-[1.01] transition-all duration-200"
            >
              <div className={`bg-gradient-to-br ${mode.gradient} px-5 py-4 flex items-center gap-4`}>
                <span className="text-3xl">{mode.icon}</span>
                <div>
                  <h3 className="font-bold text-white text-lg">{mode.name}</h3>
                  <p className="text-white/70 text-sm">{mode.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
