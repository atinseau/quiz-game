# Scenario: Alcohol mode triggers special round in solo

**Status:** discovered
**Priority:** critical
**Page:** game
**Domain:** e2e

## Preconditions

- URL: /play/solo (requires auth bypass)
- Required mocks: Strapi packs API
- Initial state: alcohol mode enabled with frequency 3, pack selected, 1 player, classic mode

## Steps

1. Start a solo game with alcohol enabled (frequency 3)
   - **Do:** select pack, add player, select mode, enable alcohol, launch
   - **Expect:** game starts normally

2. Answer 3 questions
   - **Do:** answer each question (correct or incorrect)
   - **Expect:** after 3rd answer, a special round overlay appears

3. Verify special round overlay
   - **Do:** check for overlay with round content (Petit buveur, Distributeur, or Courage)
   - **Expect:** overlay is visible with appropriate content

4. Round ends, game resumes
   - **Do:** wait for round to complete (auto-close or interact)
   - **Expect:** next question appears

## Assertions

- [ ] Special round overlay appears after N turns (configured frequency)
- [ ] DrinkAlert notification appears for affected player
- [ ] Game resumes after round ends

## Notes

Cannot explore this page with playwright-cli due to AuthGuard. Test written directly based on code knowledge.
