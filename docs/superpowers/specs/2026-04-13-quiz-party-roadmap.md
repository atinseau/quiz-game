# Quiz Party - Spec & Roadmap

> Version: 1.2 - 13 avril 2026
> Statut: Draft - Reviewed & corrigé

---

## Table des matières

1. [Etat des lieux](#1-etat-des-lieux)
2. [Phase 1 - Fondations](#2-phase-1---fondations)
3. [Phase 2 - Multi-appareil (WebSocket)](#3-phase-2---multi-appareil-websocket)
4. [Phase 3 - Mode Alcool](#4-phase-3---mode-alcool)
5. [Phase 4 - Marketplace & Stripe](#5-phase-4---marketplace--stripe)
6. [Phase 5 - Analyse post-partie](#6-phase-5---analyse-post-partie)
7. [Phase 6 - Progression & XP (standby)](#7-phase-6---progression--xp-standby)
8. [Annexes](#8-annexes)

---

## 1. Etat des lieux

### Architecture actuelle

| Composant | Techno | Rôle |
|-----------|--------|------|
| **Client** | React 19, Zustand, Tailwind 4, shadcn/ui | SPA avec toute la logique de jeu |
| **Backend** | Strapi v5, SQLite (dev), Clerk auth | API minimale (sync joueur uniquement) |
| **Serveur statique** | Bun.serve() | Sert le client + les packs JSON |

### Ce qui existe

- 3 modes de jeu : Classique, Voleur, Contre la montre
- Multijoueur local (1 appareil, passage de téléphone)
- 14 packs de questions (~500-1500 questions chacun)
- Système de combo (x1 à x5)
- Mode aveugle (QCM sans choix, x2 pts)
- Matching flou (Levenshtein) pour les réponses texte
- Auth Clerk (sign in/sign up)
- Sons : win, fail, steal
- Persistence localStorage (reprise de partie, packs terminés)
- Tests E2E Playwright complets

### Ce qui n'existe pas encore

- WebSocket / temps réel
- Rooms multi-appareils
- Genre (homme/femme)
- Système XP / niveaux
- Mode alcool
- Marketplace / paiements
- Analytics de vitesse
- Mode muet
- Design "soirée" (thème actuel = sobre/dark)

---

## 2. Phase 1 - Fondations

> **Objectif** : Poser les bases nécessaires aux phases suivantes. Pas de nouvelles features visibles côté utilisateur, sauf le thème et le mode muet.

### 2.1 Refonte du thème "Soirée"

**Problème** : L'interface actuelle est clean mais pas assez festive. Pour un jeu de soirée, il faut du fun visuel.

**Direction artistique** :
- Palette néon sur fond sombre (garder le dark mode mais plus vibrant)
- Dégradés plus colorés, effets glow plus prononcés
- Animations de particules/confettis sur les événements (bonne réponse, vol réussi, fin de partie)
- Typographie plus expressive (titres avec gradient animé, tailles plus grosses)
- Icônes et illustrations plus ludiques (emojis animés, illustrations custom)
- Transitions et micro-animations sur les interactions (boutons, cartes, scores)
- Écran d'accueil avec ambiance "soirée" (lumières, couleurs chaudes)

**Travail technique** :
- Mise à jour des CSS variables dans `index.css`
- Nouvelles animations keyframes (confettis, shake, bounce, glow pulse)
- Bibliothèque de confettis (canvas-confetti ou framer-motion)
- Refonte des composants : cards de mode, cards de pack, scoreboard, end screen
- Responsive : les animations doivent rester performantes sur mobile

### 2.2 Mode muet

**Implémentation** : Toggle global dans le header (icône speaker/mute)

**Stockage** : `localStorage` clé `quiz-muted` (booléen)

**Changements** :
- Nouveau store `settingsStore.ts` (Zustand) avec `muted: boolean` + `toggleMute()`
- Modifier `sounds.ts` : vérifier `settingsStore.getState().muted` avant chaque `play()`
- Icône dans le header : `Volume2` / `VolumeX` (Lucide)
- Persister dans localStorage, restaurer au chargement

### 2.3 Saisie du nom + genre

**Contexte** : Aujourd'hui les joueurs saisissent juste un nom. Il faut ajouter le genre (homme/femme) car :
- Le mode alcool a des manches genrées ("smatch or pass" avec sexe opposé)
- Ça permettra des messages genrés dans l'interface

**Changements data model** :
```typescript
// playerStore.ts
type Gender = "homme" | "femme";

interface Player {
  name: string;
  gender: Gender;
}

// Avant: players: string[]
// Après: players: Player[]
```

**Changements UI** :
- Step 2 du HomeScreen : champ nom + sélecteur de genre (2 boutons toggle homme/femme)
- Les badges joueurs affichent une icône genre subtile
- **Impact** : Tous les endroits qui référencent `players` comme `string[]` doivent migrer vers `Player[]`

### 2.4 Mise en avant des packs terminés

**Problème** : `finishedChunks` existe dans `packStore` mais n'est pas assez visible.

**Améliorations UI** :
- Badge "Terminé" sur les cartes de packs finis (avec checkmark)
- Compteur en haut du sélecteur : "X/14 packs terminés"
- Filtre : "Voir uniquement les packs non terminés"
- Animation de complétion quand un pack est terminé pour la première fois

**Logique multi-appareil** (préparation Phase 2) :
- 1 appareil : le pack est terminé pour le joueur connecté (Clerk user)
- Multi-appareil : le pack est terminé pour tous les joueurs de la room

### 2.5 Modélisation de la base de données Strapi

Toute la gestion des packs, catégories et questions passe dans Strapi. Les fichiers JSON statiques (`public/questions/`) sont remplacés par l'API Strapi. L'admin Strapi devient la source de vérité.

#### Schéma relationnel

```
                               ┌──────────────────────┐
                               │      Category        │
                               ├──────────────────────┤
                               │ name (unique)        │
                               │ slug (unique)        │
                               └──────┬────┬──────────┘
                                      │    │
                          questions 1:n│    │ m:n packs
                                      │    │
┌─────────────────────┐    ┌──────────▼──  │  ─────────┐
│       Player        │    │      Question │          │
├─────────────────────┤    ├──────────────────────────┤
│ clerkId (unique)    │    │ type (qcm/vf/texte)     │
│ email (unique)      │    │ text                     │
│ username            │    │ choices (json, null)     │
│ gender (h/f)        │    │ answer (string)          │
│ completedPacks →    │    │ category → Category  m:1 │
│   relation [Pack]   │    │ pack → QuestionPack  m:1 │◄── une question = un seul pack
└─────────────────────┘    └──────────────────────────┘
         │                              ▲
         │ m:n              ┌───────────┘ 1:n
         │                  │
         ▼           ┌──────┴──────────────┐
┌─────────────────┐  │    QuestionPack     │
│    Purchase     │  ├─────────────────────┤
├─────────────────┤  │ slug (unique)       │
│ player → Player │  │ name                │
│ pack → Pack     │  │ description         │
│ stripeSessionId │  │ icon (emoji)        │
│ amount          │  │ gradient (tailwind) │
│ status          │  │ isFree (bool)       │
└─────────────────┘  │ stripePriceId (?)   │
                     │ published (bool)    │
┌─────────────────┐  │ displayOrder (int)  │
│  GameSession    │  │ categories ←→       │ m:n (table de liaison)
├─────────────────┤  │   Category[]        │
│ roomCode        │  └─────────────────────┘
│ mode (enum)     │
│ pack → Pack m:1 │
│ isMultiDevice   │
│ status (enum)   │
│ players → []    │
│ scores (json)   │
└────────┬────────┘
         │ 1:n
┌────────▼────────┐
│   GameAnswer    │
├─────────────────┤
│ session → m:1   │
│ player → m:1    │
│ question → m:1  │
│ answer (string) │
│ correct (bool)  │
│ responseTimeMs  │
└─────────────────┘
```

**Relations clés** :
- `Category ←→ QuestionPack` : **many-to-many** — la catégorie "Histoire" peut être dans plusieurs packs
- `Question → Category` : **many-to-one** — une question appartient à une seule catégorie
- `Question → QuestionPack` : **many-to-one** — une question appartient à un seul pack (pas de réutilisation)
- `Player ←→ QuestionPack (completedPacks)` : **many-to-many** — packs terminés par le joueur (gameplay, pas achat)

#### Content-types détaillés

```
Category
├── name: string (required) — ex: "Histoire", "Sciences"
├── slug: string (unique, required) — ex: "histoire", "sciences"
├── packs: relation (many-to-many → QuestionPack) — une catégorie peut être dans plusieurs packs
├── questions: relation (one-to-many → Question)
└── createdAt / updatedAt (auto)

QuestionPack
├── slug: string (unique, required) — ex: "generaliste-1"
├── name: string (required) — ex: "Généraliste I"
├── description: text — ex: "Histoire, Sciences, Sport..."
├── icon: string — ex: "🧠"
├── gradient: string — ex: "from-indigo-600 to-purple-700"
├── isFree: boolean (default: true)
├── stripePriceId: string (nullable) — rempli uniquement pour les packs payants
├── published: boolean (default: true) — visible dans l'app
├── displayOrder: integer (default: 0) — tri dans la liste
├── categories: relation (many-to-many → Category) — catégories du pack
├── questions: relation (one-to-many → Question) — questions du pack
└── createdAt / updatedAt (auto)

Question
├── type: enumeration ["qcm", "vrai_faux", "texte"] (required)
├── text: text (required) — le texte de la question
├── choices: json (nullable) — ["choix1", "choix2", "choix3", "choix4"] pour qcm, null sinon
├── answer: string (required) — "réponse" pour qcm/texte, "true"/"false" pour vrai_faux
├── category: relation (many-to-one → Category, required) — sa catégorie thématique
├── pack: relation (many-to-one → QuestionPack, required) — son pack (1 seul, pas réutilisable)
├── displayOrder: integer (default: 0)
└── createdAt / updatedAt (auto)

Player (mise à jour)
├── clerkId: string (unique, required)
├── email: email (unique, required)
├── username: string (required)
├── gender: enumeration ["homme", "femme"] (required)       ← NOUVEAU
├── completedPacks: relation (many-to-many → QuestionPack)  ← NOUVEAU (packs terminés en jeu)
└── createdAt / updatedAt (auto)

Note : les packs **achetés** sont déduits via la table Purchase (pas de champ sur Player).
Les packs **terminés** (gameplay) sont dans `completedPacks`.

Purchase
├── player: relation (many-to-one → Player, required)
├── pack: relation (many-to-one → QuestionPack, required)
├── stripeSessionId: string (required)
├── stripePaymentIntentId: string (required)
├── amount: integer (centimes)
├── status: enumeration ["pending", "completed", "refunded"]
└── createdAt (auto)

GameSession
├── roomCode: string (unique, nullable)
├── mode: enumeration ["classic", "voleur", "chrono"] (required)
├── pack: relation (many-to-one → QuestionPack, required)
├── isMultiDevice: boolean (default: false)
├── status: enumeration ["lobby", "playing", "finished"]
├── players: relation (many-to-many → Player)
├── scores: json — { "playerId": score }
├── startedAt: datetime
├── finishedAt: datetime (nullable)
└── createdAt / updatedAt (auto)

GameAnswer
├── session: relation (many-to-one → GameSession, required)
├── player: relation (many-to-one → Player, required)
├── question: relation (many-to-one → Question, required)
├── answer: string
├── correct: boolean
├── responseTimeMs: integer
└── createdAt (auto)
```

#### Import JSON générique

Un seul format gère toutes les combinaisons d'import (nouveau pack, pack existant, nouvelle catégorie, catégorie existante). Le système détecte automatiquement ce qui existe et ce qui doit être créé.

**Format JSON** :

```json
{
  "pack": {
    "slug": "generaliste-1",
    "name": "Généraliste I",
    "description": "Histoire, Sciences, Sport...",
    "icon": "🧠",
    "gradient": "from-indigo-600 to-purple-700"
  },
  "questions": [
    {
      "category": "Histoire",
      "type": "qcm",
      "question": "En quelle année a eu lieu la prise de la Bastille ?",
      "choices": ["1789", "1792", "1776", "1804"],
      "answer": "1789"
    },
    {
      "category": "Histoire",
      "type": "vrai_faux",
      "question": "Napoléon est mort à Sainte-Hélène.",
      "answer": "true"
    },
    {
      "category": "Sciences",
      "type": "texte",
      "question": "Quel est le symbole chimique de l'or ?",
      "answer": "Au"
    }
  ]
}
```

**Champ `pack`** :
- `slug` (requis) — identifiant unique du pack, sert de clé de matching
- `name`, `description`, `icon`, `gradient` — requis si le pack n'existe pas encore, ignorés si le pack existe déjà (les metadata se modifient depuis l'admin Strapi directement)

**Champ `questions[]`** :
- `category` (string, requis) — nom de la catégorie. Si elle existe → réutilisée et liée au pack. Si elle n'existe pas → créée et liée au pack.
- `type` (requis) — `"qcm"`, `"vrai_faux"`, ou `"texte"`
- `question` (requis) — texte de la question
- `choices` (requis si type=qcm, null sinon) — tableau de 4 choix
- `answer` (requis) — réponse correcte (string pour qcm/texte, `"true"`/`"false"` pour vrai_faux)

**Combinaisons supportées** :

| Pack | Catégorie | Résultat |
|------|-----------|----------|
| slug nouveau | catégorie nouvelle | Pack créé + catégorie créée + questions créées |
| slug nouveau | catégorie existante | Pack créé + catégorie liée au pack + questions créées |
| slug existant | catégorie nouvelle | Catégorie créée + liée au pack + questions créées |
| slug existant | catégorie existante | Questions ajoutées au pack dans la catégorie existante |

**Validation (avant import)** :
1. `pack.slug` présent et non vide
2. Si pack n'existe pas → `name` requis
3. Chaque question a `category`, `type`, `question`, `answer`
4. Si `type=qcm` → `choices` est un tableau de 4 strings
5. Si `type=vrai_faux` → `answer` est `"true"` ou `"false"`
6. Pas de question en doublon (même `question` texte dans le même pack)

**Logique d'import** :
1. Valider le JSON entier. Si erreur → retourner les erreurs, rien n'est importé (transactionnel)
2. `QuestionPack` : chercher par `slug`. Si absent → créer avec les metadata fournies (+ `isFree: true` par défaut)
3. Pour chaque `category` unique dans les questions :
   - Chercher par `name`. Si absente → créer avec slug auto-généré
   - Lier la catégorie au pack (relation m:n) si pas déjà liée
4. Pour chaque question → créer la `Question` liée à la catégorie + au pack
5. Retourner un résumé

**Réponse** :
```json
{
  "success": true,
  "summary": {
    "pack": { "slug": "generaliste-1", "status": "existing" },
    "categories": [
      { "name": "Histoire", "status": "existing", "linked": true },
      { "name": "Astronomie", "status": "created", "linked": true }
    ],
    "questions": { "created": 15, "total": 15 }
  }
}
```

**Mécanismes d'import** :

1. **Page custom admin Strapi** : Section "Importer des questions" dans l'admin Strapi avec un textarea pour coller le JSON + bouton "Valider" (dry-run avec résumé) + bouton "Importer" (exécution réelle)

2. **Endpoint API** : `POST /api/packs/import` — auth admin uniquement (token admin Strapi). Même format, même logique. Utilisé par la page admin et par le script de seed.

3. **Script de seed** : `bun run seed` — lit les 14 fichiers JSON existants (`public/questions/`), les transforme au format d'import, et appelle l'endpoint pour chaque pack. Les 14 packs sont marqués `isFree: true`.

#### Migration des données existantes

Les 14 packs actuels (fichiers `public/questions/questions-N.json` + `packs.json`) sont importés dans Strapi via le script de seed. Après migration :
- Les fichiers JSON statiques ne sont plus servis par le client Bun
- Le client fetch les packs/questions via l'API Strapi
- L'admin Strapi permet d'ajouter/modifier/supprimer des questions directement

---

## 3. Phase 2 - Multi-appareil (WebSocket)

> **Objectif** : Permettre à chaque joueur de jouer sur son propre téléphone, synchronisé en temps réel. Connexion obligatoire pour accéder au jeu.

### 3.0 Auth obligatoire & Landing Page

**Règle** : Connexion Clerk obligatoire pour accéder au jeu, quel que soit le mode (1 appareil ou multi-appareil).

**Landing page** (route `/`, non authentifié) :
- Branding du jeu (nom, logo, ambiance soirée)
- Intro fun et courte : 2-3 phrases qui donnent envie
- Présentation des modes de jeu en cartes visuelles (Classique, Voleur, Chrono) avec description courte (1 ligne chacun)
- Bouton "Voir les règles" → ouvre un modal avec les règles détaillées de chaque mode :
  - Classique : tour par tour, combo, scoring
  - Voleur : vol de points, pénalités
  - Chrono : timer 15s, timeout -0.5pt
  - Mode alcool (teaser / bientôt)
- Bouton "Se connecter" → Clerk sign-in/sign-up
- Design festif (confettis, glow, animations) cohérent avec le thème soirée

**Routing** :
- `/` → Landing page (non authentifié)
- `/play` → HomeScreen actuel (pack selection → players → mode) — **requiert auth**
- `/game` → GameScreen — **requiert auth**
- `/end` → EndScreen — **requiert auth**
- Si non connecté et tente d'accéder à `/play`, `/game`, `/end` → redirect vers `/`

**Composant AuthGuard** :
```tsx
// Wraps routes that require authentication
function AuthGuard({ children }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return <LoadingSpinner />;
  if (!isSignedIn) return <Navigate to="/" />;
  return children;
}
```

**Impact sur le mode multi-appareil** : Chaque joueur sur son téléphone doit être connecté avec son compte Clerk. Le `clerkId` sert d'identifiant unique dans les rooms WebSocket.

### 3.1 Architecture WebSocket

**Techno** : `Bun.serve()` avec support WebSocket natif (pas besoin de socket.io)

**Serveur WebSocket** : Intégré au serveur Bun du client (même process)

```
Client A (host) ←→ Bun WebSocket Server ←→ Client B
                                         ←→ Client C
                                         ←→ Client D
```

**Protocole** :

```typescript
// Messages Client → Serveur
type ClientMessage =
  | { type: "create_room"; player: Player }
  | { type: "join_room"; roomCode: string; player: Player }
  | { type: "start_game"; mode: GameMode; packId: string }
  | { type: "submit_answer"; answer: string | boolean; responseTimeMs: number }
  | { type: "vote"; targetPlayer: string }          // mode alcool
  | { type: "color_choice"; color: string }          // mode alcool - show us
  | { type: "smatch_or_pass"; choice: "smatch" | "pass" }  // mode alcool

// Messages Serveur → Client(s)
type ServerMessage =
  | { type: "room_created"; roomCode: string }
  | { type: "player_joined"; player: Player; players: Player[] }
  | { type: "player_left"; player: Player; players: Player[] }
  | { type: "game_started"; totalQuestions: number; mode: GameMode }
  | { type: "question"; index: number; currentPlayer: string; question: QuestionWithoutAnswer }
  | { type: "answer_result"; player: string; correct: boolean; scores: Scores }
  | { type: "steal_available"; answerer: string }    // voleur mode
  | { type: "steal_result"; stealer: string; valid: boolean; scores: Scores }
  | { type: "next_question"; index: number; currentPlayer: string }
  | { type: "game_over"; scores: Scores; rankings: Ranking[] }
  | { type: "special_round"; round: SpecialRound }   // mode alcool
  | { type: "vote_result"; target: string; votes: Record<string, string> }
  | { type: "timer_tick"; timeLeft: number }          // chrono mode
  | { type: "error"; message: string }
```

**Anti-triche** : Le serveur ne transmet **jamais** les réponses aux clients. `QuestionWithoutAnswer` = question sans le champ `answer` ni `choices` correcte marquée. La validation se fait uniquement côté serveur au `submit_answer`.

**Room codes** : 4 lettres majuscules (ex: `ABCD`), générées côté serveur, uniques parmi les rooms actives.

### 3.2 Flux utilisateur multi-appareil

Tous les joueurs sont déjà connectés (Clerk obligatoire). Le nom et le genre viennent du profil Clerk / Player backend.

```
[/play — HomeScreen, authentifié]
    │
    ├── "Créer une partie" → Room créée → Code affiché (ex: QUIZ-ABCD)
    │                                       │
    │                         Attente des joueurs (lobby)
    │                         Liste des joueurs connectés en temps réel
    │                         Bouton "Lancer la partie" (host uniquement)
    │                         Host choisit : pack + mode de jeu
    │
    └── "Rejoindre une partie" → Saisie code room → Rejoint le lobby
```

**Identité joueur** : Le serveur WS identifie chaque joueur par son `clerkId` (envoyé dans le JWT au connect). Le nom et genre sont récupérés depuis le Player backend.

### 3.3 Modes de jeu en multi-appareil

#### Classique multi-appareil
- Identique au mode 1 appareil
- Un joueur par tour, les autres regardent (inputs verrouillés)
- Chaque joueur voit la question sur son écran
- Le joueur actif voit les inputs de réponse
- Les autres voient un message "C'est au tour de {nom}"
- Après réponse : feedback visible par tous, puis "Question suivante" (host ou auto)

#### Contre la montre multi-appareil
- Identique au mode 1 appareil
- Un joueur par tour
- Timer synchronisé côté serveur (source de vérité)
- Le joueur actif a ses inputs débloqués
- Les autres regardent le timer défiler

#### Voleur multi-appareil
- **Différence majeure avec le mode 1 appareil**
- Un joueur est désigné comme "répondeur principal" (choisi par rotation)
- **Tous les joueurs (principal + voleurs) ont leurs inputs débloqués en même temps**
- Pas de bouton "vol" explicite — tout le monde répond sur son propre appareil
- Pas d'interface StealZone (celle-ci reste uniquement en mode 1 appareil où tout le monde voit le même écran)

**Déroulement d'un tour** :
1. La question s'affiche sur tous les écrans, tous les inputs sont débloqués simultanément
2. Le répondeur principal et les voleurs peuvent tous soumettre une réponse
3. **Le premier voleur qui répond correctement** vole les points → vol réussi
4. **Un voleur qui répond incorrectement** : pénalité + il boit une gorgée (1 seule tentative par voleur)
5. Si le répondeur principal répond correctement et qu'aucun voleur n'a réussi avant lui → +1 pt + combo normal
6. Si personne ne réussit à voler et que le principal a fini son tour → on passe à la question suivante

**Règles de scoring voleur multi-appareil** :
- Répondeur principal correct (pas de vol) : +1 pt + combo
- Répondeur principal incorrect : 0 pt, combo reset
- Vol réussi (premier voleur avec bonne réponse) : voleur +0.5 pt, répondeur principal -0.5 pt
- Vol raté (voleur répond faux) : voleur -1 pt + boit une gorgée (mode alcool ou non)
- **1 seule tentative par voleur par question** — après réponse, inputs verrouillés pour ce voleur

**Course au vol** : Le serveur fait foi — le premier `submit_answer` correct d'un voleur reçu par le serveur gagne le vol. Les soumissions ultérieures des autres voleurs sont ignorées si le vol est déjà résolu.

### 3.4 État du jeu côté serveur

En multi-appareil, la **source de vérité** est le serveur :
- Le serveur stocke l'état du jeu en mémoire (Map de rooms)
- Les questions sont chargées côté serveur
- La validation des réponses se fait côté serveur
- Les scores sont calculés côté serveur
- Le client est un "thin client" qui affiche l'état reçu

**En mode 1 appareil** : Rien ne change, la logique reste dans le Zustand store côté client.

### 3.5 Gestion des déconnexions

- **Joueur déconnecté** : Timeout 30s, puis retiré de la partie
- **Reconnexion** : Possible dans les 30s via le même room code + nom
- **Host déconnecté** : Le joueur suivant dans la liste devient host
- **Tous déconnectés** : Room détruite après 5 min d'inactivité

---

## 4. Phase 3 - Mode Alcool

> **Objectif** : Ajouter une couche de fun "soirée" avec des défis et des gages liés à l'alcool. Compatible 1 appareil et multi-appareil.

### 4.1 Activation et configuration

**Activation** : Toggle "Mode Soirée 🍻" sur l'écran de sélection du mode de jeu

**Configuration** (écran dédié avant le lancement) :
- **Fréquence des manches spéciales** : Slider de 3 à 10 tours (défaut : 5)
- **Manches actives** : Checkboxes pour activer/désactiver chaque type de manche spéciale
- **Cul sec en fin de partie** : Toggle on/off (le perdant boit cul sec)

### 4.2 Règle de base

- Le perdant de la partie boit cul sec (si activé)
- Toutes les N tours (configurable), une manche spéciale se déclenche
- Les manches spéciales s'alternent dans un ordre aléatoire parmi celles activées

### 4.3 Manches spéciales

#### 4.3.1 "Petit buveur" 🍺
- **Condition** : Le joueur avec le moins de points boit une gorgée
- **UI** : Écran plein avec le nom du joueur + animation de verre
- **Égalité** : Tous les joueurs à égalité au plus bas boivent

#### 4.3.2 "Conseil du village" 🗳️
- **Mécanique** : Tous les joueurs votent pour élire un "boloss"
- **UI** :
  - Écran de vote : liste des joueurs, chacun sélectionne un nom (pas le sien)
  - 1 appareil : passage du téléphone pour chaque vote (vote masqué)
  - Multi-appareil : vote simultané sur chaque écran
- **Résultat** : Le joueur élu boit. Affichage des votes avec animation
- **Égalité** : Revote entre les ex-æquo (1 seul tour de revote, sinon les deux boivent)

#### 4.3.3 "Love or Drink" 💋
- **Condition** : Les deux joueurs avec le moins de points
- **Choix** : Ils se font un bisou OU cul sec
- **UI** : Écran avec les deux noms, deux boutons "Bisou 💋" / "Cul sec 🍺"
- **1 appareil** : Le choix est fait ensemble (un seul bouton suffit)
- **Multi-appareil** : Les deux joueurs voient l'écran de choix, les autres attendent

#### 4.3.4 "Distributeur" 🎯
- **Condition** : Le joueur avec le plus de points
- **Mécanique** : Il distribue 3 gorgées au(x) joueur(s) de son choix
- **UI** :
  - Liste des autres joueurs avec compteur (0-3) à côté de chaque nom
  - Total doit faire 3
  - Peut tout donner à un seul joueur ou répartir
- **1 appareil** : Le distributeur sélectionne sur l'écran
- **Multi-appareil** : Seul le distributeur voit l'interface, les autres attendent puis voient le résultat

#### 4.3.5 "Question de courage" 🎰
- **Mécanique** :
  1. Un joueur est tiré au sort (affiché à tous)
  2. Il voit une question marquée "DIFFICILE"
  3. Il choisit : "J'accepte le défi" ou "Je passe"
  4. S'il accepte :
     - Bonne réponse → rien à boire, +2 pts bonus
     - Mauvaise réponse → cul sec
  5. S'il refuse → boit la moitié de son verre
- **UI** :
  - Écran dramatique avec le nom du joueur tiré au sort
  - Countdown 10s pour décider (accepter / refuser)
  - Si accepte : la question s'affiche, réponse normale
  - **IMPORTANT** : Tous les joueurs doivent voir ce qui se passe en temps réel
- **1 appareil** : Tout le monde regarde le même écran
- **Multi-appareil** : L'état est synchronisé sur tous les écrans

#### 4.3.6 "Cupidon" 💘
- **Mécanique** : Deux joueurs sont liés au hasard pour le reste de la partie
- **Effet** : Tout ce qui arrive à l'un arrive à l'autre (boire, bonus, malus)
- **UI** :
  - Animation de cœur reliant les deux joueurs
  - Badge "lié" visible sur le scoreboard à côté des deux noms
- **Durée** : Jusqu'à la fin de la partie
- **Cumul** : Un joueur peut être lié à plusieurs autres (si Cupidon est tiré plusieurs fois)

#### 4.3.7 "Show Us" 👀
- **Mécanique** :
  1. Un joueur est choisi au hasard
  2. Les autres joueurs doivent deviner la couleur de son sous-vêtement
  3. Couleurs disponibles : Bleu, Noir, Blanc, Rouge, Autre
  4. Timer : 15 secondes pour que tous votent
  5. Le joueur choisi révèle la couleur (la saisit dans l'app)
  6. Ceux qui se sont trompés boivent, les autres non
- **UI** :
  - Écran de vote : 5 boutons de couleur
  - Timer visible
  - Révélation : le joueur choisi sélectionne la vraie couleur
  - Résultat : liste de qui a juste / faux
- **1 appareil** : Le joueur choisi ne regarde pas pendant que les autres votent, puis révèle
- **Multi-appareil** : Le joueur choisi voit un écran d'attente, les autres votent sur leur écran

#### 4.3.8 "Smatch or Pass" 💥
- **Condition** : Deux joueurs de sexe opposé choisis au hasard
- **Rôles** : Un "décideur" et un "receveur"
- **Mécanique** :
  - Le décideur choisit : "Smatch 💋" ou "Pass 👋"
  - Smatch → bisou
  - Pass → petite gifle
- **UI** :
  - Écran avec les deux joueurs face à face — **visible par TOUS les joueurs**
  - 1 appareil : tout le monde voit le même écran, le décideur appuie
  - Multi-appareil : tous les écrans affichent la scène en temps réel, seul le décideur a les boutons actifs
  - Deux boutons pour le décideur : "Smatch 💋" / "Pass 👋"
  - Animation de résultat visible par tous (texte + animation fun)
- **Fallback** : Si pas de joueurs de sexes opposés → manche skippée, on passe à la suivante

### 4.4 Stockage de l'état alcool

```typescript
interface AlcoholState {
  enabled: boolean;
  frequency: number; // tours entre chaque manche spéciale
  enabledRounds: SpecialRoundType[];
  culSecEndGame: boolean;
  cupidLinks: [string, string][]; // paires liées par Cupidon
  turnsSinceLastSpecial: number;
  specialRoundQueue: SpecialRoundType[]; // file randomisée
}
```

Cet état fait partie du `gameStore` (mode 1 appareil) ou de l'état serveur (multi-appareil).

---

## 5. Phase 4 - Marketplace & Stripe

> **Objectif** : Monétiser via la vente de packs de questions premium.

### 5.1 Modèle économique

- **Packs par défaut** : Les 14 packs actuels restent gratuits
- **Packs premium** : Nouveaux packs créés et vendus via Stripe
- **Achat unique** : Un pack acheté est débloqué pour toujours sur le compte Clerk

### 5.2 Architecture Stripe

**Approche** : Produits génériques Stripe, gestion métier côté Strapi

Les content-types `QuestionPack` et `Purchase` sont définis en Phase 1 (section 2.5). Le champ `stripePriceId` sur `QuestionPack` fait le lien avec Stripe.

**Workflow admin pour rendre un pack payant** :
1. Créer un produit + prix dans le dashboard Stripe
2. Copier le `price_id` (ex: `price_1Abc...`)
3. Dans Strapi admin, éditer le pack → mettre `isFree: false` + coller le `stripePriceId`
4. Le pack apparaît automatiquement comme payant dans la marketplace

**Flux d'achat** :

```
[Client] → POST /api/checkout (packSlug) → [Backend Strapi]
                                                │
                                          Vérifie que le pack existe et n'est pas gratuit
                                          Vérifie que le joueur ne l'a pas déjà acheté
                                          Crée session Stripe Checkout avec le stripePriceId
                                                │
                                          [Stripe Checkout] → paiement
                                                │
                                          Webhook checkout.session.completed → [Backend Strapi]
                                                │
                                          Crée un Purchase (status: completed)
                                                │
                                          Redirect → /marketplace?success=true
```

**Avantage** : Le prix est géré 100% depuis Stripe. Strapi stocke juste le `stripePriceId` pour créer la session Checkout. Changement de prix = changement dans Stripe dashboard, pas de redéploiement.

### 5.3 UI Marketplace

**Page Marketplace** (nouvelle route `/marketplace`) :
- Grille de packs premium avec :
  - Nom, description, icône, nombre de questions
  - Prix
  - Bouton "Acheter" → Stripe Checkout (redirection)
  - Badge "Possédé" si déjà acheté
- Filtre : Gratuit / Premium / Tous
- Les packs gratuits + les packs achetés apparaissent dans le sélecteur de packs habituel

### 5.4 Endpoints API

```
GET    /api/packs              → Liste tous les packs (metadata)
GET    /api/packs/:slug        → Détail d'un pack
POST   /api/checkout           → Créer une session Stripe Checkout
POST   /api/webhooks/stripe    → Webhook Stripe (payment_intent.succeeded)
GET    /api/purchases/me       → Liste des packs achetés par le joueur
```

### 5.5 Sécurité

- Les questions sont servies uniquement via l'API Strapi (plus de fichiers JSON statiques)
- Endpoint `/api/packs/:slug/questions` vérifie que le pack est gratuit OU que le joueur l'a acheté (via table `Purchase`) avant de renvoyer les questions
- Les webhooks Stripe sont vérifiés avec la signature `stripe-signature`
- Le `stripePriceId` n'est jamais exposé côté client

---

## 6. Phase 5 - Analyse post-partie

> **Objectif** : Donner un feedback enrichi après chaque partie.

### 6.1 Analyse chrono (vitesse)

**Données collectées** par question :
- `responseTimeMs` : temps de réponse en millisecondes
- `correct` : booléen
- `questionIndex` : index de la question

**Stockage** : Content-type `GameAnswer` (cf. Phase 1)

**Analyse affichée à l'end screen** :
- Temps moyen de réponse du joueur
- Nombre de bonnes réponses / total
- **Percentile de vitesse** : "Tu es plus rapide que X% des joueurs sur cette plateforme"
  - Calculé côté backend en comparant le temps moyen du joueur vs tous les `GameAnswer` historiques
  - Endpoint : `GET /api/analytics/speed-percentile?avgMs=XXX&packId=YYY`

### 6.2 Analyse générale (tous modes)

- Taux de bonnes réponses
- Plus long combo atteint
- Catégorie la mieux réussie / la moins réussie
- Comparaison avec les autres joueurs de la partie
- Mode alcool : nombre de gorgées bues (estimé par les manches spéciales)

### 6.3 UI End Screen enrichi

L'end screen actuel (trophée solo / leaderboard multi) est enrichi avec :
- Onglets : "Classement" | "Analyse" | "Stats"
- Animations sur les stats (compteurs animés)
- Partage : bouton "Partager mes résultats" (screenshot / copie texte)

---

## 7. Phase 6 - Progression & XP (standby)

> **Statut** : En attente. Sera spécifié en détail quand les phases 1-5 seront livrées.

**Idées à conserver** :
- XP gagnée uniquement sur les packs terminés pour la première fois
- Système de niveaux avec titres (Novice → Légende)
- Profil joueur avec stats globales
- Barre de progression, animation level-up
- À décider : cosmétique uniquement ou déblocage de contenu

**Pré-requis** : Phase 2 (GameSession backend) + Phase 5 (Analytics / GameAnswer)

**Champs à ajouter au Player quand on y passera** :
- `xp: integer (default: 0)`
- `level: integer (default: 1)`

---

## 8. Annexes

### 8.1 Ordre d'implémentation recommandé

```
Phase 1 — Fondations
  ├── 1.1 Modélisation DB Strapi (QuestionPack, Category, Question, GameSession, GameAnswer)
  ├── 1.2 Script de seed : import des 14 packs JSON existants dans Strapi
  ├── 1.3 Route custom POST /api/packs/import (import JSON → DB)
  ├── 1.4 Migration client : fetch packs/questions depuis API Strapi au lieu des JSON statiques
  ├── 1.5 Saisie nom + genre (migration players: string[] → Player[])
  ├── 1.6 Mode muet (settingsStore + toggle header)
  ├── 1.7 Mise en avant packs terminés (badges, compteur, filtre)
  └── 1.8 Refonte thème soirée (palette néon, animations, confettis)

Phase 2 — Multi-appareil
  ├── 2.0 Auth obligatoire + Landing page (intro, règles, Clerk sign-in)
  ├── 2.1 Serveur WebSocket Bun (intégré au serveur client)
  ├── 2.2 Système de rooms (create/join/lobby, identité via clerkId)
  ├── 2.3 Sync état de jeu (questions, scores, timer — serveur = source de vérité)
  ├── 2.4 Mode classique multi-appareil
  ├── 2.5 Mode chrono multi-appareil
  └── 2.6 Mode voleur multi-appareil (tous les inputs débloqués, premier voleur correct gagne)

Phase 3 — Mode Alcool
  ├── 3.1 Framework manches spéciales (logique + UI overlay)
  ├── 3.2 Config écran (fréquence, toggle manches, cul sec fin de partie)
  ├── 3.3 Manches simples (Petit buveur, Distributeur)
  ├── 3.4 Manches avec vote (Conseil du village, Show Us)
  ├── 3.5 Manches interactives (Question de courage, Love or Drink, Smatch or Pass)
  ├── 3.6 Cupidon (système de liens persistants)
  └── 3.7 Cul sec fin de partie

Phase 4 — Marketplace
  ├── 4.1 Intégration Stripe (Checkout + Webhooks) côté Strapi
  ├── 4.2 Content-type Purchase + endpoints (checkout, webhook, purchases/me)
  ├── 4.3 UI Marketplace (grille packs, filtres, bouton acheter, badge "Possédé")
  └── 4.4 Sécurisation : accès questions conditionné à l'achat (packs payants)

Phase 5 — Analytics
  ├── 5.1 Collecte des GameAnswer (chaque réponse → DB via API ou WS)
  ├── 5.2 Endpoint percentile de vitesse (comparaison avec l'historique global)
  └── 5.3 End screen enrichi (onglets Classement/Analyse/Stats, partage)

Phase 6 — XP & Progression (standby)
  └── À spécifier après livraison phases 1-5
```

### 8.2 Points résolus

| # | Question | Réponse |
|---|----------|---------|
| 1 | **Voleur multi-appareil** : inputs des voleurs | Tous débloqués en même temps. Premier voleur correct gagne. Voleur faux = -1 pt + gorgée. 1 tentative par voleur. |
| 2 | **Smatch or Pass** : visibilité | Tout est visible par tous les joueurs en temps réel |
| 3 | **XP / Niveaux** : priorité | En standby (Phase 6), on y revient après les phases 1-5 |
| 4 | **Analytics** : stockage backend | Oui, le state de partie sera géré côté serveur (room state) |
| 5 | **Marketplace** : approche Stripe | Produits génériques Stripe, gestion depuis Strapi, pas de prix hardcodé côté code |
| 6 | **Création de packs** | Admin Strapi uniquement. Pas de système communautaire. |
| 7 | **Stockage questions** | Tout dans Strapi (Category ←→ QuestionPack m:n, Question → Pack m:1). Plus de JSON statiques. |
| 8 | **Import** | Format JSON générique unique, toutes combinaisons (nouveau/existant pack/catégorie). Page custom admin Strapi + endpoint API. |
| 9 | **Seed** | Script `bun run seed` importe les 14 packs existants, marqués `isFree: true`. |
| 10 | **Catégories** | Indépendantes des packs (m:n). Une question = 1 seul pack, pas de réutilisation. |

### 8.3 Points encore ouverts

| # | Question | Impact |
|---|----------|--------|
| 1 | **Prix des packs premium** : Fourchette de prix ? À l'unité ou bundles ? | Phase 4 |
| 2 | **Voleur multi-appareil gorgée** : Le voleur qui rate boit même si le mode alcool n'est pas activé ? Ou seulement en mode alcool ? | Phase 2.6 |

### 8.4 Dépendances techniques à ajouter

| Package | Phase | Usage |
|---------|-------|-------|
| `canvas-confetti` ou `@tsparticles/react` | 1 | Animations confettis/particules |
| `framer-motion` | 1 | Animations UI avancées |
| `stripe` (backend) | 4 | API Stripe |
| `@stripe/stripe-js` + `@stripe/react-stripe-js` | 4 | Stripe côté client |

### 8.5 Risques et considérations

| Risque | Mitigation |
|--------|------------|
| **WebSocket scalabilité** | Bun gère très bien les WS. Pour le MVP, un seul serveur suffit. Scale-out avec Redis pub/sub si besoin. |
| **Triche en multi-appareil** | Validation côté serveur uniquement. Le client n'a jamais la réponse avant soumission. |
| **Latence réseau** | Timer chrono géré côté serveur avec tolérance de 500ms. |
| **Stripe compliance** | CGV nécessaires. Pas de contenu illégal dans les packs. |
| **RGPD** | Stocker le minimum (Clerk gère l'auth). GameAnswer anonymisable. |
