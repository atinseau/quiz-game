import {
  answerCorrectly,
  expect,
  nextQuestion,
  setupGame,
  test,
} from "../../helpers/fixtures";

test("Chrono mode — timer lifecycle (visible → stop → reset → timeout)", async ({
  mockApp: page,
}) => {
  test.setTimeout(45_000);

  await setupGame(page, { players: ["Alice"], mode: "Contre la montre" });

  // 1. Timer is visible and counting down on Q1.
  await expect(page.getByText(/\d+s/)).toBeVisible();
  await expect(page.getByRole("progressbar")).toBeVisible();

  // 2. Answering stops the timer — progress bar disappears.
  await answerCorrectly(page);
  await expect(page.getByText("Correct")).toBeVisible();
  await expect(page.getByRole("progressbar")).not.toBeVisible();

  // 3. Going to the next question resets the timer.
  await nextQuestion(page);
  await expect(page.getByText(/\d+s/)).toBeVisible();
  await expect(page.getByRole("progressbar")).toBeVisible();

  // 4. Letting the timer expire yields the "Temps écoulé" feedback with no
  // "Compter le point" button (forbidden in chrono after timeout).
  await page.getByText("Temps écoulé").waitFor({ timeout: 20000 });
  await expect(
    page.getByRole("button", { name: "Compter le point" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Question suivante" }),
  ).toBeVisible();
});
