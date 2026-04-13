# Scenario: All question types display correctly

**Status:** discovered
**Priority:** high
**Page:** game
**Domain:** e2e
**Spec:** question-types

## Preconditions

- URL: /
- Required mocks: packs.json, questions-test.json (contains all 3 types), audio files
- Initial state: Home page

## Steps

1. Start a game with test pack
   - **Do:** Select Pack Test, add "Alice", start Classic mode
   - **Expect:** Navigate to /game

2. Encounter QCM question
   - **Do:** Observe question with choices buttons
   - **Expect:** 4 choice buttons in 2-column grid, clickable

3. Answer QCM correctly
   - **Do:** Click correct choice
   - **Expect:** All choices disabled, correct feedback

4. Encounter Vrai/Faux question
   - **Do:** Navigate to a vrai_faux question
   - **Expect:** "Vrai" and "Faux" buttons visible

5. Answer Vrai/Faux
   - **Do:** Click correct button
   - **Expect:** Both buttons disabled, correct feedback

6. Encounter Texte question
   - **Do:** Navigate to a text question
   - **Expect:** Text input field with "Valider" button

7. Answer Texte correctly
   - **Do:** Type correct answer + Enter
   - **Expect:** Input disabled, correct feedback

8. Verify text input resets between questions
   - **Do:** Answer a text question, go to next (if also text)
   - **Expect:** Input is empty, not carrying previous answer

## Assertions

- [ ] QCM: 4 choices, 2-column grid, disabled after answer
- [ ] Vrai/Faux: 2 buttons, green/red styled, disabled after answer
- [ ] Texte: text input + Valider button, Enter submits, disabled after answer
- [ ] Text input clears between questions
- [ ] Feedback matches correctness for each type

## Notes

The test mock data has 2 QCM, 2 vrai_faux, and 2 texte questions across 2 categories.
Questions are shuffled randomly, so the order is not deterministic.
