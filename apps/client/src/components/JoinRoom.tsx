import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoom } from "../hooks/useRoom";

export function JoinRoom() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  const { code: urlCode } = useParams<{ code: string }>();
  const { joinRoom, room, error } = useRoom();

  // Auto-join from URL param (/join/:code)
  useEffect(() => {
    if (urlCode && urlCode.length === 6) {
      setCode(urlCode.toUpperCase());
      joinRoom(urlCode.toUpperCase());
    }
  }, [urlCode, joinRoom]);

  // Redirect to lobby once joined
  useEffect(() => {
    if (room) {
      navigate(`/play/lobby/${room.code}`, { replace: true });
    }
  }, [room, navigate]);

  const handleJoin = () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) return;
    joinRoom(trimmed);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm w-full space-y-6 text-center">
        <Button variant="ghost" size="sm" onClick={() => navigate("/play")}>
          <ArrowLeft className="size-4 mr-1" />
          Retour
        </Button>
        <h1 className="text-2xl font-bold">Rejoindre une partie</h1>
        <p className="text-muted-foreground">
          Entre le code de la room donné par le host.
        </p>
        <Input
          placeholder="Ex: A3K9F2"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="text-center text-2xl tracking-widest font-mono h-14"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          size="lg"
          className="w-full"
          onClick={handleJoin}
          disabled={code.trim().length !== 6}
        >
          Rejoindre
        </Button>
      </div>
    </div>
  );
}
