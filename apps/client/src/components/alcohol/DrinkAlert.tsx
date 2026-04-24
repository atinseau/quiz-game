import { useEffect, useMemo } from "react";
import { capitalize, joinNames } from "../../shared/format";
import type { DrinkAlertDetails as Details } from "../../shared/types";
import { usePlayerStore } from "../../stores/playerStore";
import { useRoomStore } from "../../stores/roomStore";
import { DrinkAlertDetails } from "./drink-alert-details";

interface DrinkAlertProps {
  targetClerkIds: string[];
  emoji: string;
  action: string;
  details?: Details;
  onClose: () => void;
  duration?: number;
}

export function DrinkAlert({
  targetClerkIds,
  emoji,
  action,
  details,
  onClose,
  duration = 4000,
}: DrinkAlertProps) {
  const myClerkId = useRoomStore((s) => s.myClerkId);
  const room = useRoomStore((s) => s.room);
  const soloPlayers = usePlayerStore((s) => s.players);

  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const { verdict, othersLine } = useMemo(() => {
    const resolveName = (clerkId: string): string => {
      const multi = room?.players.find((p) => p.clerkId === clerkId);
      if (multi) return multi.username;
      const solo = soloPlayers.find((p) => p.name === clerkId);
      return solo?.name ?? clerkId;
    };
    const names = targetClerkIds.map(resolveName);
    const isMe = myClerkId !== null && targetClerkIds.includes(myClerkId);
    if (isMe) {
      const othersNames = targetClerkIds
        .filter((id) => id !== myClerkId)
        .map(resolveName);
      return {
        verdict: "C'est pour toi !",
        othersLine:
          othersNames.length > 0 ? `(+ ${joinNames(othersNames)})` : null,
      };
    }
    return {
      verdict: names.length > 0 ? `C'est pour ${joinNames(names)} !` : "",
      othersLine: null,
    };
  }, [targetClerkIds, myClerkId, room, soloPlayers]);

  return (
    <button
      type="button"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer w-full border-none p-0"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="text-center animate-bounce-in px-6">
        <span className="text-8xl block mb-6">{emoji}</span>
        <p className="text-2xl font-bold text-white max-w-sm mx-auto">
          {verdict}
        </p>
        <p className="text-lg text-amber-400 font-semibold mt-2 max-w-sm mx-auto">
          {capitalize(action)}
        </p>
        {othersLine && (
          <p className="text-sm text-white/60 mt-1">{othersLine}</p>
        )}
        {details && <DrinkAlertDetails details={details} />}
      </div>
    </button>
  );
}
