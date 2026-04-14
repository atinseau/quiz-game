import { Card, CardContent } from "@/components/ui/card";

interface Props {
  data: Record<string, unknown>;
}

export function Cupidon({ data }: Props) {
  const playerA = data.playerA as { clerkId: string; username: string };
  const playerB = data.playerB as { clerkId: string; username: string };

  return (
    <Card className="bg-card/90 border-pink-500/30">
      <CardContent className="py-8 text-center">
        <span className="text-6xl block mb-4">💘</span>
        <h2 className="text-2xl font-bold mb-4">Cupidon a frappé !</h2>
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="text-lg font-semibold text-pink-400">
            {playerA?.username ?? "?"}
          </span>
          <span className="text-2xl">💕</span>
          <span className="text-lg font-semibold text-pink-400">
            {playerB?.username ?? "?"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Ces deux joueurs sont liés pour le reste de la partie ! Ce qui arrive
          à l'un, arrive à l'autre.
        </p>
      </CardContent>
    </Card>
  );
}
