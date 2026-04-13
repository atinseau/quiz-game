# Phase 1 — Fondations: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate question packs into Strapi, add gender selection, mute mode, pack badges, and party theme.

**Architecture:** Strapi v5 content-types (Category, QuestionPack, Question) with JSON import endpoint. Client migrates from static JSON to Strapi API. Player model changes from `string` to `{name, gender}`.

**Tech Stack:** Strapi v5, Bun, React 19, Zustand, Tailwind 4, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-13-quiz-party-roadmap.md` (Phase 1, sections 2.1-2.5)

---

## File Structure

### New files (backend)

```
apps/backend/src/api/
  category/
    content-types/category/schema.json    — Category content-type schema
    routes/category.ts                     — Factory routes
    controllers/category.ts                — Factory controller
    services/category.ts                   — Factory service
  question-pack/
    content-types/question-pack/schema.json — QuestionPack content-type schema
    routes/question-pack.ts                 — Factory routes + custom import route
    routes/import.ts                        — Custom import route definition
    controllers/question-pack.ts            — Factory controller + import action
    services/question-pack.ts               — Factory service
  question/
    content-types/question/schema.json      — Question content-type schema
    routes/question.ts                       — Factory routes
    controllers/question.ts                  — Factory controller
    services/question.ts                     — Factory service

apps/backend/scripts/
  seed-packs.ts                             — Seed script: reads 14 JSON files → calls import endpoint
