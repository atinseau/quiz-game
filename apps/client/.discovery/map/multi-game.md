# Multi Game

**URL:** /game (multi mode)
**Last explored:** 2026-04-24

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

### Conseil — Tiebreaker Reveal overlay

Shown when `conseil_result` ships `loserClerkIds.length >= 2`. Auto-advances to the spin overlay after 1.5 s.

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Emoji | generic | ⚖️ | 6xl block, above the title |
| Title | heading h2 | "Égalité !" | amber-400, bold 3xl |
| Subtitle | paragraph | "{N} joueurs à égalité" | muted text |
| Pastille | span (each) | "{username}" | amber-500 bg, rounded-full, flex-wrap list |

### Conseil — Tiebreaker Spin overlay

Follows the reveal. Wheel SVG rotates ~4 s then settles ~0.8 s before advancing to the result phase.

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Title | heading h2 | "Tirage au sort..." | amber-400 |
| Wheel | svg | aria-label="Roue de la fortune" | 220x220 px, cubic-bezier ease-out, 5 full rotations |
| Pointer | generic | — | amber triangle fixed on top |
| Slice label | text (svg, each) | "{username}" | centered radially at 60% of radius |

### Drink alert — personalized (plateforme)

Fires via `drink_alert` WS message. Different text shown to the drinker vs observers based on `myClerkId ∈ targetClerkIds`.

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Overlay | button (fullscreen) | — | fixed inset-0 black/70 backdrop, click-to-close |
| Emoji | generic | "🗳️" / "🍺" / "🥃" / "💘" etc. | text-8xl |
| Verdict (self) | paragraph | "C'est pour toi !" | text-2xl white bold (when myClerkId in targetClerkIds) |
| Verdict (observer) | paragraph | "C'est pour {joinNames} !" | same styling, name(s) of drinker(s) |
| Action | paragraph | "Boire une gorgée" / "Faire un cul-sec" | text-lg amber-400 (capitalized first letter) |
| Others hint | paragraph | "(+ {names})" | text-sm white/60, only when self and multi-drinker |
| Details | generic | — | optional `DrinkAlertDetails` (e.g. courage given + correct answer) |

## States

| State | Trigger | Key changes |
|-------|---------|-------------|
| waiting | Room navigates to /game before first question | "En attente de la question..." placeholder |
| turn-mine | Server sends question with my turn | Inputs enabled, "C'est ton tour !" |
| turn-other | Server sends question for another player | Inputs disabled, "C'est au tour de {name}" |
| answered | Player submits via enabled input | Feedback + next-question transition (server-driven) |
| scoreboard-updated | Server pushes score update | Scoreboard reflects new values |
| conseil-tiebreaker-reveal | `conseil_result` with `loserClerkIds.length >= 2` | overlay ⚖️ + "Égalité !" pastilles, auto-advance 1.5 s |
| conseil-tiebreaker-spin | 1.5 s after reveal | wheel SVG rotates to server `selectedClerkId`, 4 s + 0.8 s settle |
| drink-alert-self | `drink_alert` with myClerkId in targetClerkIds | verdict "C'est pour toi !", 4 s auto-close |
| drink-alert-observer | `drink_alert` without myClerkId in targetClerkIds | verdict "C'est pour {name(s)} !", 4 s auto-close |

## Interactions

- [x] Active device clicks a QCM answer → turn resolves server-side, scoreboard updates
- [x] Non-active device sees disabled answer buttons with turn label
- [ ] Voleur steal initiated from non-main player device (covered in discovered scenarios)
- [ ] Alcohol overlay syncs across devices (covered in alcohol scenarios)
- [ ] Chrono 15s server timeout (covered in multi-chrono-flow scenario)

## Notes

- The client-side mock of `**/api/questions**` does NOT help — server-side `fetchQuestions` queries Strapi at `localhost:1337`. A mock Strapi server (see `tests/global-setup.ts`) is required for exploration.
- `useAuth().userId` is null in test mode, so the host-only button click logic still reaches the server because the WS send path is used. UI buttons for pack/mode worked for our explorer session when clicked as the first connected socket (server treats first joiner as host).
