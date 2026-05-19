# World Developer Portal setup

Use these values in the World Developer Portal for the demo:

- **App name:** WorldPrize
- **Legacy App ID:** `app_25d16ee7904752aca5fef279f2fe11c7`
- **RP ID:** `rp_3d1c7269a4c866a7`
- **Action for the free-entry flow:** `worldprize-free-entry-demo`

## App URLs

- **Mock/static demo:** `https://abhidya.github.io/WorldPrize/`
- **Real Mini App deployment:** your Vercel or Cloudflare deployment URL

GitHub Pages should be treated as mock-only because it cannot host the server-side verification route that World ID v4 requires.

## Recommended portal settings

- Point the App URL to the real deployed demo URL, not GitHub Pages.
- Add the deployed domain to the allowed/additional domains list.
- Keep the demo focused on the free-entry route rather than gating the entire app.
- Do **not** enable app-wide Verified Humans Only unless you intentionally want every route gated.
- Create the action `worldprize-free-entry-demo`.

## Secret handling

- Keep `WORLD_SIGNING_KEY` server-side only.
- Never expose the signing key in client bundles, client config, or public env files.

## Hosting note

- GitHub Pages is fine for the mock/static demo only.
- Real World ID mode needs a backend or serverless endpoint for verification.
- Vercel, Cloudflare Functions, or Netlify Functions are suitable serverless targets.

## Deployment reminder

Use `WORLDPRIZE_MODE=mock` for local demos and GitHub Pages. Use `WORLDPRIZE_MODE=real` on the deployed app that has API routes for `/api/world/sign`, `/api/world/verify`, and `/api/enter`.