```

### New files (client)

```
apps/client/src/stores/settingsStore.ts     — Mute toggle store
```

### Modified files (backend)

```
apps/backend/src/api/player/content-types/player/schema.json  — Add gender + completedPacks
```

### Modified files (client)

```
apps/client/src/types.ts                    — Add Player type, update PackMeta, add ApiPack
apps/client/src/stores/playerStore.ts       — string[] → Player[]
apps/client/src/stores/gameStore.ts         — Score keys use player.name, fetch from Strapi API
apps/client/src/stores/packStore.ts         — Fetch from Strapi, badges, completedPacks
apps/client/src/utils/sounds.ts             — Check muted state before playing
apps/client/src/utils/storage.ts            — Update GameState type for Player[]
apps/client/src/components/HomeScreen.tsx    — Gender selector, pack badges, Strapi fetch
apps/client/src/components/GameScreen.tsx    — Player object access (.name)
apps/client/src/components/ScoreBoard.tsx    — Player object access (.name)
apps/client/src/components/EndScreen.tsx     — Player object access (.name)
apps/client/src/components/StealZone.tsx     — Player object access (.name)
apps/client/src/components/ui/              — Mute button in App.tsx header
apps/client/src/App.tsx                     — Add mute toggle to header
apps/client/src/index.css                   — Enhanced party theme
apps/client/index.ts                        — Remove static JSON routes (packs served by Strapi)
```

---

## Task 1: Strapi Content-Types (Category, QuestionPack, Question)

**Files:**
- Create: `apps/backend/src/api/category/content-types/category/schema.json`
- Create: `apps/backend/src/api/category/routes/category.ts`
- Create: `apps/backend/src/api/category/controllers/category.ts`
- Create: `apps/backend/src/api/category/services/category.ts`
- Create: `apps/backend/src/api/question-pack/content-types/question-pack/schema.json`
- Create: `apps/backend/src/api/question-pack/routes/question-pack.ts`
- Create: `apps/backend/src/api/question-pack/controllers/question-pack.ts`
- Create: `apps/backend/src/api/question-pack/services/question-pack.ts`
- Create: `apps/backend/src/api/question/content-types/question/schema.json`
- Create: `apps/backend/src/api/question/routes/question.ts`
- Create: `apps/backend/src/api/question/controllers/question.ts`
- Create: `apps/backend/src/api/question/services/question.ts`

- [ ] **Step 1: Create Category content-type schema**

```json
// apps/backend/src/api/category/content-types/category/schema.json
{
  "kind": "collectionType",
  "collectionName": "categories",
  "info": {
    "singularName": "category",
    "pluralName": "categories",
    "displayName": "Category"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "name": {
      "type": "string",
      "required": true
    },
    "slug": {
      "type": "uid",
      "targetField": "name",
      "required": true
    },
    "packs": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::question-pack.question-pack",
      "inversedBy": "categories"
    },
    "questions": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::question.question",
      "mappedBy": "category"
    }
  }
}
```

- [ ] **Step 2: Create Category factory files**

```ts
// apps/backend/src/api/category/routes/category.ts
import { factories } from "@strapi/strapi";
export default factories.createCoreRouter("api::category.category");
```

```ts
// apps/backend/src/api/category/controllers/category.ts
import { factories } from "@strapi/strapi";
export default factories.createCoreController("api::category.category");
```

```ts
// apps/backend/src/api/category/services/category.ts
import { factories } from "@strapi/strapi";
export default factories.createCoreService("api::category.category");
```

- [ ] **Step 3: Create QuestionPack content-type schema**

```json
// apps/backend/src/api/question-pack/content-types/question-pack/schema.json
{
  "kind": "collectionType",
  "collectionName": "question_packs",
  "info": {
    "singularName": "question-pack",
    "pluralName": "question-packs",
    "displayName": "QuestionPack"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "slug": {
      "type": "uid",
      "required": true
    },
    "name": {
      "type": "string",
      "required": true
    },
    "description": {
      "type": "text"
    },
    "icon": {
      "type": "string"
    },
    "gradient": {
      "type": "string"
    },
    "isFree": {
      "type": "boolean",
      "default": true
    },
    "stripePriceId": {
      "type": "string"
    },
    "published": {
      "type": "boolean",
      "default": true
    },
    "displayOrder": {
      "type": "integer",
      "default": 0
    },
    "categories": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::category.category",
      "mappedBy": "packs"
    },
    "questions": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::question.question",
      "mappedBy": "pack"
    }
  }
}
```

- [ ] **Step 4: Create QuestionPack factory files**

```ts
// apps/backend/src/api/question-pack/routes/question-pack.ts
import { factories } from "@strapi/strapi";
export default factories.createCoreRouter("api::question-pack.question-pack");
```

```ts
// apps/backend/src/api/question-pack/controllers/question-pack.ts
import { factories } from "@strapi/strapi";
export default factories.createCoreController("api::question-pack.question-pack");
```

```ts
// apps/backend/src/api/question-pack/services/question-pack.ts
import { factories } from "@strapi/strapi";
export default factories.createCoreService("api::question-pack.question-pack");
```

- [ ] **Step 5: Create Question content-type schema**

```json
// apps/backend/src/api/question/content-types/question/schema.json
{
  "kind": "collectionType",
  "collectionName": "questions",
  "info": {
    "singularName": "question",
    "pluralName": "questions",
    "displayName": "Question"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "type": {
      "type": "enumeration",
      "enum": ["qcm", "vrai_faux", "texte"],
      "required": true
    },
    "text": {
      "type": "text",
      "required": true
    },
    "choices": {
      "type": "json"
    },
    "answer": {
      "type": "string",
      "required": true
    },
    "category": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::category.category",
      "inversedBy": "questions"
    },
    "pack": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::question-pack.question-pack",
      "inversedBy": "questions"
    },
    "displayOrder": {
      "type": "integer",
      "default": 0
    }
  }
}
```

- [ ] **Step 6: Create Question factory files**

```ts
// apps/backend/src/api/question/routes/question.ts
import { factories } from "@strapi/strapi";
export default factories.createCoreRouter("api::question.question");
```

```ts
// apps/backend/src/api/question/controllers/question.ts
import { factories } from "@strapi/strapi";
export default factories.createCoreController("api::question.question");
```

```ts
// apps/backend/src/api/question/services/question.ts
import { factories } from "@strapi/strapi";
export default factories.createCoreService("api::question.question");
```

- [ ] **Step 7: Start Strapi to verify schemas auto-migrate**

Run: `cd apps/backend && bun run develop`

Expected: Strapi starts, creates tables `categories`, `question_packs`, `questions` + join tables. Verify in admin panel at `http://localhost:1337/admin` that all 3 content-types appear under Content Manager.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/api/category apps/backend/src/api/question-pack apps/backend/src/api/question
git commit -m "feat(backend): add Category, QuestionPack, Question content-types"
```

---

## Task 2: Update Player Schema (gender + completedPacks)

**Files:**
- Modify: `apps/backend/src/api/player/content-types/player/schema.json`

- [ ] **Step 1: Add gender and completedPacks to Player schema**

```json
// apps/backend/src/api/player/content-types/player/schema.json
{
  "kind": "collectionType",
  "collectionName": "players",
  "info": {
    "singularName": "player",
    "pluralName": "players",
    "displayName": "Player"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "clerkId": {
      "type": "string",
      "unique": true,
      "required": true
    },
    "email": {
      "type": "email",
      "unique": true,
      "required": true
    },
    "username": {
      "type": "string",
      "required": true
    },
    "gender": {
      "type": "enumeration",
      "enum": ["homme", "femme"]
    },
    "completedPacks": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::question-pack.question-pack"
    }
  }
}
```

- [ ] **Step 2: Restart Strapi to verify migration**

Run: `cd apps/backend && bun run develop`

Expected: Player table has `gender` column and `players_completed_packs_lnk` join table created.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/api/player/content-types/player/schema.json
git commit -m "feat(backend): add gender and completedPacks to Player schema"
```

---

## Task 3: Import Endpoint (POST /api/question-packs/import)

**Files:**
- Create: `apps/backend/src/api/question-pack/routes/import.ts`
- Modify: `apps/backend/src/api/question-pack/controllers/question-pack.ts`

- [ ] **Step 1: Create custom import route**

```ts
// apps/backend/src/api/question-pack/routes/import.ts
export default {
  routes: [
    {
      method: "POST",
      path: "/question-packs/import",
      handler: "api::question-pack.question-pack.importPack",
      config: {
        auth: false, // TODO: restrict to admin token in production
      },
    },
  ],
};
```

