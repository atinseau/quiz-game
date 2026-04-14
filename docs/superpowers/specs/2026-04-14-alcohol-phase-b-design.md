# Mode Alcool Phase B — Manches Interactives — Design

> Version: 1.0 — 14 avril 2026

## Objectif

Ajouter les 5 manches interactives restantes au mode alcool. Utilise le framework plugin existant (Phase A). Chaque manche = 1 fichier serveur (`rounds/`) + 1 fichier client (`rounds/`) + enregistrement dans les registries.

---

## Manches

### 1. Conseil du village 🗳️

**Flow :**
1. `special_round_start` → tous les joueurs voient l'overlay
2. Chaque joueur vote pour un autre joueur (pas lui-même)
3. 1 appareil : passage du téléphone, vote masqué. Multi : vote simultané
4. Timeout 30s
5. Le joueur élu boit. Affichage des votes.
6. Égalité → les ex-æquo boivent tous

**Messages WS :**
- Client → Serveur : `{ type: "conseil_vote"; targetClerkId: string }`
- Serveur → Client : `{ type: "conseil_result"; votes: Record<string, string>; loserClerkId: string }`

### 2. Love or Drink 💋

**Flow :**
1. Les 2 joueurs avec le moins de points sont sélectionnés
2. Ils choisissent : bisou ou cul sec
3. Un seul bouton suffit (l'un des deux clique)
4. `drink_alert` si cul sec

**Messages WS :**
- Client → Serveur : `{ type: "love_or_drink_choice"; choice: "bisou" | "cul_sec" }`

### 3. Cupidon 💘

**Flow :**
1. 2 joueurs choisis au hasard sont liés
2. Badge "lié 💘" visible sur le scoreboard
3. Pour le reste de la partie, quand l'un boit → l'autre aussi
4. Cumul possible (Cupidon tiré plusieurs fois)

**État persistant :**
```ts
// Ajouté à AlcoholState
cupidLinks: [string, string][]; // paires de clerkIds liés
```

**Impact sur les autres manches :** Quand un `drink_alert` est envoyé à un joueur lié, dupliquer l'alerte pour son partenaire.

### 4. Show Us 👀

**Flow :**
1. Un joueur choisi au hasard
2. Les autres votent pour la couleur de son sous-vêtement (Bleu, Noir, Blanc, Rouge, Autre)
3. Timer 15s
4. Le joueur choisi révèle la couleur (sélectionne dans l'app)
5. Ceux qui se sont trompés boivent
6. 1 appareil : le joueur choisi ne regarde pas pendant le vote, puis révèle
7. Multi : le joueur choisi voit un écran d'attente, les autres votent

**Messages WS :**
- Client → Serveur : `{ type: "show_us_vote"; color: string }`
- Client → Serveur : `{ type: "show_us_reveal"; color: string }`
- Serveur → Client : `{ type: "show_us_result"; correctColor: string; wrong: string[] }`

### 5. Smatch or Pass 💥

**Flow :**
1. 2 joueurs de sexe opposé choisis au hasard
2. Le "décideur" choisit : Smatch 💋 ou Pass 👋
3. Résultat visible par tous
4. Fallback : si pas de joueurs de sexes opposés → skip, piocher la manche suivante

**Messages WS :**
- Client → Serveur : `{ type: "smatch_choice"; choice: "smatch" | "pass" }`

---

## Fichiers

### Nouveaux (serveur)

```
src/server/alcohol/rounds/conseil.ts
src/server/alcohol/rounds/love-or-drink.ts
src/server/alcohol/rounds/cupidon.ts
src/server/alcohol/rounds/show-us.ts
src/server/alcohol/rounds/smatch-or-pass.ts
```

### Nouveaux (client)

```
src/components/alcohol/rounds/Conseil.tsx
src/components/alcohol/rounds/LoveOrDrink.tsx
src/components/alcohol/rounds/Cupidon.tsx
src/components/alcohol/rounds/ShowUs.tsx
src/components/alcohol/rounds/SmatchOrPass.tsx
```

### Modifiés

```
src/server/alcohol/rounds/index.ts      — ajouter les 5 dans le registry
src/server/alcohol/types.ts             — ajouter cupidLinks à AlcoholState, nouveaux messages WS
src/server/types.ts                     — ajouter les nouveaux messages client/serveur
src/components/alcohol/rounds/index.ts  — ajouter les 5 dans le registry client
src/components/alcohol/AlcoholConfig.tsx — retirer les "Bientôt" badges des 5 manches
src/stores/alcoholStore.ts              — ajouter cupidLinks, logique de propagation Cupidon
```

### Impact Cupidon sur le framework

Dans `framework.ts`, quand un `drink_alert` est émis, vérifier si le joueur ciblé est lié par Cupidon. Si oui, émettre un `drink_alert` supplémentaire pour le partenaire.

```ts
export function broadcastDrinkAlert(room: Room, targetClerkId: string, emoji: string, message: string) {
  broadcast(room, { type: "drink_alert", targetClerkId, emoji, message });
  
  // Cupidon propagation
  const links = room.game?.alcoholState?.cupidLinks ?? [];
  for (const [a, b] of links) {
    if (a === targetClerkId || b === targetClerkId) {
      const partner = a === targetClerkId ? b : a;
      const partnerName = room.players.get(partner)?.username ?? "?";
      broadcast(room, {
        type: "drink_alert",
        targetClerkId: partner,
        emoji: "💘",
        message: `${partnerName} est lié — boit aussi !`,
      });
    }
  }
}
```

Remplacer tous les `broadcast(room, { type: "drink_alert", ... })` dans les rounds existants par `broadcastDrinkAlert(...)`.
