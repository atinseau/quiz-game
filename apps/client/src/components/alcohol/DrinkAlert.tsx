import { useEffect } from "react";

interface DrinkAlertProps {
  emoji: string;
  message: string;
  onClose: () => void;
  duration?: number;
}

export function DrinkAlert({
  emoji,
  message,
  onClose,
  duration = 4000,
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
      <div className="text-center animate-bounce-in">
        <span className="text-8xl block mb-6">{emoji}</span>
        <p className="text-2xl font-bold text-white max-w-sm">{message}</p>
      </div>
    </button>
  );
}
