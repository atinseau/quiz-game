# Scenario: Lobby — toggle gender ♂/♀

**Status:** covered
**Priority:** medium
**Page:** lobby
**Domain:** multi
**Spec:** multi-lobby

## Preconditions

- Host + guest in a lobby at /play/lobby/{code}
- Required mocks: Strapi packs, Clerk auth, WS user override, mock Strapi on :1337
- Initial state: both players default to ♂ Homme

## Steps

1. Host + guest join a room
   - **Do:** `hostCreatesRoom` + `guestJoinsRoom`
   - **Expect:** Both rows visible; host sees own gender buttons, guest sees host's gender as a read-only Badge

2. Check the default gender propagation
   - **Do:** read the host row's badge on the guest page (`data-slot="badge"`)
   - **Expect:** Badge text is "♂ Homme"

3. Host flips to Femme
   - **Do:** `host.getByRole("button", { name: "♀ Femme", exact: true }).click()`
   - **Expect:** Guest's badge for the host row updates to "♀ Femme" within 5s

## Assertions

- [x] Host row renders a Badge on non-host devices
- [x] Default badge text matches the server default gender (Homme)
- [x] Host clicking Femme propagates over WS and updates the guest's badge

## Notes

The first version of the test asserted an `[active]`/`data-active` attribute on
the clicked button — that attribute does not exist (active state is CSS-only).
Rewritten to assert guest-side propagation, which is what a real user sees.
