# Multi Game

**URL:** /game (multi mode)
**Last explored:** 2026-04-20

## Layout

Shared /game route for multi-device play. Server drives turn/question state via WebSocket. Current player's device enables answer inputs; other devices see them disabled with "C'est au tour de {name}". Both devices render the same category/question/scoreboard.

## Zones

### Header

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Quitter la partie | button | X icon | Returns to /play |
| Couper le son | button | Volume icon | Mute toggle |

### Question Header

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Category | generic | "{category}" | e.g. "Culture" |
| Counter | generic | "{N}" | Current question number |

### Turn Indicator

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Current player | paragraph | "C'est ton tour !" | Visible only on active player's device |
| Waiting | paragraph | "C'est au tour de {username}" | Visible on non-active players' devices |

### Loading State

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Waiting | generic | "En attente de la question..." | Between turns or while server prepares state |

### Question

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Question text | paragraph | "{question}" | Prominent; same text on host + guest |

### Answer Inputs

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| QCM buttons | button (each) | "{choice}" | Enabled on active device, `[disabled]` on others |
| Vrai/Faux | button x2 | "Vrai" / "Faux" | Same enabled/disabled rule |
| Text input | textbox | "Votre réponse..." | Active device only; Enter to submit |

### Scoreboard

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Separator | separator | — | |
| Title | heading h3 | "Scores" | With Trophy icon |
| Player rows | generic (each) | "{username}" | Current player highlighted; score displayed next to name |

### Voleur Steal Zone (mode=voleur)

Same shape as solo `game.md` — steal zone appears on the main player's device after a wrong answer, other players see their own steal buttons to claim the question.

### Alcohol Overlays

Rendered on top of the game layer for special rounds. See solo `game.md` zones — the multi server synchronizes overlay state across devices.

## States

| State | Trigger | Key changes |
|-------|---------|-------------|
| waiting | Room navigates to /game before first question | "En attente de la question..." placeholder |
| turn-mine | Server sends question with my turn | Inputs enabled, "C'est ton tour !" |
| turn-other | Server sends question for another player | Inputs disabled, "C'est au tour de {name}" |
| answered | Player submits via enabled input | Feedback + next-question transition (server-driven) |
| scoreboard-updated | Server pushes score update | Scoreboard reflects new values |

## Interactions

- [x] Active device clicks a QCM answer → turn resolves server-side, scoreboard updates
- [x] Non-active device sees disabled answer buttons with turn label
- [ ] Voleur steal initiated from non-main player device (covered in discovered scenarios)
- [ ] Alcohol overlay syncs across devices (covered in alcohol scenarios)
- [ ] Chrono 15s server timeout (covered in multi-chrono-flow scenario)

## Notes

- The client-side mock of `**/api/questions**` does NOT help — server-side `fetchQuestions` queries Strapi at `localhost:1337`. A mock Strapi server (see `tests/global-setup.ts`) is required for exploration.
- `useAuth().userId` is null in test mode, so the host-only button click logic still reaches the server because the WS send path is used. UI buttons for pack/mode worked for our explorer session when clicked as the first connected socket (server treats first joiner as host).
