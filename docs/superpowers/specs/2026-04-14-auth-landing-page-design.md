# Auth obligatoire & Landing Page — Design

> Version: 1.0 — 14 avril 2026

## Objectif

Bloquer l'accès au jeu derrière une connexion Clerk. Créer une landing page publique qui présente le jeu, montre un aperçu des packs, affiche les modes de jeu avec un modal de règles détaillées, et pousse l'utilisateur à se connecter.

---

## Routing

| Route | Composant | Auth | Description |
|-------|-----------|------|-------------|
| `/` | LandingPage | Publique | Intro, aperçu packs, modes, règles, CTA connexion |
| `/play` | HomeScreen | Requise | Sélection pack → joueurs → mode (existant) |
| `/game` | GameScreen | Requise | Écran de jeu (existant) |
| `/end` | EndScreen | Requise | Résultats (existant) |

**Redirect** : Si non connecté et accès à `/play`, `/game`, `/end` → redirect vers `/`.

**Après connexion** : Clerk redirige vers `/play` (`afterSignInUrl="/play"`).

---

## AuthGuard

Composant wrapper pour les routes protégées :

```tsx
function AuthGuard({ children }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return <LoadingSpinner />;
  if (!isSignedIn) return <Navigate to="/" />;
  return children;
}
```

Wraps : `/play`, `/game`, `/end`.

---

## Landing Page — Structure

4 zones verticales :

### Header
- Nom du jeu à gauche (stylisé, glow néon)
- Boutons "Connexion" / "Inscription" à droite (modaux Clerk)
- Si connecté : UserButton Clerk + bouton "Jouer →" vers `/play`
- Design festif, distinct du header in-game

### Hero
- Titre accrocheur avec gradient animé et text-glow
- Sous-titre fun (1-2 phrases, ton soirée)
- Bouton CTA "Jouer" :
  - Non connecté → ouvre le modal Clerk sign-in
  - Connecté → navigate vers `/play`

### Aperçu des packs
- 3-4 cartes de packs (premiers de la DB via `usePacks()`)
- Même style visuel que le HomeScreen (icon, gradient, nom, description courte)
- Non cliquables (vitrine uniquement)
- Texte en dessous : "Et bien d'autres..." ou équivalent fun
- Quelques exemples de questions marrantes affichées en vrac pour donner le ton

### Modes de jeu
- 3 cartes (Classique, Voleur, Chrono) avec icon, nom, description courte (1 ligne)
- Bouton "Voir les règles" → ouvre le modal

---

## Modal des règles

`Dialog` shadcn avec `Tabs` (3 onglets).

### Tab "Classique"
- Tour par tour, chaque joueur répond à sa question
- Combo : enchaîne les bonnes réponses pour multiplier tes points (jusqu'à x5)
- Mode aveugle : réponds sans voir les choix pour doubler les points

### Tab "Voleur"
- Un joueur répond, les autres peuvent voler sa réponse
- Vol réussi : tu gagnes 0.5 pt, il perd 0.5 pt
- Vol raté : tu perds 1 pt — risqué !

### Tab "Chrono"
- 15 secondes par question, pas le droit de traîner
- Bonne réponse dans le temps : +1 pt + combo
- Timeout : -0.5 pt

Format : 3-4 bullet points courts par tab, ton décontracté.

---

## Interaction non connecté

Quand un utilisateur non connecté clique sur "Jouer" ou tente d'interagir avec un pack → le modal Clerk sign-in/sign-up s'ouvre directement. Pas de redirect, pas de toast — modal inline.

---

## Fichiers

### Nouveaux
| Fichier | Rôle |
|---------|------|
| `src/components/LandingPage.tsx` | Page complète : header, hero, aperçu packs, modes, modal règles |
| `src/components/AuthGuard.tsx` | Wrapper redirect si non connecté |

### Modifiés
| Fichier | Changement |
|---------|------------|
| `src/App.tsx` | Nouveau routing : `/` = LandingPage, `/play`+`/game`+`/end` wrappés dans AuthGuard. AuthHeader affiché uniquement sur les routes protégées. |
| `src/index.tsx` | `afterSignInUrl="/play"` sur ClerkProvider |

### Réutilisés (pas de changement)
| Fichier | Usage |
|---------|-------|
| `src/hooks/usePacks.ts` | Charger l'aperçu des packs sur la landing |

Pas de nouveau store — la landing est stateless.

---

## Hors scope

- Multi-appareil / WebSocket (Phase 2 — spec séparée)
- Mode alcool
- Marketplace
- Refonte complète du thème (déjà fait en Phase 1)
