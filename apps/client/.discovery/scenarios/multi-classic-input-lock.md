# Scenario: Multi classic — answer inputs locked on non-active device

**Status:** covered
**Priority:** critical
**Page:** multi-game
**Domain:** multi
**Spec:** multi-classic-flow

## Preconditions

- Host + guest joined a lobby, classic mode selected
- Required mocks: Strapi packs, Clerk auth, WS user override, mock Strapi on :1337
- Initial state: game has started, first question is live, one of the two players is the active player

## Steps

1. Start a 2-player classic game
   - **Do:** `setTestUser` on host + guest, `hostCreatesRoom`, `guestJoinsRoom`, `hostSelectsPack`, `hostSelectsMode(host, "classic")`, `hostStartsGame`
   - **Expect:** Both devices navigate to /game, first question visible

2. Identify active and non-active devices
   - **Do:** On each device, read the turn label
   - **Expect:** One device shows "C'est ton tour !", the other shows "C'est au tour de {name}"

3. Inspect answer buttons on non-active device
   - **Do:** Read QCM / Vrai / Faux / text input state on the non-active device
   - **Expect:** All answer inputs carry the `[disabled]` attribute

4. Inspect answer buttons on active device
   - **Do:** Read the same inputs on the active device
   - **Expect:** Inputs are enabled (no `[disabled]`)

## Assertions

- [x] Non-active device shows "C'est au tour de {name}"
- [x] Non-active device has answer inputs disabled
- [x] Active device shows "C'est ton tour !"
- [x] Active device has answer inputs enabled

## Notes

Validated live on 2026-04-20 with a Vrai/Faux question ("Le soleil se lève à l'ouest."). Both Vrai and Faux buttons carried `[disabled]` on the non-active device. This is the classic counterpart to the voleur-input-lock scenario.