- [ ] **Step 2: Implement import controller action**

Replace the factory controller with a custom one that adds the `importPack` action:

```ts
// apps/backend/src/api/question-pack/controllers/question-pack.ts
import type { Core } from "@strapi/strapi";

const { createCoreController } = require("@strapi/strapi").factories;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface ImportQuestion {
  category: string;
  type: "qcm" | "vrai_faux" | "texte";
  question: string;
  choices?: string[];
  answer: string;
}

interface ImportBody {
  pack: {
    slug: string;
    name?: string;
    description?: string;
    icon?: string;
    gradient?: string;
  };
  questions: ImportQuestion[];
}

export default createCoreController(
  "api::question-pack.question-pack",
  ({ strapi }: { strapi: Core.Strapi }) => ({
    async importPack(ctx) {
      const body = ctx.request.body as ImportBody;

      // --- Validation ---
      const errors: string[] = [];

      if (!body.pack?.slug) {
        errors.push("pack.slug is required");
      }
      if (!body.questions || !Array.isArray(body.questions) || body.questions.length === 0) {
        errors.push("questions array is required and must not be empty");
      }

      if (body.questions) {
        for (let i = 0; i < body.questions.length; i++) {
          const q = body.questions[i];
          if (!q.category) errors.push(`questions[${i}]: category is required`);
          if (!q.type || !["qcm", "vrai_faux", "texte"].includes(q.type)) {
            errors.push(`questions[${i}]: type must be qcm, vrai_faux, or texte`);
          }
          if (!q.question) errors.push(`questions[${i}]: question text is required`);
          if (!q.answer && q.answer !== "false") errors.push(`questions[${i}]: answer is required`);
          if (q.type === "qcm" && (!Array.isArray(q.choices) || q.choices.length !== 4)) {
            errors.push(`questions[${i}]: qcm requires exactly 4 choices`);
          }
          if (q.type === "vrai_faux" && !["true", "false"].includes(String(q.answer))) {
            errors.push(`questions[${i}]: vrai_faux answer must be "true" or "false"`);
          }
        }
      }

      if (errors.length > 0) {
        return ctx.badRequest("Validation failed", { errors });
      }

      // --- Upsert Pack ---
      let pack = await strapi.documents("api::question-pack.question-pack").findFirst({
        filters: { slug: body.pack.slug },
      });

      let packStatus: "existing" | "created";

      if (pack) {
        packStatus = "existing";
      } else {
        if (!body.pack.name) {
          return ctx.badRequest("pack.name is required when creating a new pack");
        }
        pack = await strapi.documents("api::question-pack.question-pack").create({
          data: {
            slug: body.pack.slug,
            name: body.pack.name,
            description: body.pack.description ?? "",
            icon: body.pack.icon ?? "",
            gradient: body.pack.gradient ?? "",
            isFree: true,
            published: true,
            displayOrder: 0,
          },
        });
        packStatus = "created";
      }

      // --- Upsert Categories ---
      const categoryNames = [...new Set(body.questions.map((q) => q.category))];
      const categoryMap = new Map<string, { documentId: string; status: string }>();

      for (const catName of categoryNames) {
        let category = await strapi.documents("api::category.category").findFirst({
          filters: { name: catName },
          populate: ["packs"],
        });

        let status: string;

        if (category) {
          status = "existing";
          // Link to pack if not already linked
          const linkedPackIds = (category.packs || []).map((p: any) => p.documentId);
          if (!linkedPackIds.includes(pack.documentId)) {
            await strapi.documents("api::category.category").update({
              documentId: category.documentId,
              data: {
                packs: [...linkedPackIds, pack.documentId],
              },
            });
            status = "existing, newly linked";
          }
        } else {
          category = await strapi.documents("api::category.category").create({
            data: {
              name: catName,
              slug: slugify(catName),
              packs: [pack.documentId],
            },
          });
          status = "created";
        }

        categoryMap.set(catName, { documentId: category.documentId, status });
      }

      // --- Create Questions ---
      let questionsCreated = 0;

      for (let i = 0; i < body.questions.length; i++) {
        const q = body.questions[i];
        const cat = categoryMap.get(q.category)!;

        await strapi.documents("api::question.question").create({
          data: {
            type: q.type,
            text: q.question,
            choices: q.type === "qcm" ? q.choices : null,
            answer: String(q.answer),
            category: cat.documentId,
            pack: pack.documentId,
            displayOrder: i,
          },
        });
        questionsCreated++;
      }

      // --- Response ---
      ctx.body = {
        success: true,
        summary: {
          pack: { slug: body.pack.slug, status: packStatus },
          categories: Array.from(categoryMap.entries()).map(([name, info]) => ({
            name,
            status: info.status,
          })),
          questions: { created: questionsCreated, total: body.questions.length },
        },
      };
    },
  })
);
```

