import { Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "./components/AuthGuard";
import { EndScreen } from "./components/EndScreen";
import { GameScreen } from "./components/GameScreen";
import { HomeScreen } from "./components/HomeScreen";
import { LandingPage } from "./components/LandingPage";
import { useSyncPlayer } from "./hooks/useSyncPlayer";
import { useGameStore } from "./stores/gameStore";
import { setNavigate } from "./stores/router";
import { useSettingsStore } from "./stores/settingsStore";

function InGameHeader() {
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
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/play"
        element={
          <AuthGuard>
            <InGameHeader />
            <HomeScreen />
          </AuthGuard>
        }
      />
      <Route
        path="/game"
        element={
          <AuthGuard>
            <InGameHeader />
            <GameScreen />
          </AuthGuard>
        }
      />
      <Route
        path="/end"
        element={
          <AuthGuard>
            <InGameHeader />
            <EndScreen />
          </AuthGuard>
        }
      />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
