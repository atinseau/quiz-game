import { Eye, Send, Sparkles } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BlindProps {
  onSubmit: (value: string) => void;
  onReveal: () => void;
}

export function BlindInput({ onSubmit, onReveal }: BlindProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") onSubmit(value);
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
        <Sparkles className="size-4 text-amber-400" />
        Tente ta reponse sans les choix pour{" "}
        <span className="text-amber-400 font-semibold">+2 pts</span>
      </p>
      <div className="flex gap-2 mb-3">
        <Input
          ref={inputRef}
          type="text"
          placeholder="Ta reponse..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-12 text-base"
        />
        <Button
          onClick={() => onSubmit(value)}
          size="lg"
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400"
        >
          <Send className="size-4" />
          Valider
        </Button>
      </div>
      <Button variant="secondary" onClick={onReveal} className="w-full">
        <Eye className="size-4" />
        Voir les choix (+1 pt)
      </Button>
    </div>
  );
}

interface QcmProps {
  choices: string[];
  disabled: boolean;
  onSelect: (choice: string) => void;
}

export function QcmChoices({ choices, disabled, onSelect }: QcmProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {choices.map((c) => (
        <Button
          key={c}
          variant="outline"
          onClick={() => onSelect(c)}
          disabled={disabled}
          className="h-auto py-3.5 px-4 text-left justify-start text-base font-medium whitespace-normal"
        >
          {c}
        </Button>
      ))}
    </div>
  );
}

interface VfProps {
  disabled: boolean;
  onSelect: (value: boolean) => void;
}

export function VraiFaux({ disabled, onSelect }: VfProps) {
  return (
    <div className="flex gap-4">
      <Button
        variant="outline"
        onClick={() => onSelect(true)}
        disabled={disabled}
        size="lg"
        className="flex-1 h-14 text-lg border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-400"
      >
        Vrai
      </Button>
      <Button
        variant="outline"
        onClick={() => onSelect(false)}
        disabled={disabled}
        size="lg"
        className="flex-1 h-14 text-lg border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-400"
      >
        Faux
      </Button>
    </div>
  );
}

interface TextProps {
  disabled: boolean;
  onSubmit: (value: string) => void;
}

export function TextInput({ disabled, onSubmit }: TextProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
  };

  return (
    <div className="flex gap-2">
      <Input
        ref={inputRef}
        type="text"
        placeholder="Votre reponse..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="h-12 text-base"
      />
      <Button
        onClick={() => value.trim() && onSubmit(value.trim())}
        disabled={disabled}
        size="lg"
      >
        <Send className="size-4" />
        Valider
      </Button>
    </div>
  );
}
