# Discovery Index

## Coverage

| Domain     | Pages | Scenarios | Covered | Last explored |
|------------|-------|-----------|---------|---------------|
| solo       | 5     | 19        | 19      | 2026-04-20    |
| multi      | 3     | 15        | 11      | 2026-04-20    |

## Stale

| Scenario | Reason |
|----------|--------|

## Blocked

| Lead | Blocker | Source |
|------|---------|--------|
| ~~playwright-cli exploration of protected pages~~ | FIXED — use `run-code` to `page.addInitScript(window.__clerk_test_bypass__ = true)` + WebSocket override injecting `?testUser=`. Mock Strapi on port 1337 via `tests/global-setup.ts` pattern | 2026-04-20 exploration |
| ~~Distributeur solo buttons~~ | FIXED — treats null myClerkId as solo distributor | de79160 |
| ~~Cul sec solo~~ | FIXED — gameStore triggers drink alert before navigating to /end | de79160 |

## Scenarios

### solo — Classic / Chrono / Voleur gameplay

| Scenario | Page | Status | Priority | Spec |
|----------|------|--------|----------|------|
| [Classic full game](./classic-full-game.md) | game | covered | critical | classic-flow |
| [Classic two local players](./classic-two-local-players.md) | game | covered | high | classic-two-local-players |
| [Voleur steal flow](./voleur-steal-flow.md) | game | covered | critical | voleur-steal |
| [Chrono timer](./chrono-timer.md) | game | covered | critical | chrono-timer |
| [Question types](./question-types.md) | game | covered | high | question-types |
| [Home navigation](./home-navigation.md) | home | covered | high | home-nav |
| [Combo scoring](./combo-scoring.md) | game | covered | medium | combo-scoring |

### solo — Landing + Auth

| Scenario | Page | Status | Priority | Spec |
|----------|------|--------|----------|------|
| [Landing page display](./landing-page-display.md) | landing | covered | high | landing-page |
| [Landing rules modal](./landing-rules-modal.md) | landing | covered | medium | landing-page |
| [Mode choice navigation](./mode-choice-navigation.md) | mode-choice | covered | high | mode-choice |
| [Mute toggle persists](./mute-toggle.md) | landing | covered | medium | mute-persistence |

### solo — Alcohol mode

| Scenario | Page | Status | Priority | Spec |
|----------|------|--------|----------|------|
| [Alcohol config UI](./alcohol-config-ui.md) | home | covered | high | alcohol-config |
| [Alcohol solo trigger](./alcohol-solo-trigger.md) | game | covered | critical | alcohol-solo-flow |
| [Distributeur solo flow](./distributeur-solo-flow.md) | game | covered | high | alcohol-distributeur-solo |
| [Courage solo flow](./courage-solo-flow.md) | game | covered | critical | alcohol-courage-solo |
| [Cul sec end game](./cul-sec-end-game.md) | end | covered | high | alcohol-cul-sec-end |

### solo — Marketplace

| Scenario | Page | Status | Priority | Spec |
|----------|------|--------|----------|------|
| [Free pack selection](./marketplace-free.md) | home | covered | high | marketplace |
| [Premium pack lock + price](./marketplace-premium-lock.md) | home | covered | critical | marketplace |
| [Landing page price](./marketplace-landing-price.md) | landing | covered | medium | marketplace |

### multi — Lobby

| Scenario | Page | Status | Priority | Spec |
|----------|------|--------|----------|------|
| [Multi lobby](./multi-lobby.md) | lobby | covered | critical | multi-lobby |
| [Create room twice](./create-room-twice.md) | mode-choice | covered | critical | multi-lobby |
| [Multi reconnection](./multi-reconnection.md) | lobby | blocked | high | -- |
| [Lobby start disabled (1 player)](./lobby-start-disabled-one-player.md) | lobby | covered | high | multi-lobby |
| [Lobby copy room code](./lobby-copy-room-code.md) | lobby | covered | medium | multi-lobby |
| [Lobby gender toggle](./lobby-gender-toggle.md) | lobby | covered | medium | multi-lobby |
| [Lobby edit username](./lobby-edit-username.md) | lobby | covered | medium | multi-lobby |

### multi — Game flows

| Scenario | Page | Status | Priority | Spec |
|----------|------|--------|----------|------|
| [Multi classic flow](./multi-classic-flow.md) | multi-game | covered | critical | multi-classic-flow |
| [Multi chrono flow](./multi-chrono-flow.md) | multi-game | covered | critical | multi-chrono-flow |
| [Multi voleur flow](./multi-voleur-flow.md) | multi-game | covered | critical | multi-voleur-flow |
| [Multi classic input lock](./multi-classic-input-lock.md) | multi-game | covered | critical | multi-classic-flow |
| [Voleur input lock](./voleur-input-lock.md) | multi-game | discovered | high | multi-voleur-flow |
| [Voleur main correct instant](./voleur-main-correct-instant.md) | multi-game | discovered | critical | multi-voleur-flow |
| [Voleur amber steal feedback](./voleur-amber-steal-feedback.md) | multi-game | discovered | high | multi-voleur-flow |

### multi — Alcohol

| Scenario | Page | Status | Priority | Spec |
|----------|------|--------|----------|------|
| [Alcohol multi trigger](./alcohol-multi-trigger.md) | multi-game | covered | high | multi-alcohol-flow |
