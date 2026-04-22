# Scenario: Alcohol mode config UI

**Status:** covered
**Priority:** high
**Page:** home
**Domain:** solo
**Spec:** alcohol-config

## Preconditions

- URL: /play/solo (requires auth bypass)
- Required mocks: Strapi packs API
- Initial state: pack selected, 1 player added, on mode selection step

## Steps

1. Reach mode selection screen
   - **Do:** `goToModeSelection` after `selectPack` and `addPlayers`
   - **Expect:** "Mode Soirée" card visible with "Désactivé" button

2. Activate Mode Soirée
   - **Do:** Click "Désactivé" button
   - **Expect:** Button becomes "Activé", config section expands with frequency controls, rounds list, Cul sec toggle

3. Verify default rounds are listed
   - **Do:** Inspect rounds panel
   - **Expect:** Petit buveur, Distributeur, Question de courage (phase A); Conseil du village, Love or Drink, Cupidon, Show Us, Smatch or Pass (phase B)

4. Change frequency
   - **Do:** Click frequency button "3"
   - **Expect:** Display text updates to show frequency 3

5. Deactivate Mode Soirée
   - **Do:** Click "Activé" button
   - **Expect:** Config section hides, "Manches actives" no longer visible

## Assertions

- [ ] Mode Soirée card visible on mode selection
- [ ] Activate/deactivate toggle works
- [ ] Default frequency is 5
- [ ] All phase A + phase B rounds are listed
- [ ] Cul sec toggle is exposed
- [ ] Frequency change reflects in summary text

## Notes

Config UI is exposed through mode selection step of home flow.