- [ ] **Step 3: Restart Strapi and test the import endpoint**

Run: `cd apps/backend && bun run develop`

Then test with curl:

```bash
curl -X POST http://localhost:1337/api/question-packs/import \
  -H "Content-Type: application/json" \
  -d '{
    "pack": {
      "slug": "test-pack",
      "name": "Test Pack",
      "description": "Test",
      "icon": "🧪",
      "gradient": "from-green-500 to-blue-500"
    },
    "questions": [
      {
        "category": "Test Cat",
        "type": "qcm",
        "question": "What is 1+1?",
        "choices": ["1", "2", "3", "4"],
        "answer": "2"
      },
      {
        "category": "Test Cat",
        "type": "vrai_faux",
        "question": "The sky is blue",
        "answer": "true"
      }
    ]
  }'
```

Expected response:

```json
{
  "success": true,
  "summary": {
    "pack": { "slug": "test-pack", "status": "created" },
    "categories": [{ "name": "Test Cat", "status": "created" }],
    "questions": { "created": 2, "total": 2 }
  }
}
```

- [ ] **Step 4: Delete test data from Strapi admin, then commit**

Clean up test data via admin panel, then:

```bash
git add apps/backend/src/api/question-pack/
git commit -m "feat(backend): add POST /api/question-packs/import endpoint"
```

---

## Task 4: Seed Script (Import 14 Existing Packs)

**Files:**
- Create: `apps/backend/scripts/seed-packs.ts`
- Reference: `apps/client/public/questions/packs.json`, `apps/client/public/questions/questions-*.json`

- [ ] **Step 1: Write the seed script**

```ts
// apps/backend/scripts/seed-packs.ts
const PACKS_META_PATH = "../client/public/questions/packs.json";
const QUESTIONS_DIR = "../client/public/questions";
const IMPORT_URL = "http://localhost:1337/api/question-packs/import";

interface PackMeta {
  file: string;
  name: string;
  description: string;
  icon: string;
  gradient: string;
}

interface RawQuestion {
  type: "qcm" | "vrai_faux" | "texte";
  question: string;
  choices?: string[];
  answer: string | boolean;
}

async function seed() {
  const packsFile = Bun.file(`${import.meta.dir}/${PACKS_META_PATH}`);
  const packsMeta: PackMeta[] = await packsFile.json();

  console.log(`Found ${packsMeta.length} packs to import\n`);

  for (let i = 0; i < packsMeta.length; i++) {
    const meta = packsMeta[i];
    const slug = meta.file.replace(".json", "").replace("questions-", "pack-");

    // Read question file
    const questionsFile = Bun.file(`${import.meta.dir}/${QUESTIONS_DIR}/${meta.file}`);
    const rawData: Record<string, RawQuestion[]> = await questionsFile.json();

    // Transform to import format
    const questions = Object.entries(rawData).flatMap(([category, qs]) =>
      qs.map((q) => ({
        category,
        type: q.type,
        question: q.question,
        choices: q.choices,
        answer: String(q.answer),
      }))
    );

    const body = {
      pack: {
        slug,
        name: meta.name,
        description: meta.description,
        icon: meta.icon,
        gradient: meta.gradient,
      },
      questions,
    };

    console.log(`[${i + 1}/${packsMeta.length}] Importing "${meta.name}" (${questions.length} questions)...`);

    const response = await fetch(IMPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`  FAILED:`, error);
      continue;
    }

    const result = await response.json();
    console.log(`  OK: ${result.summary.questions.created} questions, ${result.summary.categories.length} categories`);
  }

  console.log("\nSeed complete!");
}

seed().catch(console.error);
```

- [ ] **Step 2: Run the seed with Strapi running**

Terminal 1: `cd apps/backend && bun run develop`

Terminal 2:

```bash
cd apps/backend && bun run scripts/seed-packs.ts
```

Expected: 14 packs imported with ~881 questions total. Each pack logs OK with question/category counts.

- [ ] **Step 3: Verify in Strapi admin**

Open `http://localhost:1337/admin` → Content Manager:
- QuestionPack: 14 entries, all with `isFree: true`
- Category: ~109 entries (some shared across packs)
- Question: ~881 entries

- [ ] **Step 4: Add seed script to package.json**

Add to `apps/backend/package.json` scripts:

```json
"seed": "bun run scripts/seed-packs.ts"
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/scripts/seed-packs.ts apps/backend/package.json
git commit -m "feat(backend): add seed script to import 14 existing question packs"
```

---

## Task 5: Client Types + Player Migration (string[] → Player[])

**Files:**
- Modify: `apps/client/src/types.ts`
- Modify: `apps/client/src/stores/playerStore.ts`
- Modify: `apps/client/src/utils/storage.ts`

- [ ] **Step 1: Add Player type and update types.ts**

Add at the top of `apps/client/src/types.ts`:

```ts
export type Gender = "homme" | "femme";

export interface Player {
  name: string;
  gender: Gender;
}
```

Update the `GameState` interface — change `players: string[]` to `players: Player[]`.

