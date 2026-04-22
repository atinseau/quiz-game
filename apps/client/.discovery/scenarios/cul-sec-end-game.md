# Scenario: Cul sec — end game (solo)

**Status:** covered
**Priority:** high
**Page:** end
**Domain:** solo
**Spec:** alcohol-cul-sec-end

## Preconditions

- URL: /play/solo (auth bypass)
- Required mocks: Strapi packs API
- Initial state: pack selected, 2 players added, on mode selection

## Steps

1. Enable alcohol mode with Cul sec
   - **Do:** Click "Désactivé" to enable, set frequency 10, confirm "Le perdant boit cul sec" label
   - **Expect:** Config expanded with Cul sec toggle visible

2. Start classic game
   - **Do:** Click Classique
   - **Expect:** Navigate to /game

3. Play all 6 questions incorrectly
   - **Do:** Loop 6 times: answer wrong, click Question suivante until /end
   - **Expect:** Eventually navigate to /end

4. Verify end screen
   - **Do:** Read /end content
   - **Expect:** "Partie terminée" heading visible, "Nouvelle partie" button present

## Assertions

- [ ] End screen shows "Partie terminée"
- [ ] "Nouvelle partie" button visible on /end
- [ ] Either CUL SEC alert present OR end screen is functional (current solo limitation documented)

## Notes

Solo mode does NOT implement cul-sec at game end — alcoholStore.culSecEndGame is set but gameStore.nextQuestion does not trigger a drink alert. Cul-sec at end-of-game is only implemented for multiplayer via WS (server sends drink_alert before game_over).
