# Manches Spéciales — Audit complet

> Version: 1.0 — 19 avril 2026
> Statut: Audit — findings + priorités pour correction

## Objectif

Auditer de bout en bout les 8 manches spéciales du mode alcool : conformité à la spec, robustesse du code, correction du flow WebSocket (multi), qualité UX, et couverture E2E. Produire un inventaire exhaustif des bugs et divergences, pré-requis à la spec de correction.

Les manches auditées :

1. `petit_buveur` 🍺
2. `distributeur` 🎯
3. `courage` 🎰
4. `conseil` 🗳️
5. `love_or_drink` 💋
6. `cupidon` 💘
7. `show_us` 👀
8. `smatch_or_pass` 💥

---

## Méthodologie

L'audit s'est déroulé en deux passes :

1. **Analyse statique** (3 agents parallèles) : lecture ligne à ligne de `src/server/alcohol/`, `src/components/alcohol/`, et `tests/e2e/alcohol-*.spec.ts`. Conformité aux specs `2026-04-14-alcohol-mode-design.md` et `2026-04-14-alcohol-phase-b-design.md`.

2. **Analyse du flow WebSocket** (lecture manuelle ciblée) : trace complète `start_game` → `question` → `submit_answer` → `turn_result` → `scheduleNextQuestion` → `checkTrigger` → round handler → `special_round_end` → retour question. Cette passe a remonté des bugs invisibles à l'analyse fichier par fichier.

Les findings de la passe 1 sont consolidés dans la section **"Bugs par manche"**. Les findings de la passe 2 sont dans **"Bugs transverses du flow WS"** — plusieurs d'entre eux sont plus critiques que les bugs per-round.

---

## Flow WebSocket — comprendre le séquencement

### Flow nominal d'un tour standard (multi)

```
[Serveur]                                [Client]
sendQuestion                             
  broadcast question       ─────────────►  roomStore reçoit question
                                           GameScreen affiche la question
                                           Joueur répond
roomStore envoie submit_answer ◄──────   submit_answer
resolveClassicOrChrono/Voleur
  broadcast player_answered ───────────►  UI montre "X a répondu"
  broadcast turn_result     ───────────►  UI affiche feedback + scores
scheduleNextQuestion (timer 3s)
  ─── 3s ───
  currentQuestionIndex += 1
  advanceToNextConnectedPlayer
  checkTrigger(room)
    ├─ pas de trigger → sendQuestion ──►  question suivante
    └─ trigger        → handler.start()
```

### Flow avec manche spéciale (multi)

```
[Serveur — handler.start]
  broadcast special_round_start        ─►  setActiveRound(type, data) → overlay affiché
  broadcast sub-msg (courage_decision, ─►  activeRoundData fusionné
    distribute_prompt, etc.)
  broadcast drink_alert(s)             ─►  addDrinkAlert → DrinkAlert overlay
                                           [Joueur interagit avec overlay]
  handler.handleMessage ◄──── courage_choice / distribute_drink / ...
  [résolution de la manche]
  broadcast round_result               ─►  ??? (voir bug #A)
  broadcast drink_alert(s)             ─►  addDrinkAlert
  setTimeout (4-5s)
  endSpecialRound
    activeRound = null
    broadcast special_round_end        ─►  endActiveRound → overlay retiré
    setTimeout (1s)
    _onRoundEnd
      sendQuestion                     ─►  question suivante (le state.game est reset)
```

### Points d'attention dans le flow

- `checkTrigger` est appelé **après** l'incrément de `currentQuestionIndex` et l'avancée du joueur (`game-engine.ts:488-491`). La manche spéciale s'insère donc **entre** deux questions, sans consommer d'index.
- `checkTrigger` retourne `false` si `activeRound !== null`, ce qui protège contre un double-trigger. L'incrément de `turnsSinceLastSpecial` est bien après ce guard (`framework.ts:82-84`).
- Le `setTimeout(_onRoundEnd, 1000)` dans `endSpecialRound` (`framework.ts:137-139`) crée une fenêtre d'1 seconde entre la fermeture de l'overlay client et l'arrivée de la prochaine question.
- En fin de partie, `handleCulSecEndGame` émet des `drink_alert` puis `setTimeout` de 5s avant `game_over` (`game-engine.ts:533-545`).