Update the `PackMeta` interface — add `slug: string` field (for Strapi packs).

Add new type for Strapi API response:

```ts
export interface ApiPack {
  documentId: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  gradient: string;
  isFree: boolean;
  published: boolean;
  displayOrder: number;
  questionCount?: number;
}
```

- [ ] **Step 2: Update playerStore.ts**

Replace the full content of `apps/client/src/stores/playerStore.ts`:

```ts
import { create } from "zustand";
import type { Gender, Player } from "../types";

interface PlayerState {
  players: Player[];
  addPlayer: (name: string, gender: Gender) => boolean;
  removePlayer: (name: string) => void;
  resetPlayers: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  players: [],

  addPlayer: (name, gender) => {
    const trimmed = name.trim();
    if (
      !trimmed ||
      trimmed.length > 20 ||
      get().players.some((p) => p.name === trimmed)
    ) {
      return false;
    }
    set((s) => ({ players: [...s.players, { name: trimmed, gender }] }));
    return true;
  },

  removePlayer: (name) => {
    set((s) => ({ players: s.players.filter((p) => p.name !== name) }));
  },

  resetPlayers: () => set({ players: [] }),
}));
```

- [ ] **Step 3: Update storage.ts**

In `apps/client/src/utils/storage.ts`, the `GameState` type is imported from `types.ts` — verify it now uses `Player[]` for the `players` field. If `GameState` is defined inline in `storage.ts`, update it there too.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/types.ts apps/client/src/stores/playerStore.ts apps/client/src/utils/storage.ts
git commit -m "feat(client): add Player type with gender, migrate playerStore from string[] to Player[]"
```

---

## Task 6: Update Client Components for Player Objects

**Files:**
- Modify: `apps/client/src/stores/gameStore.ts`
- Modify: `apps/client/src/components/HomeScreen.tsx`
- Modify: `apps/client/src/components/GameScreen.tsx`
- Modify: `apps/client/src/components/ScoreBoard.tsx`
- Modify: `apps/client/src/components/EndScreen.tsx`
- Modify: `apps/client/src/components/StealZone.tsx`

- [ ] **Step 1: Update gameStore.ts**

Key changes in `apps/client/src/stores/gameStore.ts`:

1. The `currentPlayer()` selector currently returns `string`. Update it to return `Player`:
   - Change: `currentPlayer: () => usePlayerStore.getState().players[get().currentPlayerIndex]`
   - All places that display `currentPlayer` must now use `currentPlayer().name`

2. `scores` and `combos` remain keyed by `string` (the player name). No structural change needed — player names are still unique.

3. The `startGame` function initializes scores by iterating players. Update from:
   ```ts
   players.forEach((p) => { scores[p] = 0; combos[p] = 0; });
   ```
   To:
   ```ts
   players.forEach((p) => { scores[p.name] = 0; combos[p.name] = 0; });
   ```

4. All references to `players[index]` for display/logic must use `.name` when comparing with score keys.

- [ ] **Step 2: Update HomeScreen.tsx**

Key changes in `apps/client/src/components/HomeScreen.tsx`:

1. Add gender state to the player input form:
   ```tsx
   const [gender, setGender] = useState<Gender>("homme");
   ```

2. Replace the "Ajouter" button handler — pass gender:
   ```tsx
   addPlayer(name, gender)
   ```

3. Add gender toggle buttons next to the name input:
   ```tsx
   <div className="flex gap-2">
     <Button
       variant={gender === "homme" ? "default" : "outline"}
       size="sm"
       onClick={() => setGender("homme")}
     >
       Homme
     </Button>
     <Button
       variant={gender === "femme" ? "default" : "outline"}
       size="sm"
       onClick={() => setGender("femme")}
     >
       Femme
     </Button>
   </div>
   ```

4. Update player badges display — change `p` (string) to `p.name`:
   ```tsx
   players.map((p) => (
     <Badge key={p.name}>
       {p.name} {p.gender === "homme" ? "♂" : "♀"}
       <button onClick={() => removePlayer(p.name)}>×</button>
     </Badge>
   ))
   ```

- [ ] **Step 3: Update GameScreen.tsx**

In `apps/client/src/components/GameScreen.tsx`:

1. Where `currentPlayer` is displayed as text, use `currentPlayer.name` (it was a string, now it's a `Player`)
2. Solo score access: change `scores[players[0]]` to `scores[players[0].name]`
3. Combo access follows same pattern

- [ ] **Step 4: Update ScoreBoard.tsx**

In `apps/client/src/components/ScoreBoard.tsx`:

1. Update props type: `players: Player[]` (import `Player` from types)
2. Update all `scores[p]` to `scores[p.name]`
3. Update all `combos[p]` to `combos[p.name]`
4. Display `p.name` in the UI

- [ ] **Step 5: Update EndScreen.tsx**

In `apps/client/src/components/EndScreen.tsx`:

1. `players` is now `Player[]`
2. Solo: change `scores[players[0] ?? ""]` to `scores[players[0]?.name ?? ""]`
3. Multiplayer ranking: sort by `scores[p.name]`, display `p.name`

- [ ] **Step 6: Update StealZone.tsx**

In `apps/client/src/components/StealZone.tsx`:

1. `otherPlayers` filter stays the same (filter by index)
2. Display `p.name` instead of `p`
3. Pass `p.name` to steal handler

- [ ] **Step 7: Verify the app compiles and runs**

Run: `cd apps/client && bun run dev`

Expected: App starts. Navigate to `/`, add players with gender, start a game. All modes should work with player names displayed correctly.

- [ ] **Step 8: Commit**

```bash
git add apps/client/src/stores/gameStore.ts apps/client/src/components/
git commit -m "feat(client): migrate all components from player strings to Player objects with gender"
```

---

## Task 7: Pack Loading Migration (Static JSON → Strapi API)

**Files:**
- Modify: `apps/client/src/stores/packStore.ts`
- Modify: `apps/client/src/stores/gameStore.ts`
- Modify: `apps/client/src/components/HomeScreen.tsx`
- Modify: `apps/client/src/lib/api.ts`
- Modify: `apps/client/index.ts`

- [ ] **Step 1: Add pack API functions to api.ts**

Add to `apps/client/src/lib/api.ts`:

```ts
export async function fetchPacks(): Promise<ApiPack[]> {
  const res = await fetch(`${API_URL}/question-packs?populate=questions&sort=displayOrder:asc&pagination[pageSize]=100`);
  if (!res.ok) throw new Error("Failed to fetch packs");
  const json = await res.json();
  return json.data.map((pack: any) => ({
    ...pack,
    questionCount: pack.questions?.length ?? 0,
  }));
}

