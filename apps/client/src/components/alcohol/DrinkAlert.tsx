import { useEffect } from "react";
import type { DrinkAlertDetails as Details } from "../../shared/types";
import { DrinkAlertDetails } from "./drink-alert-details";

interface DrinkAlertProps {
  emoji: string;
  message: string;
  onClose: () => void;
  duration?: number;
  details?: Details;
}

export function DrinkAlert({
  emoji,
  message,
  onClose,
  duration = 4000,
  details,
}: DrinkAlertProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

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
          {message}
        </p>
        {details && <DrinkAlertDetails details={details} />}
      </div>
    </button>
  );
}
