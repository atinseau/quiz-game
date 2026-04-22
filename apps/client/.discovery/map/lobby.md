# Lobby

**URL:** /play/lobby/{code}
**Last explored:** 2026-04-20

## Layout

Room setup screen. Displays the 6-character room code, player list, pack + mode pickers, alcohol (Mode Soirée) config, and a "Lancer la partie" button. Host sees the config buttons; non-host sees a read-only summary.

## Zones

### Header

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Quitter la partie | button | X icon | Returns to /play |
| Couper le son | button | Volume icon | Mute toggle |

### Room Code

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Label | paragraph | "Code de la room" | |
| Code | generic | "{CODE}" | 6 uppercase alphanumeric characters |
| Copy | button | Copy icon | Copies code to clipboard |

### Players List

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Count | generic | "Joueurs (N/M)" | N = current, M = required (2) |
| Own avatar | img | — | Avatar image |
| Own name | text | "{username}" | With "Modifier ton nom" edit button |
| Edit name | button | "Modifier ton nom" | Opens name edit UI |
| Gender | button x2 | "♂ Homme" / "♀ Femme" | Toggleable gender selection |
| Host badge | generic | "Host" | Shown for the host only |
| Other player row | generic | avatar + name + gender | Read-only badge view for other players |

### Pack Picker (host only)

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Title | generic | "Choisis un pack" | |
| Pack buttons | button (each) | "{icon} {name}" | Active state marks selected pack |

### Mode Picker (host only)

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Title | generic | "Choisis un mode" | |
| Classique | button | "🎯 Classique" | |
| Voleur | button | "🦹 Voleur" | |
| Contre la montre | button | "⏱️ Contre la montre" | |

### Mode Soirée (Alcohol) (host only)

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Section label | generic | "Mode Soirée" | |
| Toggle | button | "Désactivé" / "Activé 🍻" | Activates config section |
| Frequency label | paragraph | "Manche spéciale tous les {N} tours" | |
| Frequency buttons | button x8 | "3" – "10" | Selectable frequency |
| Rounds label | paragraph | "Manches actives" | |
| Round toggles | button (each) | "{icon} {name} {✓}" | Petit buveur, Distributeur, Question de courage, Conseil du village, Love or Drink, Cupidon, Show Us, Smatch or Pass |
| Cul sec toggle | button | "🍻 Le perdant boit cul sec ✓" | Persisted across sessions |

### Non-host Summary

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Message | paragraph | "Le host a choisi -- en attente du lancement..." | Visible when host has configured |
| Pack | paragraph | "Pack : {name}" | Bold value |
| Mode | paragraph | "Mode : {mode}" | Bold value |

### Actions

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Lancer la partie | button | "Lancer la partie" | Host only; disabled with "Il faut au moins 2 joueurs" when only 1 player |
| Message | paragraph | "Il faut au moins 2 joueurs" | Visible when fewer than 2 players |
| Quitter la room | button | "Quitter la room" | Bottom of lobby, returns to /play |

## States

| State | Trigger | Key changes |
|-------|---------|-------------|
| lobby-solo | Only host in room | "Joueurs (1/1)", start disabled with warning |
| lobby-full | Guest joined | "Joueurs (2/2)", start enabled |
| pack-selected | Host clicks a pack | Pack button shows `active` state, guest summary updates |
| mode-selected | Host clicks a mode | Mode button shows `active` state, guest summary updates |
| alcohol-on | Host toggles Mode Soirée | Config section expands; toggle shows "Activé 🍻" |
| starting | Host clicks Lancer la partie | Both devices navigate to /game |

## Interactions

- [x] Host creates room → URL contains 6-char code, lobby visible
- [x] Guest joins via /play/join → guest and host both show "Joueurs (2/2)"
- [x] Host clicks pack → active state persists, guest sees "Pack: {name}"
- [x] Host clicks mode → active state persists, guest sees "Mode: {name}"
- [x] Host toggles Mode Soirée → config expands with frequency + rounds + Cul sec
- [x] Host clicks Lancer la partie → both tabs navigate to /game
- [ ] Click Copy on room code → clipboard populated (not verified in snapshot)
- [ ] Click "Modifier ton nom" → name edit UI (not snapshotted)
- [ ] Click gender toggle → gender persists on server (not verified here)
- [ ] Click "Quitter la room" → returns to /play (not clicked in this session)
