# Landing Page

**URL:** /
**Last explored:** 2026-04-14

## Layout

Public landing page with fixed header, hero section, pack preview grid, game modes grid, and rules modal.

## Zones

### Header

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Brand logo | img | — | PartyPopper icon |
| Brand name | generic | "Quiz Party" | Glow purple text |
| Mute toggle | button | "Couper le son" | Volume icon toggles |
| Connexion | button | "Connexion" | Clerk modal sign-in |
| Inscription | button | "Inscription" | Clerk modal sign-up |

### Hero

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Title | heading h1 | "Quiz Party" | Animated shimmer gradient |
| Subtitle | paragraph | "Le quiz qui pimente tes soirées..." | — |
| CTA | button | "Jouer maintenant" | Opens Clerk sign-in if not logged in |

### Pack Preview

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Pack cards | generic | "{icon} {name} {count} questions" | 2-4 packs from Strapi API |
| More text | paragraph | "Et bien d'autres packs à découvrir..." | — |

### Game Modes

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Classique card | generic | "🎯 Classique" | Description: tour par tour |
| Voleur card | generic | "🦹 Voleur" | Description: vol de réponse |
| Chrono card | generic | "⏱️ Contre la montre" | Description: 15s timer |
| Rules button | button | "Voir les règles détaillées" | Opens modal |

### Rules Modal

| Element | Role | Text/Label | Notes |
|---------|------|-----------|-------|
| Title | heading h2 | "Règles du jeu" | — |
| Tab Classique | tab | "🎯 Classique" | Active by default |
| Tab Voleur | tab | "🦹 Voleur" | — |
| Tab Chrono | tab | "⏱️ Chrono" | — |
| Tab content | tabpanel | Bullets per mode | 3 bullet points each |
| Close | button | "Close" | X icon |

## States

| State | Trigger | Key changes |
|-------|---------|-------------|
| default | page load | Packs loading from API |
| packs loaded | API response | Pack preview cards visible |
| rules open | click "Voir les règles" | Dialog modal visible with tabs |
| signed in | Clerk sign-in | CTA changes to navigate to /play, header shows UserButton |

## Interactions

- [x] Click "Voir les règles détaillées" → modal opens with 3 tabs
- [x] Click tab "Voleur" → voleur rules visible
- [x] Click tab "Chrono" → chrono rules visible
- [x] Click "Close" on modal → modal closes
- [ ] Click "Jouer maintenant" (not signed in) → Clerk sign-in modal
- [ ] Click "Connexion" → Clerk sign-in modal
- [ ] Click "Jouer maintenant" (signed in) → navigate to /play
