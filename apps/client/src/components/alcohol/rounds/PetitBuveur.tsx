import { Card, CardContent } from "@/components/ui/card";

interface Props {
  data: Record<string, unknown>;
}

export function PetitBuveur({ data }: Props) {
  const losers = (data.losers as { clerkId: string; username: string }[]) ?? [];
  return (
    <Card className="bg-card/90 border-amber-500/30">
      <CardContent className="py-8 text-center">
        <span className="text-6xl block mb-4">🍺</span>
        <h2 className="text-2xl font-bold mb-4">Petit buveur !</h2>
        <div className="space-y-2">
          {losers.map((l) => (
            <p key={l.clerkId} className="text-lg text-amber-400 font-semibold">
              {l.username} boit une gorgée
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
