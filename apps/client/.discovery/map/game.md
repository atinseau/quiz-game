# Game

**URL:** /game
**Last explored:** 2026-04-13

## Layout

Single card centered on screen with header (category, timer, counter), player turn, question, answer inputs, feedback, steal zone, action buttons, and scoreboard. Floating reset button bottom-right.

## Zones

### Header

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Category badge | badge | "{category}" | e.g. "Sciences", "Culture" |
| Timer badge | badge | "{timeLeft}s" | Chrono mode only, pulses red when ≤5s |
| Solo score | generic | score + combo | Solo mode only, shows in header |
| Question counter | text | "N / total" | e.g. "1 / 6" |

### Player Turn (multiplayer only)

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Label | paragraph | "C'est au tour de" | |
| Player name | paragraph | "{name}" | Bold, green colored |

### Question

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Question text | paragraph | "{question}" | Large, semibold |

### Answer Inputs (one visible at a time)

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| QCM choices | button (each) | "{choice}" | 2-column grid, disabled after answer |
| Vrai/Faux | button x2 | "Vrai" / "Faux" | Green/red styled, disabled after answer |
| Text input | textbox | "Votre reponse..." | With "Valider" button, Enter submits |
| Blind input | textbox | "Ta reponse..." | QCM only, hidden choices, +2pts. With "Voir les choix" fallback |

### Feedback

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Success | generic | "Correct ! +1 pt" or "Combo xN (+M pts)" | Green background |
| Error | generic | "Mauvaise réponse ! C'était : {answer}" | Red background |
| Warning | generic | "{stealer} vole N pt à {victim} !" | Amber background (steal) |
| Timeout | generic | "Temps écoulé ! La réponse était : {answer}" | Chrono mode only |
| Blind success | generic | "Blind correct ! x2 → +N pts" | |

### Steal Zone (Voleur mode only)

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Label | paragraph | "Quelqu'un a repondu plus vite ?" | With Zap icon |
| Player buttons | button (each) | "{otherPlayer}" | One per non-current player |

### Steal Confirm

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Validate | button | "Valider le vol" | Green gradient |
| Refuse | button | "Refuser" | Red/destructive |

### Action Buttons

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Next question | button | "Question suivante" | Advances or ends game on last |
| Force point | button | "Compter le point" | Classic/Chrono only, after wrong answer |

### Scoreboard (multiplayer only)

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Title | heading h3 | "Scores" | With Trophy icon |
| Player rows | generic (each) | "{name} {score}" | Current player highlighted |
| Combo badge | badge | "xN" | Shown when combo > 1 |

### Timer Bar (Chrono only)

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Progress bar | progressbar | — | Percentage based on timeLeft/15 |

### Floating Reset

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Reset button | button | "Recommencer la partie" | Fixed bottom-right, destructive red |

## States

| State | Trigger | Key changes |
|-------|---------|-------------|
| unanswered | question load | Inputs enabled, no feedback |
| answered-correct | correct answer | Inputs disabled, green feedback, next button |
| answered-wrong (classic) | wrong answer | Red feedback, next + force point buttons |
| answered-wrong (voleur) | wrong answer | Red feedback, steal zone visible, next button |
| steal-confirm | click steal player | Validate/Refuse buttons replace steal zone |
| steal-validated | click validate | Warning feedback, scores updated |
| steal-refused | click refuse | Error feedback, stealer loses 1pt |
| timeout (chrono) | timer reaches 0 | Error feedback, -0.5pts |

## Interactions

- [x] Click QCM choice → submits answer
- [x] Click Vrai/Faux → submits answer
- [x] Type text + Enter/Valider → submits answer
- [x] Click "Question suivante" → advance to next or /end
- [x] Click "Compter le point" → force point for current player
- [x] Click steal player button → opens confirm
- [x] Click "Valider le vol" → steal succeeds
- [x] Click "Refuser" → steal fails
- [x] Click reset → navigates to /
- [ ] Blind input → type answer then submit for x2
- [ ] Click "Voir les choix" → reveals QCM choices