export async function fetchPackQuestions(packSlug: string): Promise<Question[]> {
  const res = await fetch(
    `${API_URL}/questions?filters[pack][slug][$eq]=${packSlug}&populate=category&pagination[pageSize]=1000`
  );
  if (!res.ok) throw new Error("Failed to fetch questions");
  const json = await res.json();
  return json.data.map((q: any) => ({
    type: q.type,
    question: q.text,
    choices: q.choices,
    answer: q.type === "vrai_faux" ? q.answer === "true" : q.answer,
    category: q.category?.name ?? "Divers",
  }));
}
```

Import `Question` and `ApiPack` from `../types`.

- [ ] **Step 2: Update packStore.ts to use Strapi packs**

Replace `apps/client/src/stores/packStore.ts` with:

```ts
import { create } from "zustand";
import type { ApiPack } from "../types";
import { fetchPacks } from "../lib/api";

interface PackState {
  packs: ApiPack[];
  selectedPack: ApiPack | null;
  completedSlugs: string[];
  loading: boolean;

  loadPacks: () => Promise<void>;
  selectPack: (pack: ApiPack) => void;
  markCompleted: (slug: string) => void;
  reset: () => void;
}

const STORAGE_KEY = "quiz-completed-packs";

function loadCompletedSlugs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export const usePackStore = create<PackState>((set, get) => ({
  packs: [],
  selectedPack: null,
  completedSlugs: loadCompletedSlugs(),
  loading: false,

  loadPacks: async () => {
    if (get().packs.length > 0) return;
    set({ loading: true });
    try {
      const packs = await fetchPacks();
      set({ packs, loading: false });
    } catch (e) {
      console.error("Failed to load packs:", e);
      set({ loading: false });
    }
  },

  selectPack: (pack) => set({ selectedPack: pack }),

  markCompleted: (slug) => {
    const current = get().completedSlugs;
    if (current.includes(slug)) return;
    const updated = [...current, slug];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    set({ completedSlugs: updated });
  },

  reset: () => set({ selectedPack: null }),
}));
```

- [ ] **Step 3: Update gameStore.ts startGame to use Strapi API**

In `apps/client/src/stores/gameStore.ts`, update the `startGame` function:

Change the fetch call from:
```ts
const res = await fetch(`/packs/${chunk}`);
const raw: RawQuestionData = await res.json();
```

To:
```ts
import { fetchPackQuestions } from "../lib/api";
// ...
const questions = await fetchPackQuestions(packSlug);
```

The `startGame` parameter changes from `chunk: string` (filename) to `packSlug: string`.

Remove the code that transforms `RawQuestionData` into `Question[]` — `fetchPackQuestions` already returns `Question[]`.

- [ ] **Step 4: Update HomeScreen.tsx pack selection**

In `apps/client/src/components/HomeScreen.tsx`:

1. Replace the `fetch("/packs.json")` call with `usePackStore.loadPacks()` on mount:
   ```tsx
   const { packs, loadPacks, loading, selectPack, selectedPack, completedSlugs } = usePackStore();
   useEffect(() => { loadPacks(); }, []);
   ```

2. Update pack card rendering to use `ApiPack` fields instead of `PackMeta`
3. Pass `selectedPack.slug` to `startGame()` instead of the filename
4. Add "Terminé" badge on completed packs:
   ```tsx
   {completedSlugs.includes(pack.slug) && (
     <Badge variant="secondary" className="absolute top-2 right-2">
       <Check className="w-3 h-3 mr-1" /> Terminé
     </Badge>
   )}
   ```

- [ ] **Step 5: Remove static JSON routes from Bun server**

In `apps/client/index.ts`, remove the routes for `/packs.json`, `/questions-*.json`, and `/chunks`. Keep the audio routes (`/win.mp3`, `/fail.mp3`, `/steal.mp3`) and the SPA fallback.

- [ ] **Step 6: Configure Strapi public API permissions**

In Strapi admin → Settings → Roles → Public:
- Enable `find` and `findOne` for QuestionPack
- Enable `find` and `findOne` for Question
- Enable `find` and `findOne` for Category

This allows the client to fetch packs and questions without auth.

- [ ] **Step 7: Verify end-to-end**

Run both servers:
- Terminal 1: `cd apps/backend && bun run develop`
- Terminal 2: `cd apps/client && bun run dev`

Test: Open app → packs load from Strapi → select a pack → start game → questions display correctly.

- [ ] **Step 8: Update gameStore to mark pack completed at end of game**

In the `nextQuestion` function of `gameStore.ts`, when the last question is answered and we navigate to `/end`, call:

```ts
usePackStore.getState().markCompleted(packSlug);
```

Store the current `packSlug` in gameStore state so it's available at game end.

- [ ] **Step 9: Commit**

```bash
git add apps/client/src/lib/api.ts apps/client/src/stores/ apps/client/src/components/HomeScreen.tsx apps/client/index.ts
git commit -m "feat(client): migrate pack loading from static JSON to Strapi API, add pack completion tracking"
```

---

## Task 8: Mute Mode

**Files:**
- Create: `apps/client/src/stores/settingsStore.ts`
- Modify: `apps/client/src/utils/sounds.ts`
- Modify: `apps/client/src/App.tsx`

- [ ] **Step 1: Create settingsStore.ts**

```ts
// apps/client/src/stores/settingsStore.ts
import { create } from "zustand";

