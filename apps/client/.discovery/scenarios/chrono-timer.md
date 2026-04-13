# Scenario: Chrono mode — timer and timeout

**Status:** discovered
**Priority:** critical
**Page:** game
**Domain:** e2e
**Spec:** chrono-timer

## Preconditions

- URL: /
- Required mocks: packs.json, questions-test.json, audio files
- Initial state: Home page

## Steps

1. Set up and start Chrono mode
   - **Do:** Select pack, add "Alice", choose "Contre la montre"
   - **Expect:** Navigate to /game, timer badge visible, progress bar visible

2. Verify timer is counting down
   - **Do:** Observe timer badge
   - **Expect:** Starts at 15s, decreases every second

3. Answer before timeout
   - **Do:** Click correct answer quickly
   - **Expect:** Timer stops, normal correct feedback, score +1

4. Let timer expire
   - **Do:** Wait 15 seconds without answering
   - **Expect:** Error feedback "Temps écoulé !", score -0.5, progress bar gone

5. Verify no "Compter le point" after timeout
   - **Do:** Observe action buttons after timeout
   - **Expect:** Only "Question suivante" visible (no force point in chrono after timeout)

## Assertions

- [ ] Timer badge shows countdown from 15s
- [ ] Progress bar decreases proportionally
- [ ] Timer badge pulses red when ≤5s
- [ ] Timeout penalty is -0.5 pts
- [ ] Timer stops when answer is submitted
- [ ] Timer resets on next question
- [ ] "Compter le point" not shown after wrong answer in chrono

## Notes

The "Compter le point" button IS shown after a wrong manual answer in chrono mode (showForceBtn logic), but NOT after a timeout.
Wait — looking at code: `showForceBtn: gameMode !== "voleur"` on wrong answer, and the GameScreen shows it when `showForceBtn && gameMode !== "chrono"`. So force point is hidden in both voleur and chrono modes.
