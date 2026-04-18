import { Monitor, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useRoomStore } from "../stores/roomStore";

export function ModeChoice() {
  const navigate = useNavigate();

  // Clear any stale room reference from a previous session so CreateRoom's
  // navigate effect can't redirect to an old lobby code before the new
  // create_room response arrives.
  const goCreate = () => {
    useRoomStore.setState({
      room: null,
      gameStarting: false,
      error: null,
    });
    navigate("/play/create");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-3xl font-bold text-glow-purple">
          Comment tu veux jouer ?
        </h1>
        <p className="text-muted-foreground">
          Choisis ton mode de jeu avant de commencer.
        </p>
        <div className="space-y-4">
          <Button
            size="lg"
            className="w-full py-8 text-lg glow-purple"
            onClick={() => navigate("/play/solo")}
          >
            <Monitor className="size-6 mr-3" />
            Un seul appareil
          </Button>
          <div className="grid grid-cols-2 gap-4">
            <Button
              size="lg"
              variant="secondary"
              className="py-8 text-base"
              onClick={goCreate}
            >
              <Wifi className="size-5 mr-2" />
              Créer une partie
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="py-8 text-base"
              onClick={() => navigate("/play/join")}
            >
              <Wifi className="size-5 mr-2" />
              Rejoindre
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
