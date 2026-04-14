import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, expect, type Page } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCKS_DIR = join(__dirname, "..", "mocks", "data");

function loadMock(filename: string): string {
  return readFileSync(join(MOCKS_DIR, filename), "utf-8");
}

async function mockNetwork(page: Page) {
  const packsData = loadMock("packs.json");

  // Mock Strapi packs endpoint
  await page.route("**/api/question-packs**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: packsData,
    }),
  );

  // Mock Strapi questions endpoint — extract pack slug from query params
  await page.route("**/api/questions**", (route) => {
    const url = new URL(route.request().url());
    const slug =
      url.searchParams.get("filters[pack][slug][$eq]") ?? "pack-test";
    const filename = `questions-${slug}.json`;
    try {
      const data = loadMock(filename);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: data,
      });
    } catch {
      return route.fulfill({ status: 404, body: "Not found" });
    }
  });

  await page.route("**/*.mp3", (route) =>
    route.fulfill({ status: 200, contentType: "audio/mpeg", body: "" }),
  );

  await page.route("**/clerk.*.com/v1/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    }),
  );

  await page.route("**/.well-known/openid-configuration", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    }),
  );
}

export const test = base.extend<{ mockApp: Page }>({
  mockApp: async ({ page }, use) => {
    await mockNetwork(page);
    // Bypass AuthGuard for E2E tests (Clerk SDK can't fully initialize with mocked endpoints)
    await page.addInitScript(() => {
      (window as any).__clerk_test_bypass__ = true;
    });
    await page.goto("/play/solo");
    await page
      .getByText("Pack Test", { exact: false })
      .first()
      .waitFor({ timeout: 10000 });
    await use(page);
  },
});

export { expect };

// --- Helpers ---

/** Select a pack by name on the home page (step 1 → step 2) */
export async function selectPack(page: Page, name = "Pack Test") {
  await page
    .getByRole("button", { name: new RegExp(name) })
    .first()
    .click();
  await page.getByPlaceholder("Nom du joueur").waitFor();
}

/** Add one or more players on step 2 (with gender selection) */
export async function addPlayers(page: Page, players: string[]) {
  const input = page.getByPlaceholder("Nom du joueur");
  for (const name of players) {
    await input.fill(name);
    // Gender defaults to "homme" in the UI, so clicking Homme is optional,
    // but we click it explicitly to ensure the button state is correct
    await page.getByRole("button", { name: "Homme", exact: true }).click();
    await page.getByRole("button", { name: "Ajouter" }).click();
  }
}

/** Navigate from step 2 → step 3 (mode selection) */
export async function goToModeSelection(page: Page) {
  await page.getByRole("button", { name: "Choisir le mode de jeu" }).click();
  await page.getByText("Choisis un mode de jeu").waitFor();
}

/** Start a specific game mode from step 3 */
export async function startMode(
  page: Page,
  mode: "Classique" | "Voleur" | "Contre la montre",
) {
  await page.getByRole("button", { name: new RegExp(mode) }).click();
  await page.waitForURL("**/game");
}

/** Full setup: select pack → add players → pick mode → land on /game */
export async function setupGame(
  page: Page,
  opts: {
    players: string[];
    mode: "Classique" | "Voleur" | "Contre la montre";
    pack?: string;
  },
) {
  await selectPack(page, opts.pack ?? "Pack Test");
  await addPlayers(page, opts.players);
  await goToModeSelection(page);
  await startMode(page, opts.mode);
}

/**
 * Detect the current question type from visible answer inputs.
 * Returns "qcm" | "vrai_faux" | "texte"
 */
export async function detectQuestionType(
  page: Page,
): Promise<"qcm" | "vrai_faux" | "texte"> {
  // Wait for any answer input to be rendered before detecting
  await page
    .locator(
      'button:has-text("Vrai"), [placeholder="Votre reponse..."], .grid button',
    )
    .first()
    .waitFor({ timeout: 5000 });

  if (await page.getByRole("button", { name: "Vrai", exact: true }).isVisible())
    return "vrai_faux";
  if (await page.getByPlaceholder("Votre reponse...").isVisible())
    return "texte";
  return "qcm";
}

/**
 * Answer the current question correctly based on known mock data.
 * Returns the question type that was answered.
 */
export async function answerCorrectly(page: Page): Promise<string> {
  const type = await detectQuestionType(page);
  const questionText = (await page.locator("p.text-xl").textContent()) ?? "";

  if (type === "vrai_faux") {
    const answer = ANSWERS_VF[questionText];
    if (answer === undefined)
      throw new Error(`Unknown vrai_faux question: ${questionText}`);
    await page
      .getByRole("button", { name: answer ? "Vrai" : "Faux", exact: true })
      .click();
  } else if (type === "texte") {
    const answer = ANSWERS_TEXT[questionText];
    if (!answer) throw new Error(`Unknown texte question: ${questionText}`);
    const input = page.getByPlaceholder("Votre reponse...");
    await input.fill(answer);
    await input.press("Enter");
  } else {
    const answer = ANSWERS_QCM[questionText];
    if (!answer) throw new Error(`Unknown QCM question: ${questionText}`);
    await page.getByRole("button", { name: answer, exact: true }).click();
  }

  return type;
}

/** Answer the current question incorrectly. */
export async function answerIncorrectly(page: Page): Promise<string> {
  const type = await detectQuestionType(page);
  const questionText = (await page.locator("p.text-xl").textContent()) ?? "";

  if (type === "vrai_faux") {
    const answer = ANSWERS_VF[questionText];
    if (answer === undefined)
      throw new Error(`Unknown vrai_faux question: ${questionText}`);
    await page
      .getByRole("button", { name: answer ? "Faux" : "Vrai", exact: true })
      .click();
  } else if (type === "texte") {
    const input = page.getByPlaceholder("Votre reponse...");
    await input.fill("mauvaise reponse xyz");
    await input.press("Enter");
  } else {
    const answer = ANSWERS_QCM[questionText];
    if (!answer) throw new Error(`Unknown QCM question: ${questionText}`);
    // Click first choice that is NOT the correct answer
    const buttons = page.locator(".grid button");
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const text = await buttons.nth(i).textContent();
      if (text?.trim() !== answer) {
        await buttons.nth(i).click();
        return type;
      }
    }
  }

  return type;
}

/** Click "Question suivante" */
export async function nextQuestion(page: Page) {
  await page.getByRole("button", { name: "Question suivante" }).click();
}

/** Get current score text for a player from the scoreboard */
export async function getScore(page: Page, player: string): Promise<string> {
  const row = page
    .locator("div")
    .filter({ hasText: new RegExp(`^${player}$`) })
    .first()
    .locator("..");
  return (await row.locator("div").last().textContent()) ?? "0";
}

// --- Answer keys from mock data ---

const ANSWERS_QCM: Record<string, string> = {
  "Quelle est la capitale de la France ?": "Paris",
  "Combien de planètes dans le système solaire ?": "8",
  "Quel est le plus long fleuve du monde ?": "Nil",
};

const ANSWERS_VF: Record<string, boolean> = {
  "Le soleil se lève à l'ouest.": false,
  "L'eau bout à 100°C au niveau de la mer.": true,
  "L'Australie est un continent.": true,
};

const ANSWERS_TEXT: Record<string, string> = {
  "Quel est le plus grand océan du monde ?": "Pacifique",
  "Quel gaz les plantes absorbent-elles ?": "CO2",
  "Quelle est la capitale du Japon ?": "Tokyo",
};
