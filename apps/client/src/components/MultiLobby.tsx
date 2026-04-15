import { Copy, Crown, Pencil, Wifi, WifiOff } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePacks } from "../hooks/usePacks";
import { useAlcoholStore } from "../stores/alcoholStore";
import { useRoomStore } from "../stores/roomStore";
import { GAME_MODES } from "../types";
import { AlcoholConfig } from "./alcohol/AlcoholConfig";

export function MultiLobby() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const room = useRoomStore((s) => s.room);
  const error = useRoomStore((s) => s.error);
  const gameStarting = useRoomStore((s) => s.gameStarting);
  const joinRoom = useRoomStore((s) => s.joinRoom);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const selectPack = useRoomStore((s) => s.selectPack);
  const selectMode = useRoomStore((s) => s.selectMode);
  const startGame = useRoomStore((s) => s.startGame);
  const updateNickname = useRoomStore((s) => s.updateNickname);
  const updateGender = useRoomStore((s) => s.updateGender);
  const isHost = room?.hostClerkId === myClerkId;
  const alcoholConfig = useAlcoholStore((s) => s.config);
  const setAlcoholConfig = useAlcoholStore((s) => s.setConfig);
  const { data: packs = [] } = usePacks();
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // Auto-join room if not already in it
  useEffect(() => {
    if (!room && code) {
      joinRoom(code);
    }
  }, [room, code, joinRoom]);

  // Generate QR code
  useEffect(() => {
    if (!qrCanvasRef.current || !room) return;
    const joinUrl = `${window.location.origin}/join/${room.code}`;
    QRCode.toCanvas(qrCanvasRef.current, joinUrl, {
      width: 200,
      margin: 2,
      color: { dark: "#ffffff", light: "#00000000" },
    });
  }, [room]);

  // Redirect when game starts
  useEffect(() => {
    if (gameStarting) {
      navigate("/game");
    }
  }, [gameStarting, navigate]);

  const copyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Connexion à la room...
        </div>
      </div>
    );
  }

  const connectedPlayers = room.players.filter((p) => p.connected);
  const canStart =
    isHost && room.packSlug && room.mode && connectedPlayers.length >= 2;

  return (
    <div className="min-h-screen p-4 pt-20 max-w-4xl mx-auto">
      {/* Room code + QR */}
      <div className="text-center mb-8">
        <p className="text-sm text-muted-foreground mb-2">Code de la room</p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl font-mono font-bold tracking-widest text-glow-purple">
            {room.code}
          </span>
          <Button variant="ghost" size="icon" onClick={copyCode}>
            <Copy className="size-5" />
          </Button>
        </div>
        {copied && <p className="text-xs text-party-green mt-1">Copié !</p>}
        <canvas ref={qrCanvasRef} className="mx-auto mt-4" />
      </div>

      {/* Players list */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">
            Joueurs ({connectedPlayers.length}/{room.players.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {room.players.map((player) => {
              const isMe = player.clerkId === myClerkId;
              return (
                <div
                  key={player.clerkId}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card/50"
                >
                  {player.connected ? (
                    <Wifi className="size-4 text-party-green" />
                  ) : (
                    <WifiOff className="size-4 text-destructive" />
                  )}
                  {isMe && editingName ? (
                    <Input
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && nameInput.trim()) {
                          updateNickname(nameInput.trim());
                          setEditingName(false);
                        }
                        if (e.key === "Escape") setEditingName(false);
                      }}
                      onBlur={() => {
                        if (nameInput.trim()) updateNickname(nameInput.trim());
                        setEditingName(false);
                      }}
                      maxLength={20}
                      className="h-8 flex-1"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium flex-1">
                      {player.username}
                      {isMe && (
                        <button
                          type="button"
                          onClick={() => {
                            setNameInput(player.username);
                            setEditingName(true);
                          }}
                          className="ml-2 text-muted-foreground hover:text-foreground"
                          title="Modifier ton nom"
                        >
                          <Pencil className="size-3 inline" />
                        </button>
                      )}
                    </span>
                  )}
                  {isMe ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateGender(
                            player.gender === "homme" ? "femme" : "homme",
                          )
                        }
                        className="text-sm px-2 py-0.5 rounded bg-card hover:bg-card/80 transition-colors"
                        title="Changer de genre"
                      >
                        {player.gender === "homme" ? "♂" : "♀"}
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm">
                      {player.gender === "homme" ? "♂" : "♀"}
                    </span>
                  )}
                  {player.clerkId === room.hostClerkId && (
                    <Badge variant="secondary">
                      <Crown className="size-3 mr-1" />
                      Host
                    </Badge>
                  )}
                  {!player.connected && (
                    <Badge variant="destructive" className="text-xs">
                      Déconnecté
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Host config: pack + mode selection */}
      {isHost ? (
        <div className="space-y-6">
          {/* Pack selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Choisis un pack</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {packs.map((pack) => (
                  <button
                    type="button"
                    key={pack.slug}
                    onClick={() => selectPack(pack.slug)}
                    className={`bg-gradient-to-br ${pack.gradient} rounded-xl p-3 text-left transition-all ${
                      room.packSlug === pack.slug
                        ? "ring-2 ring-primary scale-[1.02]"
                        : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    <span className="text-2xl">{pack.icon}</span>
                    <p className="text-sm font-semibold text-white mt-1">
                      {pack.name}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Mode selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Choisis un mode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {GAME_MODES.map((mode) => (
                  <button
                    type="button"
                    key={mode.id}
                    onClick={() => selectMode(mode.id)}
                    className={`bg-gradient-to-br ${mode.gradient} rounded-xl p-4 text-center transition-all ${
                      room.mode === mode.id
                        ? "ring-2 ring-primary scale-[1.02]"
                        : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    <span className="text-2xl">{mode.icon}</span>
                    <p className="text-sm font-bold text-white mt-1">
                      {mode.name}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Alcohol config */}
          <AlcoholConfig
            enabled={alcoholConfig.enabled}
            frequency={alcoholConfig.frequency}
            enabledRounds={alcoholConfig.enabledRounds}
            culSecEndGame={alcoholConfig.culSecEndGame}
            onChange={setAlcoholConfig}
          />

          {/* Launch button */}
          <Button
            size="lg"
            className="w-full py-6 text-lg glow-purple"
            disabled={!canStart}
            onClick={() =>
              startGame(alcoholConfig.enabled ? alcoholConfig : undefined)
            }
          >
            Lancer la partie
          </Button>
          {!canStart && (
            <p className="text-xs text-muted-foreground text-center">
              {connectedPlayers.length < 2
                ? "Il faut au moins 2 joueurs"
                : !room.packSlug
                  ? "Choisis un pack"
                  : "Choisis un mode"}
            </p>
          )}
        </div>
      ) : (
        /* Non-host view */
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {room.packSlug && room.mode
                ? "Le host a choisi -- en attente du lancement..."
                : "En attente de la configuration du host..."}
            </p>
            {room.packSlug && (
              <p className="mt-2 text-sm">
                Pack :{" "}
                <strong>
                  {packs.find((p) => p.slug === room.packSlug)?.name ??
                    room.packSlug}
                </strong>
              </p>
            )}
            {room.mode && (
              <p className="text-sm">
                Mode :{" "}
                <strong>
                  {GAME_MODES.find((m) => m.id === room.mode)?.name ??
                    room.mode}
                </strong>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leave button */}
      <div className="text-center mt-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            leaveRoom();
            navigate("/play");
          }}
        >
          Quitter la room
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive text-center mt-4">{error}</p>
      )}
    </div>
  );
}
