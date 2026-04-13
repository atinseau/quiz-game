import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/clerk-react";
import { LogIn, UserPlus, Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EndScreen } from "./components/EndScreen";
import { GameScreen } from "./components/GameScreen";
import { HomeScreen } from "./components/HomeScreen";
import { useSyncPlayer } from "./hooks/useSyncPlayer";
import { useGameStore } from "./stores/gameStore";
import { setNavigate } from "./stores/router";
import { useSettingsStore } from "./stores/settingsStore";

function AuthHeader() {
  useSyncPlayer();
  const { muted, toggleMute } = useSettingsStore();

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
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
          <Button variant="default" size="sm">
            <LogIn className="size-3.5" data-icon="inline-start" />
            Connexion
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button variant="secondary" size="sm">
            <UserPlus className="size-3.5" data-icon="inline-start" />
            Inscription
          </Button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </div>
  );
}

function AppRoutes() {
  const navigate = useNavigate();

  useEffect(() => {
    setNavigate(navigate);
    useGameStore.getState().restoreFromStorage();
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/game" element={<GameScreen />} />
      <Route path="/end" element={<EndScreen />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthHeader />
      <AppRoutes />
    </BrowserRouter>
  );
}
