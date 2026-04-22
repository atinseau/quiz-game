# Mode Choice

**URL:** /play
**Last explored:** 2026-04-20

## Layout

Single-screen mode selector with 3 buttons: solo, create multi room, join multi room. Includes /play/join sub-route with room code input.

## Zones

### Header

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Mute toggle | button | "Couper le son" | title attribute |

### Choice Card

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Title | heading h1 | "Comment tu veux jouer ?" | |
| Subtitle | paragraph | "Choisis ton mode de jeu avant de commencer." | |
| Solo | button | "Un seul appareil" | Navigates to /play/solo |
| Create | button | "Créer une partie" | Creates room via WS, navigates to /play/lobby/{code} |
| Join | button | "Rejoindre" | Navigates to /play/join |

### Join Route (/play/join)

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Back | button | "Retour" | Returns to /play |
| Title | heading h1 | "Rejoindre une partie" | |
| Subtitle | paragraph | "Entre le code de la room donné par le host." | |
| Code input | textbox | placeholder "Ex: A3K9F2" | 6-char room code |
| Submit | button | "Rejoindre" | Disabled until code entered; navigates to /play/lobby/{code} |

## States

| State | Trigger | Key changes |
|-------|---------|-------------|
| default | /play load | 3 choice buttons visible |
| create pending | click "Créer une partie" | WS create_room sent; on room_joined, navigate to lobby |
| join form | navigate /play/join | Code input visible, submit disabled |
| code valid | fill 6-char code | Submit enabled |

## Interactions

- [x] Click "Un seul appareil" → navigate to /play/solo (HomeScreen)
- [x] Click "Créer une partie" → create room via WS, lobby URL contains 6-char code
- [x] Click "Rejoindre" → navigate to /play/join
- [x] /play/join → fill code → click Rejoindre → navigate to /play/lobby/{code}
- [x] Click "Retour" on join → return to /play
