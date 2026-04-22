# Scenario: Marketplace — free pack selection

**Status:** covered
**Priority:** high
**Page:** home
**Domain:** solo
**Spec:** marketplace

## Preconditions

- URL: /play/solo (auth bypass)
- Required mocks: Strapi packs API (default, with free pack)
- Initial state: home with pack grid

## Steps

1. Open pack selection
   - **Do:** `page.goto('/play/solo')`
   - **Expect:** "Pack Test" card visible (free pack)

2. Select the free pack
   - **Do:** Click the pack card
   - **Expect:** Navigate to player setup step with "Nom du joueur" input visible

## Assertions

- [ ] Free pack card is clickable
- [ ] Clicking a free pack advances to player setup

## Notes

The fixture mock serves "Pack Test" as a free pack by default.
