# Interview demo script

## 30-second framing

“WorldPrize is a small reference integration that shows how World ID can protect the no-purchase free-entry path in instant-win promotions. Product codes still work, but the free route becomes one verified human per day instead of an unlimited bot target.”

If asked about hosting, say:

- GitHub Pages is mock-only.
- The real Mini App URL must be a deployed app on Vercel or Cloudflare because World ID v4 needs backend verification routes.

## 2-minute demo

1. Open the landing page.
2. Show the two entry cards:
   - product code
   - free daily World ID entry
3. Enter `SNACK-123` and show the result.
4. Enter the same code again and show `CODE_USED`.
5. Enter the free-entry path as `Alice` or `Bob`.
6. Enter the same human again and show `ALREADY_ENTERED`.
7. Run the abuse simulator buttons.
8. Open the public audit page and point out the masked nullifiers.

## If the interviewer asks about modes

- `WORLDPRIZE_MODE=mock` keeps the demo self-contained and uses mock humans.
- `WORLDPRIZE_MODE=real` uses the real World App / IDKit flow, server-side signing, and backend verification.

## Closing line

“This does not replace legal compliance. It shows a privacy-preserving way to make the free-entry path much harder to farm.”
