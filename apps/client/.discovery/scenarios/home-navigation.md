# Scenario: Home page navigation and setup

**Status:** covered
**Priority:** high
**Page:** home
**Domain:** solo
**Spec:** home-nav

## Preconditions

- URL: /
- Required mocks: packs.json, audio files
- Initial state: Home page with pack selection

## Steps

1. Verify pack cards display
   - **Do:** Observe pack grid
   - **Expect:** Both test packs visible with name, description, icon, question count

2. Search packs
   - **Do:** Type "Test 2" in search
   - **Expect:** Only "Pack Test 2" visible

3. Clear search
   - **Do:** Clear search field
   - **Expect:** All packs visible again

4. Select pack and verify player step
   - **Do:** Click "Pack Test"
   - **Expect:** Step 2 with pack summary, player input, disabled continue button

5. Add player
   - **Do:** Type "Alice" + Enter
   - **Expect:** "Alice" badge appears, continue button enabled

6. Remove player
   - **Do:** Click X on Alice badge
   - **Expect:** Badge removed, continue button disabled, "Ajoute au moins un joueur" message

7. Navigate back to packs
   - **Do:** Click "Changer de pack"
   - **Expect:** Back to step 1 with pack grid

8. Verify Voleur requires 2+ players
   - **Do:** Select pack, add 1 player, go to mode selection
   - **Expect:** Classic and Chrono visible, Voleur NOT visible

9. Add second player and check Voleur
   - **Do:** Go back, add second player, return to mode selection
   - **Expect:** All 3 modes visible including Voleur

## Assertions

- [ ] Pack cards show name, description, icon, question count
- [ ] Search filters packs by name and description
- [ ] Player badge appears on add, disappears on remove
- [ ] Continue button disabled with 0 players
- [ ] Voleur mode hidden with < 2 players
- [ ] Back navigation works between all steps

## Notes

Pack selection immediately moves to step 2 (combined select + navigate).
