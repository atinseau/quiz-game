import { join } from "node:path";

const QUESTIONS_DIR = join(
  import.meta.dir,
  "../../../apps/client/public/questions",
);
const IMPORT_ENDPOINT = "http://localhost:1337/api/question-packs/import";

type RawQuestion = {
  type: "qcm" | "vrai_faux" | "texte";
  question: string;
  choices?: string[];
  answer: string | boolean;
};

type RawQuestionFile = Record<string, RawQuestion[]>;

type PackMeta = {
  file: string;
  name: string;
  description: string;
  icon: string;
  gradient: string;
};

type ImportQuestion = {
  category: string;
  type: string;
  question: string;
  choices?: string[];
  answer: string;
};

type ImportPayload = {
  pack: {
    slug: string;
    name: string;
    description: string;
    icon: string;
    gradient: string;
  };
  questions: ImportQuestion[];
};

function slugFromFilename(filename: string): string {
  // "questions-N.json" -> "pack-N"
  const match = filename.match(/^questions-(\d+)\.json$/);
  if (!match) throw new Error(`Cannot derive slug from filename: ${filename}`);
  return `pack-${match[1]}`;
}

function flattenQuestions(raw: RawQuestionFile): ImportQuestion[] {
  const result: ImportQuestion[] = [];
  for (const [category, questions] of Object.entries(raw)) {
    for (const q of questions) {
      const importQuestion: ImportQuestion = {
        category,
        type: q.type,
        question: q.question,
        answer: String(q.answer),
      };
      if (q.choices) {
        importQuestion.choices = q.choices;
      }
      result.push(importQuestion);
    }
  }
  return result;
}

async function seedPacks() {
  const packsFile = Bun.file(join(QUESTIONS_DIR, "packs.json"));
  const packs: PackMeta[] = await packsFile.json();

  console.log(`Seeding ${packs.length} packs...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const meta of packs) {
    const slug = slugFromFilename(meta.file);
    console.log(`[${slug}] Importing "${meta.name}"...`);

    try {
      const questionFile = Bun.file(join(QUESTIONS_DIR, meta.file));
      const rawQuestions: RawQuestionFile = await questionFile.json();
      const questions = flattenQuestions(rawQuestions);

      const payload: ImportPayload = {
        pack: {
          slug,
          name: meta.name,
          description: meta.description,
          icon: meta.icon,
          gradient: meta.gradient,
        },
        questions,
      };

      const response = await fetch(IMPORT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`  [ERROR] HTTP ${response.status}: ${body}`);
        errorCount++;
      } else {
        console.log(`  [OK] Imported ${questions.length} questions`);
        successCount++;
      }
    } catch (err) {
      console.error(
        `  [ERROR] ${err instanceof Error ? err.message : String(err)}`,
      );
      errorCount++;
    }
  }

  console.log(`\nDone. ${successCount} succeeded, ${errorCount} failed.`);
  if (errorCount > 0) process.exit(1);
}

seedPacks();