---

## Inventaire du code

### Architecture

Plugin registry bien appliqué. Pour chaque manche :
- `src/server/alcohol/rounds/<round>.ts` — logique serveur (implémente `ServerRound`)
- `src/components/alcohol/rounds/<Round>.tsx` — UI client
- Enregistrement dans `src/server/alcohol/rounds/index.ts` et `src/components/alcohol/rounds/index.ts`

### Intégration

- Store `alcoholStore.ts` — état solo (config, queue, activeRound, drinkAlerts, cupidLinks)
- `roomStore.ts` — handlers WS pour le multi
- `GameScreen.tsx` + `MultiGameScreen.tsx` — rendent `SpecialRoundOverlay` et la stack `DrinkAlert`
- `game-engine.ts` — appelle `checkTrigger` dans `scheduleNextQuestion` et `handleCulSecEndGame` dans `endGame`

### Propagation Cupidon

Correcte. `framework.ts:49-70` : `broadcastDrinkAlert` envoie l'alerte à la cible puis duplique pour le/les partenaires Cupidon. Toutes les manches concernées appellent bien `broadcastDrinkAlert` (sauf `smatch_or_pass` qui ne fait boire personne).

---

## Bugs transverses du flow WS

Ces bugs, identifiés par la passe flow, affectent plusieurs manches simultanément et sont les plus critiques à corriger.

### 🔴 BUG-FLOW-1 — 4 messages serveur Phase B non gérés par le client

**Sévérité : P0 — bloquant UX multi Phase B**

**Fichiers** : `roomStore.ts:279-318` (handlers présents)

Le serveur broadcast 4 messages résultat qui n'ont **aucun handler** dans `roomStore.ts` :

| Message serveur | Émis par | Contenu attendu par le composant |
|-----------------|----------|-----------------------------------|
| `conseil_result` | `conseil.ts:106` | `data.phase = "result"`, `votes`, `loserClerkIds` |
| `love_or_drink_result` | `love-or-drink.ts` | `data.choice = "bisou"\|"cul_sec"` |
| `show_us_result` | `show-us.ts:105` | `data.correctColor`, `data.wrongClerkIds`, `data.timedOut` |
| `smatch_or_pass_result` | `smatch-or-pass.ts:24` | `data.choice = "smatch"\|"pass"` |

Les composants correspondants lisent ces champs :
- `Conseil.tsx:25` — `data.phase === "result"`
- `LoveOrDrink.tsx:25` — `data.choice`
- `ShowUs.tsx:56-61` — `data.correctColor`, `data.timedOut`
- `SmatchOrPass.tsx` — `data.choice`

**Impact concret** : en multi, les phases résultat de ces 4 manches **ne s'affichent jamais**. L'overlay reste bloqué sur "En attente..." pendant 5 s, puis `special_round_end` arrive et l'overlay disparaît sans jamais avoir montré le résultat.

**Solde** : 4/5 manches Phase B multi fonctionnent silencieusement en mode "dégradé".

### 🔴 BUG-FLOW-2 — DrinkAlerts fullscreen empilés

**Sévérité : P0 — chaos visuel**

**Fichiers** :
- `framework.ts:49-70` (broadcast un par cible + propagation Cupidon)
- `DrinkAlert.tsx` (overlay `inset-0` fullscreen)
- `GameScreen.tsx` / `MultiGameScreen.tsx` (render `drinkAlerts.map(...)`)

