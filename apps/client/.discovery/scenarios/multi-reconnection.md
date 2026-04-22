# Scenario: Multi-device reconnection

**Status:** blocked
**Priority:** high
**Page:** lobby
**Domain:** multi
**Spec:** --

## Preconditions

- E2E cannot exercise mid-navigation reconnection: `setTestUser` in
  `tests/helpers/multi-fixtures.ts` injects the WS override only at page init.

## Steps

1. Acknowledge E2E limitation
   - **Do:** documented in `tests/helpers/multi-fixtures.ts` and in the server
     reconnection unit tests
   - **Expect:** no E2E test exists; authoritative coverage lives in server unit
     tests (grace-period reconnection logic)

## Assertions

- [ ] Server-side reconnection is covered by unit tests (outside the E2E scope)

## Notes

The former E2E reconnection test was removed because the WS override cannot be
re-injected mid-navigation. Status is `blocked` (not `covered`) since the
nightwatch contract requires a real spec file for `covered`. Reopen if a way is
found to swap the WS implementation mid-session.
