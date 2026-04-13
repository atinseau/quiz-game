function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(le |la |l'|les |un |une |des )/i, "")
    .replace(/s$/, "")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from(
    { length: m + 1 },
    () => Array(n + 1).fill(0) as number[],
  );
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]?.[j - 1]!
          : 1 + Math.min(dp[i - 1]?.[j]!, dp[i]?.[j - 1]!, dp[i - 1]?.[j - 1]!);
    }
  }
  return dp[m]?.[n]!;
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

const THRESHOLD = 0.75;
const MIN_WORD_LEN = 4;

export function fuzzyMatch(input: string, expected: string): boolean {
  const a = normalize(input);
  const b = normalize(String(expected));
  if (a === b) return true;

  const inputWords = a.split(/\s+/);
  for (const word of inputWords) {
    if (word.length >= MIN_WORD_LEN && similarity(word, b) >= THRESHOLD)
      return true;
  }

  const expectedWords = b.split(/\s+/);
  for (const word of expectedWords) {
    if (word.length >= MIN_WORD_LEN && similarity(a, word) >= THRESHOLD)
      return true;
  }

  for (const iw of inputWords) {
    for (const ew of expectedWords) {
      if (ew.length >= MIN_WORD_LEN && similarity(iw, ew) >= THRESHOLD)
        return true;
    }
  }

  return similarity(a, b) >= THRESHOLD;
}

export function checkAnswer(
  answer: string | boolean,
  question: { type: string; answer: string | boolean },
): boolean {
  if (question.type === "vrai_faux") return answer === question.answer;
  if (question.type === "texte")
    return fuzzyMatch(String(answer), String(question.answer));
  return answer === question.answer;
}
