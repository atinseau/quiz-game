import { Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthGuard } from "./components/AuthGuard";
import { EndScreen } from "./components/EndScreen";
import { GameScreen } from "./components/GameScreen";
import { HomeScreen } from "./components/HomeScreen";
import { JoinRoom } from "./components/JoinRoom";
import { LandingPage } from "./components/LandingPage";
import { ModeChoice } from "./components/ModeChoice";
import { MultiEndScreen } from "./components/MultiEndScreen";
import { MultiGameScreen } from "./components/MultiGameScreen";
import { MultiLobby } from "./components/MultiLobby";
import { useRoom } from "./hooks/useRoom";
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

function CreateRoom() {
  const { createRoom, room } = useRoom();
  const navigate = useNavigate();

  useEffect(() => {
    createRoom();
  }, [createRoom]);

  useEffect(() => {
    if (room) {
      navigate(`/play/lobby/${room.code}`, { replace: true });
    }
  }, [room, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">
        Création de la room...
      </div>
    </div>
  );
}

function GameRoute() {
  const { room } = useRoom();
  return room ? <MultiGameScreen /> : <GameScreen />;
}

function EndRoute() {
  const { room } = useRoom();
  return room ? <MultiEndScreen /> : <EndScreen />;
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
            <ModeChoice />
          </AuthGuard>
        }
      />
      <Route
        path="/play/solo"
        element={
          <AuthGuard>
            <InGameHeader />
            <HomeScreen />
          </AuthGuard>
        }
      />
      <Route
        path="/play/create"
        element={
          <AuthGuard>
            <InGameHeader />
            <CreateRoom />
          </AuthGuard>
        }
      />
      <Route
        path="/play/join"
        element={
          <AuthGuard>
            <InGameHeader />
            <JoinRoom />
          </AuthGuard>
        }
      />
      <Route
        path="/play/lobby/:code"
        element={
          <AuthGuard>
            <InGameHeader />
            <MultiLobby />
          </AuthGuard>
        }
      />
      <Route
        path="/join/:code"
        element={
          <AuthGuard>
            <InGameHeader />
            <JoinRoom />
          </AuthGuard>
        }
      />
      <Route
        path="/game"
        element={
          <AuthGuard>
            <InGameHeader />
            <GameRoute />
          </AuthGuard>
        }
      />
      <Route
        path="/end"
        element={
          <AuthGuard>
            <InGameHeader />
            <EndRoute />
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
