# Discovery Index

## Coverage

| Domain | Pages | Scenarios | Covered | Last explored |
|--------|-------|-----------|---------|---------------|
| e2e    | 4     | 10        | 7       | 2026-04-14    |

## Stale

| Scenario | Reason |
|----------|--------|
| Classic full game | home page moved to /play/solo |
| Home navigation | home page moved to /play/solo |

## Blocked

| Lead | Blocker | Source |
|------|---------|--------|
| Multi-device lobby exploration | Clerk auth required — cannot explore /play, /play/lobby without real Clerk session or test bypass | AuthGuard redirects to / |
| Multi-device game flow E2E | Room state requires WS auth + 2 authenticated sessions — Clerk test tokens not available | WS upgrade rejects without __session cookie |

## Scenarios

### e2e

| Scenario | Page | Status | Priority | Spec |
|----------|------|--------|----------|------|
| [Classic full game](./classic-full-game.md) | game | covered (stale) | critical | classic-flow |
| [Classic multiplayer](./classic-multiplayer.md) | game | covered | high | classic-multiplayer |
| [Voleur steal flow](./voleur-steal-flow.md) | game | covered | critical | voleur-steal |
| [Chrono timer](./chrono-timer.md) | game | covered | critical | chrono-timer |
| [Question types](./question-types.md) | game | covered | high | question-types |
| [Home navigation](./home-navigation.md) | home | covered (stale) | high | home-nav |
| [Combo scoring](./combo-scoring.md) | game | covered | medium | combo-scoring |
| [Landing page display](./landing-page-display.md) | landing | discovered | high | -- |
| [Landing rules modal](./landing-rules-modal.md) | landing | discovered | medium | -- |
| [Mode choice navigation](./mode-choice-navigation.md) | mode-choice | discovered | high | -- |
