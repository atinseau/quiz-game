# Scenario: Multi-device classic game flow

**Status:** covered
**Priority:** critical
**Page:** multi-game
**Domain:** multi
**Spec:** multi-classic-flow

## Preconditions

- Host and guest both on /play (auth bypass via multi-fixtures)
- Required mocks: Strapi packs API, Clerk auth, test WS user override
- Initial state: both devices unauthenticated, ready to create/join a room

## Steps

1. Identify users and create room
   - **Do:** `setTestUser(host, "Alice")`, `setTestUser(guest, "Bob")`, `hostCreatesRoom(host)` → code
   - **Expect:** Room code returned, lobby visible on host

2. Guest joins by code
   - **Do:** `guestJoinsRoom(guest, code)`
   - **Expect:** Host lobby shows "Bob" within 5s

3. Host configures game
   - **Do:** `hostSelectsPack(host, "pack-test")`, `hostSelectsMode(host, "classic")`, `hostStartsGame(host)`
   - **Expect:** Both devices navigate to /game within 10s, first question visible

4. Play through all questions
   - **Do:** Loop up to 8 questions, alternating turns via `answerViaUI(player)` and waiting for text change
   - **Expect:** Eventually at least one device reaches /end

## Assertions

- [ ] Both devices navigate to /game on start
- [ ] First question renders on host
- [ ] Game completes end-to-end reaching /end

## Notes

Multi fixtures inject test WS users via `setTestUser` at page init. Reconnection cannot be exercised mid-navigation because the WS override only applies on init.
