# Scenario: Show Us — target unblocks once every voter has voted

**Status:** covered
**Priority:** critical
**Page:** multi-game
**Domain:** regression
**Spec:** multi-repro-show-us-reveal-unblocks

## Preconditions

- URL: /play
- Required mocks: packs.json, questions-pack-test.json, audio files
- Alcohol config: frequency=1, enabledRounds=["show_us"], 2 connected players

## Steps

1. Play one turn → Show Us overlay appears
   - **Do:** `playTurnsMulti(host, guest, 1)`, then `waitForRoundOverlayAnyPlayer(host, guest, "show_us")`
   - **Expect:** both devices are on the Show Us overlay

2. Identify target (sees "Les autres devinent ta couleur") vs voter
   - **Do:** poll for the target hint text on each page
   - **Expect:** exactly one page is the target

3. Voter picks a color via the UI (click "Bleu")
   - **Do:** `voter.getByRole("button", { name: "Bleu", exact: true }).click()`
   - **Expect:** target transitions from "attends !" to "Les autres ont voté ! Révèle maintenant ta couleur." — reveal buttons are enabled

4. Target reveals via UI (click a color)
   - **Do:** `target.getByRole("button", { name: "Rouge", exact: true }).click()`
   - **Expect:** both devices show the result phase ("Couleur de X :")

## Assertions

- [ ] Target's reveal buttons appear as soon as every connected non-target voter has voted
- [ ] Target can reveal and the result phase renders on both devices

## Notes

**Was bug:** the server just stored votes in a map and never notified the target. `data.phase` was driven by `show_us_result` only, so the target sat on the voting screen forever (bar the 15s server timeout). Fix broadcasts `show_us_all_voted` once every connected non-target voter has submitted; `roomStore` flips `data.phase` to `waiting_reveal` on receipt.

Server fix: `apps/client/src/server/alcohol/rounds/show-us.ts` (vote handler), `apps/client/src/shared/types.ts` (`show_us_all_voted` added to `ServerMessage`), `apps/client/src/stores/roomStore.ts` (handler).
