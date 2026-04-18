import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/clerk-react";
import {
  BookOpen,
  LogIn,
  PartyPopper,
  Play,
  UserPlus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePacks } from "../hooks/usePacks";
import { useSettingsStore } from "../stores/settingsStore";
import { GAME_MODES } from "../types";
import { InstallButton } from "./InstallButton";

export function LandingPage() {
  const { data: packs = [] } = usePacks();
  const navigate = useNavigate();
  const { muted, toggleMute } = useSettingsStore();
  const [rulesOpen, setRulesOpen] = useState(false);

  const previewPacks = packs.slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      {/* --- Header --- */}
      <header className="fixed top-0 inset-x-0 z-50 safe-pt safe-px border-b border-border/30 bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PartyPopper className="w-6 h-6 text-party-purple" />
            <span className="text-xl font-bold text-glow-purple">
              Quiz Party
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              title={muted ? "Activer le son" : "Couper le son"}
            >
              {muted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </Button>
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="default" size="sm" aria-label="Connexion">
                  <LogIn className="size-3.5" />
                  <span className="sr-only sm:not-sr-only">Connexion</span>
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button variant="secondary" size="sm" aria-label="Inscription">
                  <UserPlus className="size-3.5" />
                  <span className="sr-only sm:not-sr-only">Inscription</span>
                </Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Button size="sm" onClick={() => navigate("/play")}>
                <Play className="size-3.5" />
                Jouer
              </Button>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-24 pb-16">
        {/* --- Hero --- */}
        <section className="text-center py-16">
          <h1 className="text-5xl sm:text-7xl font-black animate-shimmer bg-gradient-to-r from-party-purple via-party-pink to-party-cyan bg-clip-text text-transparent bg-[length:200%_auto]">
            Quiz Party
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto">
            Le quiz qui pimente tes soirées. Défie tes potes, vole leurs points,
            et prouve que tu es le plus cultivé de la bande.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 items-center justify-center">
            <SignedOut>
              <SignInButton mode="modal">
                <Button size="lg" className="text-lg px-8 py-6 glow-purple">
                  <Play className="size-5 mr-2" />
                  Jouer maintenant
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Button
                size="lg"
                className="text-lg px-8 py-6 glow-purple"
                onClick={() => navigate("/play")}
              >
                <Play className="size-5 mr-2" />
                Jouer maintenant
              </Button>
            </SignedIn>
            <InstallButton />
          </div>
        </section>

        {/* --- Aperçu des packs --- */}
        <section className="py-12">
          <h2 className="text-2xl font-bold text-center mb-8">
            Des centaines de questions pour tous les goûts
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {previewPacks.map((pack) => (
              <div
                key={pack.slug}
                className={`bg-gradient-to-br ${pack.gradient} rounded-2xl p-4 text-center`}
              >
                <span className="text-3xl">{pack.icon}</span>
                <p className="mt-2 font-semibold text-white text-sm">
                  {pack.name}
                </p>
                <p className="text-xs text-white/70 mt-1">
                  {pack.questionCount} questions
                </p>
                {!pack.isFree && pack.price && (
                  <p className="text-xs text-amber-300 mt-1">
                    {pack.price.toFixed(2)}€
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-muted-foreground mt-4 text-sm">
            Et bien d'autres packs à découvrir...
          </p>
        </section>

        {/* --- Modes de jeu --- */}
        <section className="py-12">
          <h2 className="text-2xl font-bold text-center mb-8">
            3 modes de jeu, 0 temps mort
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {GAME_MODES.map((mode) => (
              <div
                key={mode.id}
                className={`bg-gradient-to-br ${mode.gradient} rounded-2xl p-6 text-center`}
              >
                <span className="text-4xl">{mode.icon}</span>
                <h3 className="mt-3 text-lg font-bold text-white">
                  {mode.name}
                </h3>
                <p className="mt-1 text-sm text-white/80">{mode.description}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
              <DialogTrigger
                render={
                  <Button variant="outline" size="sm">
                    <BookOpen className="size-4 mr-2" />
                    Voir les règles détaillées
                  </Button>
                }
              />
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Règles du jeu</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="classic">
                  <TabsList className="w-full">
                    <TabsTrigger value="classic" className="flex-1">
                      🎯 Classique
                    </TabsTrigger>
                    <TabsTrigger value="voleur" className="flex-1">
                      🦹 Voleur
                    </TabsTrigger>
                    <TabsTrigger value="chrono" className="flex-1">
                      ⏱️ Chrono
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="classic" className="mt-4 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      • Tour par tour, chaque joueur répond à sa question
                    </p>
                    <p className="text-sm text-muted-foreground">
                      • Enchaîne les bonnes réponses pour un combo jusqu'à x5
                    </p>
                    <p className="text-sm text-muted-foreground">
                      • Mode aveugle : réponds sans voir les choix pour doubler
                      tes points
                    </p>
                  </TabsContent>
                  <TabsContent value="voleur" className="mt-4 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      • Un joueur répond, les autres peuvent voler sa réponse
                    </p>
                    <p className="text-sm text-muted-foreground">
                      • Vol réussi : tu gagnes 0.5 pt, il perd 0.5 pt
                    </p>
                    <p className="text-sm text-muted-foreground">
                      • Vol raté : tu perds 1 pt — risqué !
                    </p>
                  </TabsContent>
                  <TabsContent value="chrono" className="mt-4 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      • 15 secondes par question, pas le droit de traîner
                    </p>
                    <p className="text-sm text-muted-foreground">
                      • Bonne réponse dans le temps : +1 pt + combo
                    </p>
                    <p className="text-sm text-muted-foreground">
                      • Timeout : -0.5 pt, aïe
                    </p>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </section>
      </main>
    </div>
  );
}
