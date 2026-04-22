# Scenario: Classic mode — full game flow

**Status:** covered
**Priority:** critical
**Page:** game
**Domain:** solo
**Spec:** classic-flow

## Preconditions

- URL: /
- Required mocks: packs.json, questions-test.json, audio files
- Initial state: Home page with pack selection visible

## Steps

1. Select pack
   - **Do:** Click "Pack Test" card
   - **Expect:** Navigate to player setup step

2. Add a single player
   - **Do:** Type "Alice" + Enter
   - **Expect:** Alice badge appears, "Choisir le mode de jeu" enabled

3. Go to mode selection
   - **Do:** Click "Choisir le mode de jeu"
   - **Expect:** Mode cards visible, Voleur hidden (1 player)

4. Start Classic mode
   - **Do:** Click "Classique" card
   - **Expect:** Navigate to /game, first question displayed, solo score in header

5. Answer QCM correctly
   - **Do:** Click correct answer choice
   - **Expect:** Green feedback "Correct ! +1 pt", score updates, next button visible

6. Click next question
   - **Do:** Click "Question suivante"
   - **Expect:** New question displayed, answer inputs reset

7. Answer wrong
   - **Do:** Click wrong choice
   - **Expect:** Red feedback with correct answer, "Compter le point" button visible

8. Complete all questions
   - **Do:** Answer remaining questions, click next after last
   - **Expect:** Navigate to /end, solo score displayed

9. Start new game
   - **Do:** Click "Nouvelle partie"
   - **Expect:** Navigate to /, state reset

## Assertions

- [ ] Game navigates to /game on mode selection
- [ ] Score increments on correct answer
- [ ] Combo increases on consecutive correct answers
- [ ] Feedback text matches answer correctness
- [ ] "Compter le point" shown only after wrong answer in classic
- [ ] Last "Question suivante" navigates to /end
- [ ] End screen shows solo score with total questions
- [ ] "Nouvelle partie" resets and returns to /

## Notes

Solo mode (1 player) hides the scoreboard and shows SoloScore in header instead.
