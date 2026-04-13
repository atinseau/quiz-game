# Home

**URL:** /
**Last explored:** 2026-04-13

## Layout

Three-step wizard: pack selection → player setup → game mode selection. Single-page view, steps controlled by internal state (no URL change).

## Zones

### Step 1 — Pack Selection

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Title | heading h1 | "Quiz Party" | Gradient animated text with PartyPopper icons |
| Subtitle | paragraph | "Choisis ton pack de questions" | |
| Search input | textbox | "Rechercher un pack..." | Filters packs by name/description, resets page to 0 |
| Pack cards | button (each) | "{icon} {name} {description} {questionCount}" | Grid layout 1/2/3 cols. Click selects pack AND goes to step 2 |
| Pagination prev | button icon | ChevronLeft | Disabled on first page |
| Pagination next | button icon | ChevronRight | Disabled on last page |
| Page buttons | button | "1", "2", ... | Current page highlighted |
| Auth buttons | button | "Connexion" / "Inscription" | Fixed top-right, Clerk modals |

### Step 2 — Player Setup

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Back button | button | "Changer de pack" | Returns to step 1 |
| Pack summary | generic | "{icon} {name} {description}" | Gradient card showing selected pack |
| Section title | heading | "Qui joue ?" | With UserPlus icon |
| Player input | textbox | "Nom du joueur" | maxLength=20, Enter to add |
| Add button | button | "Ajouter" | Adds player from input |
| Player badges | badge (each) | "{name}" | Each has X button to remove |
| Empty message | paragraph | "Ajoute au moins un joueur pour commencer" | Shown when no players |
| Continue button | button | "Choisir le mode de jeu" | Disabled when 0 players |

### Step 3 — Game Mode Selection

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Back button | button | "Retour aux joueurs" | Returns to step 2 |
| Pack summary | generic | "{icon} {name}" | Compact gradient card |
| Player summary | paragraph | "N joueur(s) : names" | |
| Section title | heading h2 | "Choisis un mode de jeu" | With Gamepad2 icon |
| Classic mode | button | "🎯 Classique..." | Always visible. Starts game immediately on click |
| Voleur mode | button | "🦹 Voleur..." | Only visible with 2+ players |
| Chrono mode | button | "⏱️ Contre la montre..." | Always visible |

## States

| State | Trigger | Key changes |
|-------|---------|-------------|
| step=pack | page load (default) | Pack grid visible, search bar |
| step=players | click a pack card | Player input, badges, pack summary |
| step=mode | click "Choisir le mode de jeu" | Mode cards, player summary |
| 0 players | no players added | Continue button disabled, empty message |
| 1+ players | add player | Continue button enabled, badges shown |
| Voleur hidden | 1 player only | Voleur mode card not rendered |

## Interactions

- [x] Search packs → filters cards by name/description
- [x] Click pack card → selects pack, moves to step 2
- [x] Type player name + Enter → adds player badge
- [x] Click Ajouter → adds player badge
- [x] Click X on badge → removes player
- [x] Click "Changer de pack" → back to step 1
- [x] Click "Retour aux joueurs" → back to step 2
- [x] Click game mode → starts game, navigates to /game
- [ ] Pagination next/prev → changes pack page
- [ ] Click Connexion → opens Clerk sign-in modal
- [ ] Click Inscription → opens Clerk sign-up modal
