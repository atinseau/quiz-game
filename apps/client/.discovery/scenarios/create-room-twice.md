---
name: create-room-twice
description: Creating a room, navigating back to /play, then creating again must produce a fresh room without "Room introuvable" error
type: scenario
---

# Scenario: Create room twice in a row

**Status:** covered
**Priority:** critical
**Page:** mode-choice / lobby
**Domain:** e2e
**Spec:** multi-lobby

## Preconditions

- URL: /play
- Test user authenticated via fixtures bypass
- No existing room for this user

## Steps

1. Navigate to /play
   - **Do:** `page.goto('/play')`
   - **Expect:** ModeChoice visible with "Créer une partie" button
2. Click "Créer une partie"
   - **Do:** click button
   - **Expect:** URL becomes `/play/lobby/<codeA>`, lobby renders with code
3. Navigate back to /play
   - **Do:** `page.goBack()` or `page.goto('/play')`
   - **Expect:** ModeChoice visible again
4. Click "Créer une partie" a second time
   - **Do:** click button
   - **Expect:** URL becomes `/play/lobby/<codeB>` where codeB !== codeA, lobby renders with the NEW code, NO "Room introuvable" toast

## Assertions

- [ ] Second createRoom navigates to a lobby URL
- [ ] The second lobby's displayed code differs from the first
- [ ] No "Room introuvable" toast appears
- [ ] Page does not bounce back to /play

## Notes

**Actual behavior (bug):** After the second click, user is redirected to /play with a "Room introuvable" error toast.

**Root cause:** `CreateRoom` component in App.tsx reads stale `room` from the store on re-mount. Its navigate effect fires immediately with the OLD room code, routing to `/play/lobby/<OLD>`. Meanwhile the async `create_room` WS message deletes the old room server-side and creates a new one. When the store updates to the new room, `MultiLobby`'s URL-vs-room mismatch effect clears the state and auto-joins the OLD (now deleted) code.

**Fix:** `ModeChoice` button handler now clears `{room, gameStarting, error}` from the Zustand store before navigating to `/play/create`, so `CreateRoom`'s mount render sees `room=null`. Also defensively clears in `roomStore.createRoom` action.
