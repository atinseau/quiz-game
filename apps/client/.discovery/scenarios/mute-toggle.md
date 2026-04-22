# Scenario: Mute toggle persists across reload

**Status:** covered
**Priority:** medium
**Page:** landing
**Domain:** solo
**Spec:** mute-persistence

## Preconditions

- URL: /
- Required mocks: Strapi packs API (empty), Clerk auth, well-known endpoints
- Initial state: landing page loaded, unmuted (default)

## Steps

1. Reach landing with mute button
   - **Do:** `page.goto('/')` and wait for mute button
   - **Expect:** Button with title "Couper le son" visible

2. Click to mute
   - **Do:** Click the mute button
   - **Expect:** Button title becomes "Activer le son"; localStorage "quiz-muted" = "true"

3. Reload page
   - **Do:** `page.reload()`
   - **Expect:** Button title is still "Activer le son" — muted state restored

4. Click to unmute
   - **Do:** Click the mute button again
   - **Expect:** Title returns to "Couper le son"; localStorage "quiz-muted" = "false"

## Assertions

- [ ] Mute toggle updates title attribute
- [ ] localStorage key "quiz-muted" reflects state
- [ ] State persists across reload

## Notes

Mute state uses title attribute because the button has no accessible name. Test bypasses the regular fixture to control the page directly.
