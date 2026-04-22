# Scenario: Lobby — edit own username in-lobby

**Status:** covered
**Priority:** medium
**Page:** lobby
**Domain:** multi
**Spec:** multi-lobby

## Preconditions

- Host in a lobby at /play/lobby/{code}
- Required mocks: Strapi packs, Clerk auth, WS user override, mock Strapi on :1337
- Initial state: host's name shown as the initial testUser name

## Steps

1. Host creates a room
   - **Do:** `hostCreatesRoom(host)`
   - **Expect:** Player row shows initial username text and "Modifier ton nom" button

2. Click "Modifier ton nom"
   - **Do:** Click the pencil-icon button
   - **Expect:** Username text is replaced by a textbox pre-filled with the current name

3. Fill new name + submit
   - **Do:** `textbox.fill("NouveauNom")` then press Enter
   - **Expect:** Textbox closes; player row shows "NouveauNom"

## Assertions

- [x] "Modifier ton nom" button opens an inline textbox pre-filled with current name
- [x] Entering a new name + Enter persists the change in the visible row
- [x] The updated name propagates to any other connected device (verify via guest snapshot)

## Notes

Validated live on 2026-04-20. The textbox is rendered inline without a save button — Enter is the submit path. Other devices see the updated name via WS broadcast (verified: guest saw "NouveauNom" as the turn owner).
