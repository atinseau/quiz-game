# Scenario: Landing page displays correctly

**Status:** discovered
**Priority:** high
**Page:** landing
**Domain:** e2e

## Preconditions

- URL: /
- Required mocks: Strapi packs API (returns 2+ packs)
- Initial state: not signed in

## Steps

1. Navigate to /
   - **Do:** page.goto("/")
   - **Expect:** Landing page loads with hero, pack preview, game modes

2. Verify hero section
   - **Do:** check heading, subtitle, CTA button
   - **Expect:** "Quiz Party" heading, subtitle text, "Jouer maintenant" button visible

3. Verify pack preview
   - **Do:** check pack cards
   - **Expect:** At least 2 pack cards visible with name and question count

4. Verify game modes
   - **Do:** check mode cards
   - **Expect:** Classique, Voleur, Contre la montre cards visible

## Assertions

- [ ] Heading "Quiz Party" visible
- [ ] Subtitle contains "pimente tes soirées"
- [ ] "Jouer maintenant" button visible
- [ ] Pack cards visible (at least 1)
- [ ] 3 game mode cards visible
- [ ] "Voir les règles détaillées" button visible