Quand plusieurs joueurs boivent sur une même action, `broadcastDrinkAlert` est appelé N fois, le client reçoit N messages `drink_alert`, `addDrinkAlert` pousse N éléments dans `drinkAlerts[]`, et le GameScreen mappe sur ce tableau en rendant N `<DrinkAlert>` — chacun fullscreen `inset-0`. Ils se superposent.

Cas déclenchants :
- `petit_buveur` avec égalité (2+ ex-æquo au plus bas score)
- `love_or_drink` avec choix `cul_sec` → les 2 joueurs boivent
- `courage` + Cupidon → joueur courage boit + partenaire Cupidon boit
- En solo, `LoveOrDrink.tsx:38-45` ajoute 2 alerts locaux dans la boucle

### 🟠 BUG-FLOW-3 — Fenêtre de 1 seconde avec UI stale après `special_round_end`

**Sévérité : P1 — flash UI**

**Fichiers** : `framework.ts:137-139`

```ts
broadcast(room, { type: "special_round_end" });        // t=0
setTimeout(() => _onRoundEnd(room), 1000);              // t=1s → sendQuestion
```

Pendant cette seconde, l'overlay spécial est fermé côté client mais `question` n'est pas encore reçu. Le GameScreen continue de montrer le `turnResult` et la dernière question (le state `game` n'est reset qu'à l'arrivée du prochain `question`). Flash visuel non désiré.

### 🟠 BUG-FLOW-4 — `courage` consomme silencieusement des questions du pool

**Sévérité : P1 — partie raccourcie**

**Fichiers** : `courage.ts:29` → `game.questions.splice(i, 1)`

`pickCourageQuestion` supprime la question QCM sélectionnée du tableau `game.questions`. Comme `game.questions.length` est la condition de fin de partie (`game-engine.ts:478`), chaque déclenchement de `courage` raccourcit la partie d'une question. Cumulatif sur plusieurs courage dans une partie.

### 🟡 BUG-FLOW-5 — Messages result Phase B non déclarés dans le type `ServerMessage`

**Sévérité : P2 — safety types perdue**

**Fichiers** : `src/server/types.ts`

`conseil_result`, `love_or_drink_result`, `show_us_result`, `smatch_or_pass_result` ne sont pas dans la union `ServerMessage`. Les broadcasts passent à cause du typage permissif de `broadcast()`, mais il n'y a aucune vérification statique.

### 🟡 BUG-FLOW-6 — Pas de cleanup des Map d'état serveur en cas de destruction de room

**Sévérité : P2 — fuite mémoire théorique**

**Fichiers** : Map globales dans `distributeur.ts`, `courage.ts`, `conseil.ts`, `love-or-drink.ts`, `show-us.ts`, `smatch-or-pass.ts`

Chaque round stocke son état dans `new Map<string, State>()` indexée par `room.code`. Si une room est supprimée pendant qu'une manche est active, l'entrée de la Map persiste indéfiniment (sauf si le timeout/résolution passe par la branche `.delete(room.code)`).

---

## Bugs par manche

Findings issus de l'analyse statique. Classés P0 (correctness), P1 (spec divergence), P2 (UX / robustesse).

### `petit_buveur` 🍺

Le plus simple des rounds — affichage + broadcast drink_alert + auto-end 5s.

| Sévérité | Fichier:ligne | Description |
|----------|---------------|-------------|
| P1 | `petit-buveur.ts:11` | `Math.min(...Object.values(game.scores))` — sûr en pratique car `game` existe au trigger, mais pas de guard explicite si `scores` est vide |
| — | — | Logique égalité bien gérée : tous les ex-æquo au min sont `losers` |

**Conformité spec** : ✅ 100 %. Propagation Cupidon OK. Pause 5 s respectée.

### `distributeur` 🎯

3 gorgées à distribuer parmi les autres joueurs.

| Sévérité | Fichier:ligne | Description |
|----------|---------------|-------------|
| P1 | `distributeur.ts:20-22` | Sélection du winner via `Object.entries().find()` : dépend de l'ordre d'insertion du dict `scores`, pas de l'ordre de rotation demandé par la spec (`alcohol-mode-design.md:129`) |
| P2 | `distributeur.ts:56` | Pas de validation que `targetClerkId` appartient bien aux autres joueurs — distributeur peut potentiellement se distribuer à lui-même |
| P2 | `Distributeur.tsx:23` | `useState((data.remaining as number) ?? 3)` — ne se resync pas si le serveur push un nouveau `remaining` |

**Conformité spec** : ~90 %.

### `courage` 🎰

Manche la plus complexe : décision 10 s → question texte → réponse.

| Sévérité | Fichier:ligne | Description |
|----------|---------------|-------------|
| P1 | `courage.ts:29` | `game.questions.splice(i, 1)` raccourcit le pool (voir BUG-FLOW-4) |
| P1 | `QuestionDeCourage.tsx:34-49` | Countdown 10 s affiché mais pas de forçage côté solo quand il atteint 0 — les boutons restent cliquables. En multi le serveur force via `decisionTimeout` côté serveur, OK. |
| P2 | `QuestionDeCourage.tsx:24-32` | Hybrid `const phase = serverPhase ?? localPhase` — si un message arrive après un changement local, l'UI peut clignoter |
| P2 | `QuestionDeCourage.tsx` | Pas de timer visible pendant la phase question (le joueur peut traîner indéfiniment côté solo) |

**Conformité spec** : 95 %.

### `conseil` 🗳️

Vote pour un boloss qui boit.

| Sévérité | Fichier:ligne | Description |
|----------|---------------|-------------|
| P0 | BUG-FLOW-1 | `conseil_result` non géré côté client → l'UI result n'apparaît jamais en multi |
| P1 | `Conseil.tsx:51-55` | En solo, le code simule que **tous** les joueurs votent pour la cible choisie → résultat déterministe, pas fun |
| P0 | `Conseil.tsx:154-164` | En solo 1 seul joueur, `otherPlayers` est vide → écran de vote sans bouton, manche impossible à jouer |
| P2 | `conseil.ts:58` | Pas de validation que `targetClerkId` existe dans `room.players` |
| P2 | `conseil.ts:92-98` | Si aucun vote reçu (timeout sans votes), `loserClerkIds` est vide → personne ne boit. Spec silencieuse sur ce cas. |

**Conformité spec** : 70 %.

### `love_or_drink` 💋

Les 2 du bas choisissent bisou ou cul_sec.

| Sévérité | Fichier:ligne | Description |
|----------|---------------|-------------|
| P0 | BUG-FLOW-1 | `love_or_drink_result` non géré côté client |
| P0 | `LoveOrDrink.tsx:38-45` | En solo cul_sec, boucle ajoutant 2 `addDrinkAlert` → 2 overlays fullscreen empilés (voir aussi BUG-FLOW-2) |
| P1 | `LoveOrDrink.tsx` | En multi, les 2 participants voient les boutons et peuvent tous deux cliquer. Le premier reçu par serveur gagne, mais pas de verrouillage visuel sur le second |

**Conformité spec** : 70 %.

### `cupidon` 💘

Lie 2 joueurs pour le reste de la partie (propagation drink_alert).

| Sévérité | Fichier:ligne | Description |
|----------|---------------|-------------|
| P1 | `cupidon.ts:15` | `[...players].sort(() => Math.random() - 0.5)` — shuffle biaisé, non uniforme. Le framework possède déjà un Fisher-Yates `shuffleArray`, à réutiliser |

**Conformité spec** : 95 %. Propagation elle-même correcte.

### `show_us` 👀

Deviner la couleur.

| Sévérité | Fichier:ligne | Description |
|----------|---------------|-------------|
| P0 | BUG-FLOW-1 | `show_us_result` non géré côté client |
| P1 | `ShowUs.tsx:41-54` | `useEffect` du countdown dépend de `[phase, isTarget]` — si le parent re-render avec isTarget différent, l'interval est réinstancié |
| P2 | `show-us.ts:74` | Pas de guard `if (rs.revealed) return;` sur un vote qui arriverait après la révélation |
| Design | `ShowUs.tsx:79-101` | En solo, le joueur vote vs lui-même — expérience dégradée mais c'est un choix de design, pas un bug |

**Conformité spec** : 85 %.

### `smatch_or_pass` 💥

Deux joueurs de sexe opposé.

| Sévérité | Fichier:ligne | Description |
|----------|---------------|-------------|
| P0 | BUG-FLOW-1 | `smatch_or_pass_result` non géré côté client |
| P1 | `smatch-or-pass.ts:42-43` | `connected.find(p => p.gender === "homme")` — prend le **premier** homme et la **première** femme, alors que la spec demande "choisis au hasard" |
| P2 | `SmatchOrPass.tsx:54-62` | Double conversion gender → symbole → emoji fragile |

**Conformité spec** : 80 %.

---

## Couverture E2E actuelle

8 fichiers de test dans `apps/client/tests/e2e/alcohol-*.spec.ts` :

| Fichier | Scope | Qualité |
|---------|-------|---------|
| `alcohol-config.spec.ts` | UI config (toggle, slider) | Bonne pour la config, ne teste pas l'effet en jeu |
| `alcohol-solo-flow.spec.ts` | Déclenchement générique + petit_buveur | Regex larges, accepte n'importe quelle manche |
| `alcohol-courage-solo.spec.ts` | Courage solo complet | Teste accept + saisie, pas le refus, pas le timeout |
| `alcohol-distributeur-solo.spec.ts` | Distributeur solo | Clic 3× Bob, sélecteur emoji fragile |
| `alcohol-phase-b-rounds.spec.ts` | Phase B solo | Déclenchement seul, aucune interaction |
| `alcohol-phase-b-multi.spec.ts` | Phase B multi | Déclenchement seul, aucune interaction |
| `multi-alcohol-flow.spec.ts` | Phase A multi | Regex larges, pas d'interaction |
| (manquant) | Courage **multi** | Aucun test dédié |

Pour chaque manche :

| Manche | Solo interactif | Multi interactif | Assertions résultat | Cleanup retour-question |
|--------|-----------------|------------------|---------------------|-------------------------|
| `petit_buveur` | ❌ | ❌ | ❌ | ❌ |
| `distributeur` | ✅ (clics Bob) | ❌ | ⚠️ (drink_alert seulement) | ❌ |
| `courage` | ✅ (accept + saisie) | ❌ | ⚠️ (regex large) | ❌ |
| `conseil` | ❌ | ❌ | ❌ | ❌ |
| `love_or_drink` | ❌ | ❌ | ❌ | ❌ |
| `cupidon` | ❌ | ❌ | ❌ | ❌ |
| `show_us` | ❌ | ❌ | ❌ | ❌ |
| `smatch_or_pass` | ❌ (fallback skip) | ❌ | ❌ | ❌ |

### Patterns fragiles récurrents

- Regex trop larges : `/Petit buveur|Distributeur|Question de courage/` qui accepte n'importe quelle manche
- Sélecteurs emoji : `/🍺 Bob/` dépendent du rendu emoji
- Polling agressif : boucles `for (i=0; i<20; i++) { waitForTimeout(500) }` → instables en CI
- Pas de `waitFor` explicite sur les événements WS côté fixture

---

## Synthèse priorisée des correctifs

### P0 — à corriger en priorité

| # | Zone | Correctif |
|---|------|-----------|
| 1 | `roomStore.ts` | Ajouter handlers pour `conseil_result`, `love_or_drink_result`, `show_us_result`, `smatch_or_pass_result` |
| 2 | `DrinkAlert` + `GameScreen`/`MultiGameScreen` | Passer d'un stack fullscreen à un système de toast empilables (ou un seul overlay avec file interne) |
| 3 | `Conseil.tsx` solo < 2 joueurs | Fallback : skip round ou autre comportement déterministe (par ex. auto-vote aléatoire) |
| 4 | `LoveOrDrink.tsx:38-45` solo | Un seul `addDrinkAlert` mentionnant les 2 joueurs |

### P1 — spec compliance + bugs structurels

| # | Zone | Correctif |
|---|------|-----------|
| 5 | `courage.ts:29` | Ne plus splicer. Option : marquer index consommé via un Set `usedByCourage` dans `alcoholState` et skip dans `sendQuestion` |
| 6 | `cupidon.ts:15` | Réutiliser `shuffleArray` de `framework.ts` |
| 7 | `smatch-or-pass.ts:42-43` | Filtrer hommes / femmes puis tirage aléatoire dans chaque sous-liste |
| 8 | `distributeur.ts:20-22` | Sélection basée sur l'ordre de rotation (`currentPlayerIndex`) en cas d'égalité |
| 9 | `Conseil.tsx:51-55` | En solo, simuler des votes aléatoires (pas tout sur la cible choisie) |
| 10 | `QuestionDeCourage.tsx` solo | Forcer l'envoi "refus" quand le countdown atteint 0 |
| 11 | `framework.ts:137` | Réduire ou supprimer la fenêtre de 1 s entre `special_round_end` et `sendQuestion` (ex : envoyer `question` puis `special_round_end` groupés, ou laisser l'overlay jusqu'au prochain `question`) |

### P2 — types, robustesse, polish

| # | Zone | Correctif |
|---|------|-----------|
| 12 | `server/types.ts` | Ajouter les 4 messages result Phase B dans `ServerMessage` |
| 13 | Maps d'état rounds | Cleanup handler sur destruction de room (optionnel) |
| 14 | `show-us.ts:74` | Guard `if (rs.revealed) return;` sur vote tardif |
| 15 | `distributeur.ts:56` | Valider que `targetClerkId ≠ distributor` et que targetClerkId est un joueur connecté |
| 16 | `conseil.ts:58` | Valider que `targetClerkId` est un joueur de la room |
| 17 | `SmatchOrPass.tsx` | Nettoyer la double conversion gender → emoji |

---

## Rapport UX par manche (fun / simple / pratique)

Évaluation subjective issue de la lecture code + spec.

| Manche | Fun | Simple | Pratique | Remarques |
|--------|-----|--------|----------|-----------|
| `petit_buveur` | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Passif mais efficace. Ajouter un son + animation de gorgée ? |
| `distributeur` | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | Interactif. Manque un compteur visuel côté spectateurs |
| `courage` | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | Best round en tension. Manque un timer sur la phase question |
| `conseil` | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | Fun en multi, cassé en solo. Besoin de résolution visible (bug #1) |
| `love_or_drink` | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | Concept fun, mais qui décide ? À clarifier côté serveur |
| `cupidon` | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Purement passif. Manque un badge permanent sur le scoreboard pour rappeler le lien |
| `show_us` | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | Fun en multi, trivial en solo (self-vote). Résultat pas affiché (bug #1) |
| `smatch_or_pass` | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | Fun mais dépendant des genres. Sélection non aléatoire (bug #7) |

### Recommandations produit (hors-scope de la correction pure)

- Sons dédiés par manche (verre qui tinte, cœur qui bat, applaudissement vote)
- Animation de gorgée (le verre qui se vide)
- Rappel permanent des liens Cupidon dans le scoreboard
- Timer visible sur toutes les phases d'attente / vote

---

## Plan d'action

1. **Reproduction des bugs** via tests Playwright (un script de repro par bug P0/P1 listé). Basé sur le flow `/nightwatch`. Voir section suivante pour la stratégie.
2. **Spec de correction** : prendra chaque finding listé ici et proposera un design de fix + les changements de contrat (messages WS, store state).
3. **Plan d'exécution** : pas à pas, avec dépendances et ordre d'implémentation.

### Stratégie de reproduction

- Utilitaires à créer : `tests/helpers/alcohol-fixtures.ts` (config alcool commune, sélecteurs, attente overlay) + `tests/helpers/round-repro.ts` (forcer une manche précise en seedant `enabledRounds: [single]` et `frequency: 1`).
- Un fichier repro par bug P0/P1 : `tests/repro/BUG-<id>-<slug>.spec.ts`.
- Parallélisation : 1 agent par groupe de bugs non-intersectants (flow WS / Phase A / Phase B / client UI).

### Fichiers qui seront produits après cet audit

- `docs/superpowers/specs/2026-04-19-special-rounds-fix-design.md` — spec de correction
- `docs/superpowers/plans/2026-04-19-special-rounds-fix.md` — plan d'implémentation
- `apps/client/tests/helpers/alcohol-fixtures.ts` et `round-repro.ts`
- `apps/client/tests/repro/BUG-*.spec.ts` — un fichier par bug
- `apps/client/tests/e2e/alcohol-<round>-{solo,multi}.spec.ts` — un fichier E2E par manche et par mode après correctifs

---

## Annexes

### A. Inventaire des fichiers audités

```
src/server/alcohol/
  framework.ts        — broadcastDrinkAlert + checkTrigger + endSpecialRound + handleCulSecEndGame
  types.ts            — ServerRound, AlcoholConfig, AlcoholState
  rounds/
    petit-buveur.ts
    distributeur.ts
    courage.ts
    conseil.ts
    love-or-drink.ts
    cupidon.ts
    show-us.ts
    smatch-or-pass.ts
    index.ts

src/components/alcohol/
  SpecialRoundOverlay.tsx
  DrinkAlert.tsx
  AlcoholConfig.tsx
  rounds/
    PetitBuveur.tsx
    Distributeur.tsx
    QuestionDeCourage.tsx
    Conseil.tsx
    LoveOrDrink.tsx
    Cupidon.tsx
    ShowUs.tsx
    SmatchOrPass.tsx
    index.ts

src/stores/
  alcoholStore.ts
  roomStore.ts
  gameStore.ts

src/server/
  game-engine.ts
  ws.ts
  types.ts
  rooms.ts
```

### B. Mapping bug → fichier test de repro à créer

| Bug | Fichier repro |
|-----|---------------|
| BUG-FLOW-1 (Conseil) | `tests/repro/BUG-FLOW-1-conseil-result-multi.spec.ts` |
| BUG-FLOW-1 (LoveOrDrink) | `tests/repro/BUG-FLOW-1-love-or-drink-result-multi.spec.ts` |
| BUG-FLOW-1 (ShowUs) | `tests/repro/BUG-FLOW-1-show-us-result-multi.spec.ts` |
| BUG-FLOW-1 (Smatch) | `tests/repro/BUG-FLOW-1-smatch-result-multi.spec.ts` |
| BUG-FLOW-2 | `tests/repro/BUG-FLOW-2-drink-alert-stack.spec.ts` |
| BUG-FLOW-3 | `tests/repro/BUG-FLOW-3-round-end-gap.spec.ts` |
| BUG-FLOW-4 | `tests/repro/BUG-FLOW-4-courage-splice-shortens.spec.ts` |
| Conseil solo <2 | `tests/repro/BUG-conseil-solo-empty.spec.ts` |
| LoveOrDrink solo 2 alerts | `tests/repro/BUG-love-or-drink-double-alert.spec.ts` |
| Cupidon shuffle | `tests/repro/BUG-cupidon-biased-shuffle.spec.ts` (test unitaire, pas E2E) |
| Smatch non-random | `tests/repro/BUG-smatch-non-random.spec.ts` (test unitaire) |
| Courage countdown | `tests/repro/BUG-courage-countdown-no-force.spec.ts` |
