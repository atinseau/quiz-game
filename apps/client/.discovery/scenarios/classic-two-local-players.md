# Scenario: Classic mode — two local players with force point

**Status:** covered
**Priority:** high
**Page:** game
**Domain:** solo
**Spec:** classic-two-local-players

## Preconditions

- URL: /
- Required mocks: packs.json, questions-test.json, audio files
- Initial state: Home page

## Steps

1. Set up 2 players
   - **Do:** Select pack, add "Alice" and "Bob"
   - **Expect:** Both badges visible

2. Start Classic mode
   - **Do:** Go to mode selection, click "Classique"
   - **Expect:** Navigate to /game, scoreboard visible with both players at 0

3. Player 1 answers correctly
   - **Do:** Answer correctly on Alice's turn
   - **Expect:** Alice score = 1, combo x1

4. Player 2 answers wrong
   - **Do:** Answer wrong on Bob's turn
   - **Expect:** Bob score = 0, "Compter le point" visible

5. Force the point
   - **Do:** Click "Compter le point"
   - **Expect:** Bob score = 1, combo starts, "Compter le point" disappears

6. Complete game and check leaderboard
   - **Do:** Finish all questions
   - **Expect:** /end shows sorted leaderboard with medals

## Assertions

- [ ] Turn alternates between players
- [ ] Scoreboard shows both players with correct scores
- [ ] "Compter le point" awards point and updates combo
- [ ] End screen shows leaderboard sorted by score
- [ ] Winner has gold highlight and Crown icon

## Notes

Force point is available in classic and chrono, but not in voleur mode.