const STORAGE_KEY = "quiz-muted";

interface SettingsState {
  muted: boolean;
  toggleMute: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  muted: localStorage.getItem(STORAGE_KEY) === "true",

  toggleMute: () => {
    const next = !get().muted;
    localStorage.setItem(STORAGE_KEY, String(next));
    set({ muted: next });
  },
}));
```

- [ ] **Step 2: Update sounds.ts to check muted state**

```ts
// apps/client/src/utils/sounds.ts
import { useSettingsStore } from "../stores/settingsStore";

const soundWin = new Audio("/win.mp3");
const soundFail = new Audio("/fail.mp3");
const soundSteal = new Audio("/steal.mp3");

function play(audio: HTMLAudioElement) {
  if (useSettingsStore.getState().muted) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export const sounds = {
  win: () => play(soundWin),
  fail: () => play(soundFail),
  steal: () => play(soundSteal),
};
```

- [ ] **Step 3: Add mute toggle to App.tsx header**

In `apps/client/src/App.tsx`, add a mute button next to the existing auth header:

```tsx
import { Volume2, VolumeX } from "lucide-react";
import { useSettingsStore } from "./stores/settingsStore";

// Inside the header component:
const { muted, toggleMute } = useSettingsStore();

<Button variant="ghost" size="icon" onClick={toggleMute} title={muted ? "Activer le son" : "Couper le son"}>
  {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
</Button>
```

- [ ] **Step 4: Verify**

Run: `cd apps/client && bun run dev`

Test: Click mute icon → icon changes to VolumeX → play a game → no sounds. Click again → icon changes to Volume2 → sounds play. Refresh page → mute state persisted.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/stores/settingsStore.ts apps/client/src/utils/sounds.ts apps/client/src/App.tsx
git commit -m "feat(client): add mute mode with persistent toggle"
```

---

## Task 9: Pack Completion Badges & Counters

**Files:**
- Modify: `apps/client/src/components/HomeScreen.tsx`

- [ ] **Step 1: Add completion counter and filter to HomeScreen**

In the pack selection step (Step 1) of HomeScreen, add above the pack grid:

```tsx
const completedCount = packs.filter((p) => completedSlugs.includes(p.slug)).length;
const [showOnlyNew, setShowOnlyNew] = useState(false);

const filteredPacks = showOnlyNew
  ? packs.filter((p) => !completedSlugs.includes(p.slug))
  : packs;
```

Add the counter and filter toggle:

```tsx
<div className="flex items-center justify-between mb-4">
  <span className="text-sm text-muted-foreground">
    {completedCount}/{packs.length} packs terminés
  </span>
  <Button variant="ghost" size="sm" onClick={() => setShowOnlyNew(!showOnlyNew)}>
    {showOnlyNew ? "Voir tous" : "Non terminés uniquement"}
  </Button>
</div>
```

- [ ] **Step 2: Style completed pack cards**

On each pack card, if completed, add a visual indicator:

```tsx
<div className={`relative ${completedSlugs.includes(pack.slug) ? "opacity-75" : ""}`}>
  {/* existing card content */}
  {completedSlugs.includes(pack.slug) && (
    <div className="absolute top-2 right-2 bg-party-green/90 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
      <Check className="w-3 h-3" /> Terminé
    </div>
  )}
</div>
```

- [ ] **Step 3: Verify**

Complete a pack, return to home → pack shows "Terminé" badge, counter updates.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/components/HomeScreen.tsx
git commit -m "feat(client): add pack completion badges, counter, and filter"
```

---

## Task 10: Party Theme Refresh

**Files:**
- Modify: `apps/client/src/index.css`
- Modify: `apps/client/src/components/HomeScreen.tsx`
- Modify: `apps/client/src/components/GameScreen.tsx`
- Modify: `apps/client/src/components/EndScreen.tsx`

- [ ] **Step 1: Install canvas-confetti**

```bash
cd apps/client && bun add canvas-confetti && bun add -d @types/canvas-confetti
```

- [ ] **Step 2: Enhance CSS animations and glow effects**

In `apps/client/src/index.css`, add new animations:

```css
@keyframes bounce-in {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.05); }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

@keyframes score-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.animate-bounce-in { animation: bounce-in 0.5s ease-out; }
.animate-shake { animation: shake 0.5s ease-in-out; }
.animate-score-pop { animation: score-pop 0.3s ease-out; }
```

Enhance existing glow effects with stronger shadows and add neon text utility:

```css
.text-glow-purple {
  text-shadow: 0 0 10px var(--color-neon-purple), 0 0 40px var(--color-neon-purple);
}

.text-glow-pink {
  text-shadow: 0 0 10px var(--color-neon-pink), 0 0 40px var(--color-neon-pink);
}
```

- [ ] **Step 3: Add confetti triggers**

Create a utility at `apps/client/src/utils/confetti.ts`:

```ts
import confetti from "canvas-confetti";

export function fireCorrectAnswer() {
  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.7 },
    colors: ["#a855f7", "#ec4899", "#06b6d4"],
  });
}

