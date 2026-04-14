# Discovery Index

## Coverage

| Domain | Pages | Scenarios | Covered | Last explored |
|--------|-------|-----------|---------|---------------|
| e2e    | 8     | 22        | 13      | 2026-04-14    |

## Stale

| Scenario | Reason |
|----------|--------|

## Blocked

| Lead | Blocker | Source |
|------|---------|--------|
| playwright-cli exploration of protected pages | AuthGuard requires addInitScript which playwright-cli doesn't support | Tests use Playwright Test fixtures with bypass |

## Scenarios

### e2e — Solo game

| Scenario | Page | Status | Priority | Spec |
|----------|------|--------|----------|------|
| [Classic full game](./classic-full-game.md) | game | covered | critical | classic-flow |
| [Classic multiplayer](./classic-multiplayer.md) | game | covered | high | classic-multiplayer |
| [Voleur steal flow](./voleur-steal-flow.md) | game | covered | critical | voleur-steal |
| [Chrono timer](./chrono-timer.md) | game | covered | critical | chrono-timer |
| [Question types](./question-types.md) | game | covered | high | question-types |
| [Home navigation](./home-navigation.md) | home | covered | high | home-nav |
| [Combo scoring](./combo-scoring.md) | game | covered | medium | combo-scoring |

### e2e — Landing + Auth

| Scenario | Page | Status | Priority | Spec |
|----------|------|--------|----------|------|
| [Landing page display](./landing-page-display.md) | landing | covered | high | landing-page |
| [Landing rules modal](./landing-rules-modal.md) | landing | covered | medium | landing-page |
| [Mode choice navigation](./mode-choice-navigation.md) | mode-choice | covered | high | mode-choice |

### e2e — Multi-device

| Scenario | Page | Status | Priority | Spec |
|----------|------|--------|----------|------|
| [Multi lobby](./multi-lobby.md) | lobby | covered | critical | multi-lobby |
| [Multi classic flow](./multi-classic-flow.md) | multi-game | covered | critical | multi-game |
| [Multi chrono flow](./multi-chrono-flow.md) | multi-game | covered | critical | multi-game |
| [Multi voleur flow](./multi-voleur-flow.md) | multi-game | covered | critical | multi-game |
| [Multi reconnection](./multi-reconnection.md) | multi-game | discovered | high | multi-game |

### e2e — Alcohol mode

| Scenario | Page | Status | Priority | Spec |
|----------|------|--------|----------|------|
| [Alcohol config UI](./alcohol-config-ui.md) | home | covered | high | alcohol |
| [Alcohol solo trigger](./alcohol-solo-trigger.md) | game | covered | critical | alcohol |
| [Alcohol multi trigger](./alcohol-multi-trigger.md) | multi-game | covered | high | alcohol |
| [Distributeur solo flow](./distributeur-solo-flow.md) | game | discovered | high | alcohol |
| [Courage solo flow](./courage-solo-flow.md) | game | discovered | critical | alcohol |
| [Cul sec end game](./cul-sec-end-game.md) | end | discovered | high | alcohol |
| [Mute toggle persists](./mute-toggle.md) | all | discovered | medium | settings |
