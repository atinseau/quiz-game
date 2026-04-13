import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/clerk-react";
import { setNavigate } from "./stores/router";
import { useGameStore } from "./stores/gameStore";
import { HomeScreen } from "./components/HomeScreen";
import { GameScreen } from "./components/GameScreen";
import { EndScreen } from "./components/EndScreen";

function AuthHeader() {
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      <SignedOut>
        <SignInButton mode="modal">
          <button className="px-4 py-2 bg-brand rounded-lg text-white text-sm font-medium hover:opacity-90 transition">
            Connexion
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="px-4 py-2 bg-white/10 rounded-lg text-white text-sm font-medium hover:bg-white/20 transition">
            Inscription
          </button>
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
