# Scenario: Lobby — copy room code to clipboard

**Status:** covered
**Priority:** medium
**Page:** lobby
**Domain:** multi
**Spec:** multi-lobby

## Preconditions

- Host in a lobby at /play/lobby/{code}
- Browser context granted `clipboard-read` + `clipboard-write` permissions
- Required mocks: Strapi packs, Clerk auth, WS user override, mock Strapi on :1337

## Steps

1. Host creates a room
   - **Do:** `setTestUser(host, "Alice")`, `hostCreatesRoom(host)` → code
   - **Expect:** Lobby visible with the 6-char code displayed

2. Click the copy button next to the code
   - **Do:** Click the icon button next to the code text
   - **Expect:** No navigation, same page

3. Read clipboard
   - **Do:** `page.evaluate(() => navigator.clipboard.readText())`
   - **Expect:** Clipboard text === the visible room code

## Assertions

- [x] Clicking the copy button does not navigate
- [x] Clipboard content matches the displayed 6-char code

## Notes

Validated live on 2026-04-20. Test must grant clipboard permissions via `context.grantPermissions(['clipboard-read', 'clipboard-write'])` before running.
