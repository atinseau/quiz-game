import { CheckCircle2, Download, Plus, Share } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android" | "desktop" | "unsupported";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unsupported";
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function InstallButton() {
  const [platform, setPlatform] = useState<Platform>("unsupported");
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [iosDialogOpen, setIosDialogOpen] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  if (installed) return null;

  const handleClick = async () => {
    if (platform === "ios") {
      setIosDialogOpen(true);
      return;
    }
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setDeferredPrompt(null);
      return;
    }
    setIosDialogOpen(true);
  };

  const showButton = platform === "ios" || deferredPrompt !== null;
  if (!showButton) return null;

  return (
    <>
      <Button
        size="lg"
        variant="outline"
        className="text-lg px-8 py-6"
        onClick={handleClick}
      >
        <Download className="size-5 mr-2" />
        Installer l'app
      </Button>

      <Dialog open={iosDialogOpen} onOpenChange={setIosDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="size-5 text-party-purple" />
              Installer Quiz Party sur ton iPhone
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              En 3 étapes, ajoute Quiz Party à ton écran d'accueil comme une
              vraie app — sans passer par l'App Store.
            </p>

            <Step
              number={1}
              icon={<Share className="size-5 text-party-cyan" />}
              title="Ouvre le menu Partager"
              description="Tape l'icône Partager en bas de Safari (carré avec flèche vers le haut)."
            />
            <Step
              number={2}
              icon={<Plus className="size-5 text-party-pink" />}
              title={`Sélectionne "Sur l'écran d'accueil"`}
              description={`Fais défiler la liste et choisis "Sur l'écran d'accueil" / "Add to Home Screen".`}
            />
            <Step
              number={3}
              icon={<CheckCircle2 className="size-5 text-party-purple" />}
              title="Valide"
              description="Tape sur Ajouter. L'icône apparaît sur ton écran d'accueil !"
            />

            <p className="text-xs text-muted-foreground text-center pt-2">
              ⚠️ Fonctionne uniquement dans Safari, pas dans Chrome iOS.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Step({
  number,
  icon,
  title,
  description,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-party-purple/20 flex items-center justify-center font-bold text-party-purple">
        {number}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 font-semibold text-sm">
          {icon}
          {title}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}
