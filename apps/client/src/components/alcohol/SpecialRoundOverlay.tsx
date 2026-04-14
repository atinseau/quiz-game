import type { ComponentType } from "react";

// Will be populated by Task 7
let clientRoundRegistry: Map<
  string,
  ComponentType<{ data: Record<string, unknown> }>
> = new Map();

export function setClientRoundRegistry(
  registry: Map<string, ComponentType<{ data: Record<string, unknown> }>>,
) {
  clientRoundRegistry = registry;
}

interface SpecialRoundOverlayProps {
  roundType: string;
  data: Record<string, unknown>;
}

export function SpecialRoundOverlay({
  roundType,
  data,
}: SpecialRoundOverlayProps) {
  const Component = clientRoundRegistry.get(roundType);
  if (!Component) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 animate-bounce-in">
        <Component data={data} />
      </div>
    </div>
  );
}
