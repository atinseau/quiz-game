import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  tied: { clerkId: string; username: string }[];
  selectedClerkId: string;
  durationMs: number;
  onDone: () => void;
}

const PALETTE = [
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#059669",
  "#0284c7",
  "#db2777",
];
const ROTATIONS = 5;
const SETTLE_MS = 800;

function polarToCart(
  cx: number,
  cy: number,
  r: number,
  deg: number,
): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function sliceArcPath(
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number,
): string {
  const [x1, y1] = polarToCart(cx, cy, r, start);
  const [x2, y2] = polarToCart(cx, cy, r, end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

export function ConseilWheel({
  tied,
  selectedClerkId,
  durationMs,
  onDone,
}: Props) {
  const [spinning, setSpinning] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { slices, finalAngle, fontSize } = useMemo(() => {
    const n = tied.length;
    const sliceAngle = 360 / n;
    const selectedIndex = tied.findIndex((p) => p.clerkId === selectedClerkId);
    const safeIndex = selectedIndex >= 0 ? selectedIndex : 0;
    // Align the middle of the selected slice with the top pointer (angle 0).
    // finalAngle is applied to the wheel; a negative value rotates the
    // slice into the pointer's position. 5 full rotations for drama.
    const finalAngle =
      -(safeIndex * sliceAngle) - sliceAngle / 2 + 360 * ROTATIONS;
    const fontSize = n <= 3 ? 14 : n <= 5 ? 12 : 10;
    const slices = tied.map((p, i) => {
      const start = i * sliceAngle;
      const end = (i + 1) * sliceAngle;
      const mid = start + sliceAngle / 2;
      const [lx, ly] = polarToCart(100, 100, 60, mid);
      const fill = PALETTE[i % PALETTE.length] ?? "#f59e0b";
      return {
        id: p.clerkId,
        label: p.username,
        fill,
        path: sliceArcPath(100, 100, 95, start, end),
        lx,
        ly,
      };
    });
    return { slices, finalAngle, fontSize };
  }, [tied, selectedClerkId]);

  useEffect(() => {
    // Trigger the CSS transition on next frame so React has committed the
    // initial rotate(0deg). Without rAF, React may batch and the transition
    // never fires.
    const raf = requestAnimationFrame(() => setSpinning(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleTransitionEnd = () => {
    if (settleTimer.current) return;
    settleTimer.current = setTimeout(() => {
      onDone();
    }, SETTLE_MS);
  };

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  return (
    <div className="relative mx-auto" style={{ width: 220, height: 240 }}>
      {/* Top pointer */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: 0,
          width: 0,
          height: 0,
          borderLeft: "12px solid transparent",
          borderRight: "12px solid transparent",
          borderTop: "20px solid #fbbf24",
          zIndex: 2,
        }}
      />
      <svg
        viewBox="0 0 200 200"
        style={{
          width: 220,
          height: 220,
          marginTop: 16,
          transform: spinning ? `rotate(${finalAngle}deg)` : "rotate(0deg)",
          transition: spinning
            ? `transform ${durationMs}ms cubic-bezier(.17,.67,.12,.99)`
            : "none",
        }}
        onTransitionEnd={handleTransitionEnd}
        aria-label="Roue de la fortune"
      >
        <circle
          cx={100}
          cy={100}
          r={95}
          fill="#0f1419"
          stroke="#f59e0b"
          strokeWidth={3}
        />
        {slices.map((s) => (
          <g key={s.id}>
            <path d={s.path} fill={s.fill} />
            <text
              x={s.lx}
              y={s.ly}
              fill="white"
              fontSize={fontSize}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {s.label}
            </text>
          </g>
        ))}
        <circle
          cx={100}
          cy={100}
          r={10}
          fill="#fbbf24"
          stroke="#000"
          strokeWidth={2}
        />
      </svg>
    </div>
  );
}
