import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  PartyPopper,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGameStore } from "../stores/gameStore";
import { usePackStore } from "../stores/packStore";
import { usePlayerStore } from "../stores/playerStore";
import type { GameMode, Gender } from "../types";
import { GAME_MODES } from "../types";

export function HomeScreen() {
  const players = usePlayerStore((s) => s.players);
  const addPlayer = usePlayerStore((s) => s.addPlayer);
  const removePlayer = usePlayerStore((s) => s.removePlayer);
  const { packs, loadPacks, selectPack, selectedPack, completedSlugs } =
    usePackStore();
  const startGame = useGameStore((s) => s.startGame);

  const [inputValue, setInputValue] = useState("");
  const [gender, setGender] = useState<Gender>("homme");
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<"pack" | "mode" | "players">("pack");
  const [_selectedMode, setSelectedMode] = useState<GameMode>("classic");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(6);
  const gridRef = useRef<HTMLDivElement>(null);

  const computePerPage = useCallback(() => {
    const vh = window.innerHeight;
    const headerHeight = 200;
    const paginationHeight = 60;
    const available = vh - headerHeight - paginationHeight;
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
    loadPacks();
  }, [loadPacks]);

  const handleAdd = () => {
    if (addPlayer(inputValue, gender)) setInputValue("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  // Step 1 : Pack selection
  if (step === "pack") {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-3">
              <PartyPopper className="size-10 text-party-pink animate-float" />
              <h1 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent animate-shimmer">
                Quiz Party
              </h1>
              <PartyPopper
                className="size-10 text-party-purple animate-float"
                style={{ animationDelay: "1s" }}
              />
            </div>
            <p className="text-muted-foreground text-lg">
              Choisis ton pack de questions
            </p>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Rechercher un pack..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-10 h-11 bg-card/50 border-border/50 text-base"
            />
          </div>

          {(() => {
            const filtered = packs.filter((p) => {
              if (!search.trim()) return true;
              const q = search.toLowerCase();
              return (
                p.name.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q)
              );
            });
            const totalPages = Math.max(
              1,
              Math.ceil(filtered.length / perPage),
            );
            const safePage = Math.min(page, totalPages - 1);
            const pageItems = filtered.slice(
              safePage * perPage,
              (safePage + 1) * perPage,
            );

            return (
              <>
                <div
                  ref={gridRef}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {pageItems.map((pack) => {
                    const done = completedSlugs.includes(pack.slug);
                    const active = pack.slug === selectedPack?.slug;
                    return (
                      <button
                        type="button"
                        key={pack.slug}
                        onClick={() => {
                          selectPack(pack);
                          setStep("players");
                        }}
                        className={`group relative text-left rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer ${
                          active
                            ? "ring-2 ring-primary scale-[1.02] glow-purple"
                            : "ring-1 ring-border/50 hover:ring-primary/50 hover:scale-[1.01] hover:glow-purple"
                        }`}
                      >
                        <div
                          className={`bg-gradient-to-br ${pack.gradient} px-5 py-5 flex items-center gap-4`}
                        >
                          <span className="text-4xl group-hover:scale-110 transition-transform duration-300">
                            {pack.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-white text-lg leading-tight truncate">
                              {pack.name}
                            </h3>
                            {done && (
                              <Badge
                                variant="secondary"
                                className="mt-1 bg-white/20 text-white border-none text-xs"
                              >
                                Termine
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="bg-card px-5 py-4">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {pack.description}
                          </p>
                          {pack.questionCount != null && (
                            <p className="text-xs text-muted-foreground/60 mt-2">
                              {pack.questionCount} questions
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <Button
                          key={`page-${pageNum}`}
                          variant={i === safePage ? "default" : "secondary"}
                          size="icon"
                          onClick={() => setPage(i)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      disabled={safePage === totalPages - 1}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    );
  }

  // Step 2 : Players
  if (step === "players") {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-md">
          <Button
            variant="ghost"
            onClick={() => setStep("pack")}
            className="mb-6 text-muted-foreground"
          >
            <ArrowLeft className="size-4" />
            Changer de pack
          </Button>

          {selectedPack && (
            <div
              className={`bg-gradient-to-br ${selectedPack.gradient} rounded-2xl px-5 py-4 flex items-center gap-4 mb-8 glow-purple`}
            >
              <span className="text-3xl">{selectedPack.icon}</span>
              <div>
                <h2 className="font-bold text-white text-lg">
                  {selectedPack.name}
                </h2>
                <p className="text-white/70 text-sm">
                  {selectedPack.description}
                </p>
              </div>
            </div>
          )}

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="size-5 text-primary" />
                Qui joue ?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Input
                  type="text"
                  placeholder="Nom du joueur"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-11"
                  maxLength={20}
                />
                <Button onClick={handleAdd} size="lg">
                  <UserPlus className="size-4" />
                  Ajouter
                </Button>
              </div>
              <div className="flex gap-2 mb-4">
                <Button
                  variant={gender === "homme" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGender("homme")}
                >
                  Homme
                </Button>
                <Button
                  variant={gender === "femme" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGender("femme")}
                >
                  Femme
                </Button>
              </div>

              {players.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {players.map((p) => (
                    <Badge
                      key={p.name}
                      variant="secondary"
                      className="pl-3 pr-1.5 py-1.5 text-sm gap-1.5"
                    >
                      {p.gender === "homme" ? "\u2642" : "\u2640"} {p.name}
                      <button
                        type="button"
                        onClick={() => removePlayer(p.name)}
                        className="text-muted-foreground hover:text-destructive transition-colors rounded-full p-0.5"
                      >
                        <X className="size-3.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {players.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Ajoute au moins un joueur pour commencer
                </p>
              )}
            </CardContent>
          </Card>

          <Button
            onClick={() => setStep("mode")}
            disabled={players.length < 1}
            size="lg"
            className="w-full h-14 text-lg"
          >
            <Gamepad2 className="size-5" />
            Choisir le mode de jeu
          </Button>
        </div>
      </div>
    );
  }

  // Step 3 : Game mode selection
  const availableModes = GAME_MODES.filter((m) => {
    if (m.id === "voleur" && players.length < 2) return false;
    return true;
  });

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-lg">
        <Button
          variant="ghost"
          onClick={() => setStep("players")}
          className="mb-6 text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour aux joueurs
        </Button>

        {selectedPack && (
          <div
            className={`bg-gradient-to-br ${selectedPack.gradient} rounded-2xl px-5 py-4 flex items-center gap-4 mb-4 glow-purple`}
          >
            <span className="text-3xl">{selectedPack.icon}</span>
            <div>
              <h2 className="font-bold text-white text-lg">
                {selectedPack.name}
              </h2>
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground mb-6">
          {players.length} joueur{players.length > 1 ? "s" : ""} :{" "}
          {players.map((p) => p.name).join(", ")}
        </p>

        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Gamepad2 className="size-5 text-primary" />
          Choisis un mode de jeu
        </h2>
        <div className="space-y-3 mb-8">
          {availableModes.map((mode) => (
            <button
              type="button"
              key={mode.id}
              onClick={() => {
                setSelectedMode(mode.id);
                if (selectedPack) startGame(selectedPack.slug, mode.id);
              }}
              className="group w-full text-left rounded-2xl overflow-hidden ring-1 ring-border/50 hover:ring-primary/50 hover:scale-[1.01] hover:glow-purple transition-all duration-300 cursor-pointer"
            >
              <div
                className={`bg-gradient-to-br ${mode.gradient} px-5 py-4 flex items-center gap-4`}
              >
                <span className="text-3xl group-hover:scale-110 transition-transform duration-300">
                  {mode.icon}
                </span>
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
