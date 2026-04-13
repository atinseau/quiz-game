import { type KeyboardEvent, useEffect, useRef, useState } from "react";

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
      <p className="text-sm text-gray-400 mb-2">
        Tente ta réponse sans les choix pour{" "}
        <span className="text-amber-400 font-semibold">+2 pts</span>
      </p>
      <div className="flex gap-2 mb-3">
        <input
          ref={inputRef}
          type="text"
          placeholder="Ta réponse..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-lg"
        />
        <button
          onClick={() => onSubmit(value)}
          className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          Valider
        </button>
      </div>
      <button
        onClick={onReveal}
        className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
      >
        Voir les choix (+1 pt)
      </button>
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
        <button
          key={c}
          onClick={() => onSelect(c)}
          disabled={disabled}
          className={`bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-indigo-500 text-white font-medium py-3.5 px-4 rounded-xl transition-colors text-left ${
            disabled ? "opacity-50" : ""
          }`}
        >
          {c}
        </button>
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
      <button
        onClick={() => onSelect(true)}
        disabled={disabled}
        className={`flex-1 bg-gray-800 hover:bg-emerald-700 border border-gray-700 hover:border-emerald-500 text-white font-semibold py-4 rounded-xl text-lg transition-colors ${
          disabled ? "opacity-50" : ""
        }`}
      >
        Vrai
      </button>
      <button
        onClick={() => onSelect(false)}
        disabled={disabled}
        className={`flex-1 bg-gray-800 hover:bg-red-700 border border-gray-700 hover:border-red-500 text-white font-semibold py-4 rounded-xl text-lg transition-colors ${
          disabled ? "opacity-50" : ""
        }`}
      >
        Faux
      </button>
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
      <input
        ref={inputRef}
        type="text"
        placeholder="Votre réponse..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg ${
          disabled ? "opacity-50" : ""
        }`}
      />
      <button
        onClick={() => value.trim() && onSubmit(value.trim())}
        disabled={disabled}
        className={`bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors ${
          disabled ? "opacity-50" : ""
        }`}
      >
        Valider
      </button>
    </div>
  );
}
