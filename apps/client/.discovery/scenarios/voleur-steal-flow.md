# Scenario: Voleur mode — steal mechanics

**Status:** covered
**Priority:** critical
**Page:** game
**Domain:** solo
**Spec:** voleur-steal

## Preconditions

- URL: /
- Required mocks: packs.json, questions-test.json, audio files
- Initial state: Home page

## Steps

1. Set up 2 players and start Voleur
   - **Do:** Select pack, add "Alice" and "Bob", choose Voleur mode
   - **Expect:** Navigate to /game in voleur mode

2. Answer wrong to trigger steal zone
   - **Do:** Click wrong answer
   - **Expect:** Red feedback, steal zone appears with other player's button

3. Initiate steal
   - **Do:** Click the other player's name in steal zone
   - **Expect:** "Valider le vol" and "Refuser" buttons appear

4. Validate steal
   - **Do:** Click "Valider le vol"
   - **Expect:** Warning feedback "{stealer} vole 0.5 pt à {victim}", scores update (+0.5/-0.5)

5. On another wrong answer, refuse steal
   - **Do:** Answer wrong again, initiate steal, click "Refuser"
   - **Expect:** Error feedback "Vol raté ! {stealer} perd 1 pt.", stealer score -1

## Assertions

- [ ] Steal zone only appears after wrong answer in voleur mode
- [ ] Steal zone shows all non-current players
- [ ] Successful steal: stealer +0.5, victim -0.5
- [ ] Failed steal: stealer -1
- [ ] "Compter le point" is NOT shown in voleur mode
- [ ] After steal confirmation, "Question suivante" appears

## Notes

Steal zone remains visible after a steal is resolved, allowing another player to also attempt a steal.
