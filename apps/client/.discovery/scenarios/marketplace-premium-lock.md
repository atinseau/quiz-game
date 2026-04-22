# Scenario: Marketplace — premium pack lock and price

**Status:** covered
**Priority:** critical
**Page:** home
**Domain:** solo
**Spec:** marketplace

## Preconditions

- URL: /play/solo (auth bypass)
- Required mocks: packs API with one free + one premium pack (price 2.99€), purchases API returning empty
- Initial state: home with pack grid

## Steps

1. Navigate with custom mocks
   - **Do:** Override `/api/question-packs` with free + premium pack, stub `/api/purchases/me` with []
   - **Expect:** Both cards load

2. Verify premium pack shows price
   - **Do:** Read "2.99€" text
   - **Expect:** Price badge visible on premium card

3. Verify free pack still visible
   - **Do:** Read "Pack Gratuit"
   - **Expect:** Free pack card present

## Assertions

- [ ] Premium pack card renders a price badge
- [ ] Free pack card renders without price badge

## Notes

Purchase check is performed on page load — user has no purchase, so premium remains locked.
