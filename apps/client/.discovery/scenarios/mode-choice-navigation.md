# Scenario: Mode choice navigation

**Status:** discovered
**Priority:** high
**Page:** mode-choice
**Domain:** e2e

## Preconditions

- URL: /play (requires auth bypass in tests)
- Required mocks: Strapi packs API, Clerk auth
- Initial state: signed in user on /play

## Steps

1. Verify mode choice screen
   - **Do:** navigate to /play
   - **Expect:** "Comment tu veux jouer ?" title, 3 buttons

2. Click "Un seul appareil"
   - **Do:** click solo button
   - **Expect:** Navigate to /play/solo (HomeScreen with pack selection)

3. Click "Rejoindre"
   - **Do:** go back, click Rejoindre
   - **Expect:** Navigate to /play/join (code input screen)

## Assertions

- [ ] Title visible
- [ ] Solo, Create, Join buttons visible
- [ ] Solo navigates to /play/solo
- [ ] Join navigates to /play/join
