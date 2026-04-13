# End

**URL:** /end
**Last explored:** 2026-04-13

## Layout

Centered card with party emoji, title, results (solo score or multiplayer leaderboard), and reset button.

## Zones

### Header

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Party icon | img | PartyPopper | Animated float |
| Title | heading | "Partie terminee !" | Gradient text |
| Subtitle | paragraph | "Ton score final" (solo) / "Voici le classement final" (multi) | |

### Solo Results

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Trophy icon | img | Trophy | Purple themed |
| Score | text | "{score}" | Large bold |
| Unit | text | "pts" | |
| Total | paragraph | "sur {totalQuestions} questions" | |

### Multiplayer Leaderboard

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Player rows | generic (each) | "{name} {score} pts" | Sorted by score descending |
| Winner row | generic | First player | Gold border, glow effect |
| Medal icons | img | Crown (1st), Medal (2nd, 3rd) | Gold, silver, bronze colors |

### Actions

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Reset button | button | "Nouvelle partie" | Full width, navigates to / |

## States

| State | Trigger | Key changes |
|-------|---------|-------------|
| solo | 1 player | Trophy + score display |
| multiplayer | 2+ players | Leaderboard with medals |
| no scores | direct URL access | Redirects to / |

## Interactions

- [x] Click "Nouvelle partie" → resets game, navigates to /
- [x] Direct /end access without scores → redirects to /
