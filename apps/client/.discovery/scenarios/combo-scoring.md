# Scenario: Combo scoring system

**Status:** covered
**Priority:** medium
**Page:** game
**Domain:** solo
**Spec:** combo-scoring

## Preconditions

- URL: /
- Required mocks: packs.json, questions-test.json, audio files
- Initial state: Home page

## Steps

1. Start solo classic game
   - **Do:** Select pack, add "Alice", start Classic
   - **Expect:** /game, score = 0

2. Answer first question correctly
   - **Do:** Click correct answer
   - **Expect:** "Correct ! +1 pt", score = 1, combo x1

3. Answer second question correctly
   - **Do:** Click correct answer
   - **Expect:** "Combo x2 (+1.5 pts)", score = 2.5, combo badge "x2"

4. Answer third question correctly
   - **Do:** Click correct answer
   - **Expect:** "Combo x3 (+2 pts)", score = 4.5, combo badge "x3"

5. Answer wrong — combo breaks
   - **Do:** Click wrong answer
   - **Expect:** Error feedback, combo resets (no badge), score unchanged

6. Answer correctly again
   - **Do:** Click correct answer
   - **Expect:** "Correct ! +1 pt" (combo restarts at x1)

## Assertions

- [ ] First correct: +1pt, no combo text
- [ ] Second consecutive correct: "Combo x2 (+1.5 pts)"
- [ ] Third consecutive correct: "Combo x3 (+2 pts)"
- [ ] Wrong answer resets combo to 0
- [ ] Combo badge shows xN when combo > 1
- [ ] Combo badge disappears on reset

## Notes

Combo formula: 1 + (combo - 1) * 0.5. Max combo is 5 (capped).
With 6 questions in test pack, max reachable combo is x6 → capped to x5.
