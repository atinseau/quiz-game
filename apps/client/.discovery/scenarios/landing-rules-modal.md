# Scenario: Rules modal with tabs

**Status:** covered
**Priority:** medium
**Page:** landing
**Domain:** solo
**Spec:** landing-page

## Preconditions

- URL: /
- Required mocks: Strapi packs API
- Initial state: landing page loaded

## Steps

1. Open rules modal
   - **Do:** click "Voir les règles détaillées"
   - **Expect:** Dialog opens with "Règles du jeu" title and 3 tabs

2. Verify Classique tab (default)
   - **Do:** check active tab content
   - **Expect:** "Tour par tour" bullet visible

3. Switch to Voleur tab
   - **Do:** click "🦹 Voleur" tab
   - **Expect:** "voler sa réponse" bullet visible

4. Switch to Chrono tab
   - **Do:** click "⏱️ Chrono" tab
   - **Expect:** "15 secondes" bullet visible

5. Close modal
   - **Do:** click Close button
   - **Expect:** Modal disappears

## Assertions

- [ ] Dialog title "Règles du jeu" visible after click
- [ ] 3 tabs visible (Classique, Voleur, Chrono)
- [ ] Classique content shows by default
- [ ] Switching tabs changes content
- [ ] Modal closes on Close button
