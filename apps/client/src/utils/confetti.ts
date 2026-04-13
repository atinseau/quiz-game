import confetti from "canvas-confetti";

export function fireCorrectAnswer() {
  if (typeof document === "undefined") return;
  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.7 },
    colors: ["#a855f7", "#ec4899", "#06b6d4"],
  });
}

export function fireGameEnd() {
  if (typeof document === "undefined") return;
  const duration = 2000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ["#a855f7", "#ec4899", "#eab308"],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ["#a855f7", "#ec4899", "#eab308"],
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