export function fireGameEnd() {
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
```

- [ ] **Step 4: Integrate confetti into game events**

In `apps/client/src/stores/gameStore.ts`:
- Import `fireCorrectAnswer` from confetti utils
- Call `fireCorrectAnswer()` alongside `sounds.win()` when a correct answer is submitted

In `apps/client/src/components/EndScreen.tsx`:
- Import `fireGameEnd` from confetti utils
- Call `fireGameEnd()` on mount via `useEffect`:
  ```tsx
  useEffect(() => { fireGameEnd(); }, []);
  ```

- [ ] **Step 5: Enhance HomeScreen with party vibes**

In `apps/client/src/components/HomeScreen.tsx`:
- Add `text-glow-purple` class to the main title
- Add `animate-bounce-in` class to pack cards on load
- Use stronger gradients on mode selection cards
- Add subtle `animate-pulse-glow` to the "Lancer la partie" button

- [ ] **Step 6: Enhance EndScreen**

In `apps/client/src/components/EndScreen.tsx`:
- Add `animate-bounce-in` to the winner card
- Add `animate-score-pop` to scores display
- Use `text-glow-pink` on the winner's name

- [ ] **Step 7: Verify**

Run: `cd apps/client && bun run dev`

Test: Full game flow — confetti on correct answers, shake on wrong answers, confetti rain on end screen, glow effects on titles, bounce animations on pack cards.

- [ ] **Step 8: Commit**

```bash
git add apps/client/src/index.css apps/client/src/utils/confetti.ts apps/client/src/stores/gameStore.ts apps/client/src/components/
git commit -m "feat(client): party theme refresh with confetti, glow effects, and animations"
```

---

## Task 11: E2E Tests Update

**Files:**
- Modify: `apps/client/tests/e2e/*.spec.ts`
- Modify: `apps/client/tests/helpers/fixtures.ts`

- [ ] **Step 1: Update test fixtures for Player objects**

In `apps/client/tests/helpers/fixtures.ts`, update any helper that adds players to pass gender:

The player setup helpers need to account for the new gender selector. Update the `setupGame` fixture to click a gender button before adding each player.

- [ ] **Step 2: Update mock API routes**

Tests currently mock `/packs.json` and `/packs/questions-*.json`. Update mocks to intercept Strapi API calls instead:
- Mock `GET /api/question-packs*` → return pack list in Strapi format (`{ data: [...] }`)
- Mock `GET /api/questions*` → return questions in Strapi format

- [ ] **Step 3: Run the full E2E suite**

```bash
cd apps/client && bunx playwright test
```

Fix any failures caused by the Player migration or API changes.

- [ ] **Step 4: Commit**

```bash
git add apps/client/tests/
git commit -m "test(e2e): update tests for Player objects and Strapi API mocks"
```
