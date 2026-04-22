# Scenario: Marketplace — landing page shows premium price

**Status:** covered
**Priority:** medium
**Page:** landing
**Domain:** solo
**Spec:** marketplace

## Preconditions

- URL: /
- Required mocks: packs API overridden with one premium pack (price 4.99€), Clerk auth, well-known endpoints
- Initial state: unauthenticated landing page

## Steps

1. Setup premium pack mock
   - **Do:** Override `/api/question-packs` with a single premium pack at 4.99€
   - **Expect:** Mock installed

2. Navigate to landing
   - **Do:** `page.goto('/')`
   - **Expect:** Landing renders with pack preview

3. Verify price badge
   - **Do:** Read "4.99€" text
   - **Expect:** Price visible within 5s

## Assertions

- [ ] Premium price is shown in the landing pack preview

## Notes

This scenario validates that the public landing page exposes pricing before sign-in.
