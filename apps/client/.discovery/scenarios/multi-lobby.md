# Scenario: Multi-device lobby

**Status:** covered
**Priority:** critical
**Page:** lobby
**Domain:** multi
**Spec:** multi-lobby

## Preconditions

- Host + guest on /play (auth bypass)
- Required mocks: Strapi packs API, Clerk auth, WS test user override
- Initial state: both devices unauthenticated, ready to create/join
- Tests run serially (shared in-memory rooms on the server)

## Steps

1. Host creates room
   - **Do:** `setTestUser(host, "Alice")`, `hostCreatesRoom(host)`
   - **Expect:** 6-character code returned, code visible on host within 10s

2. Guest joins with code
   - **Do:** `setTestUser(guest, "Bob")`, `guestJoinsRoom(guest, code)`
   - **Expect:** Both devices show each other's player name within 5s

3. Host configures pack/mode via WS
   - **Do:** `hostSelectsPack(host, "pack-test")`, `hostSelectsMode(host, "classic")`
   - **Expect:** Both devices reflect the pack name

## Assertions

- [ ] Room code is 6 characters
- [ ] Both players see each other after join
- [ ] Host WS pack selection syncs to guest

## Notes

Multi-device tests must run in serial mode because the server uses in-memory rooms keyed by clerkId.
