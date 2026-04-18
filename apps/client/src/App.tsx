import { LogOut, Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { toast } from "sonner";
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
import { useSyncPlayer } from "./hooks/useSyncPlayer";
import { useGameStore } from "./stores/gameStore";
import { useRoomStore } from "./stores/roomStore";
import { setNavigate } from "./stores/router";
import { useSettingsStore } from "./stores/settingsStore";

function InGameHeader() {
  useSyncPlayer();
  const { muted, toggleMute } = useSettingsStore();
  const navigate = useNavigate();
  const room = useRoomStore((s) => s.room);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const hasSoloGame = useGameStore((s) => s.questions.length > 0);
  const resetSolo = useGameStore((s) => s.reset);

  const canQuit = room !== null || hasSoloGame;

  const handleQuit = () => {
    if (!window.confirm("Quitter la partie en cours ?")) return;
    if (room) leaveRoom();
    else resetSolo();
    navigate("/play");
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      {canQuit && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleQuit}
          title="Quitter la partie"
          className="text-muted-foreground hover:text-destructive"
        >
          <LogOut className="w-5 h-5" />
        </Button>
      )}
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
  const createRoom = useRoomStore((s) => s.createRoom);
  const room = useRoomStore((s) => s.room);
  const error = useRoomStore((s) => s.error);
  const clearError = useRoomStore((s) => s.clearError);
  const navigate = useNavigate();

  useEffect(() => {
    createRoom();
  }, [createRoom]);

  useEffect(() => {
    if (room) {
      navigate(`/play/lobby/${room.code}`, { replace: true });
    }
  }, [room, navigate]);

  useEffect(() => {
    if (error && !room) {
      toast.error(error);
      clearError();
      navigate("/play", { replace: true });
    }
  }, [error, room, navigate, clearError]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">
        Création de la room...
      </div>
    </div>
  );
}

function GameRoute() {
  const room = useRoomStore((s) => s.room);
  return room ? <MultiGameScreen /> : <GameScreen />;
}

function EndRoute() {
  const room = useRoomStore((s) => s.room);
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
