# World Developer Portal setup

Use these values in the World Developer Portal for the demo:

- **App name:** WorldPrize
- **Legacy App ID:** `app_25d16ee7904752aca5fef279f2fe11c7`
- **RP ID:** `rp_3d1c7269a4c866a7`
- **Action for the free-entry flow:** `worldprize-free-entry-demo`

## Recommended portal settings

- Point the App URL to the deployed demo URL.
- Add the deployed domain to the allowed/additional domains list.
- Keep the demo focused on the free-entry route rather than gating the entire app.
- Do **not** enable app-wide Verified Humans Only unless you intentionally want every route gated.

## Secret handling

- Keep `WORLD_SIGNING_KEY` server-side only.
- Never expose the signing key in client bundles, client config, or public env files.

## Hosting note

- GitHub Pages is fine for the mock/static demo only.
- Real World ID mode needs a backend or serverless endpoint for verification.
- Vercel, Cloudflare Functions, or Netlify Functions are suitable serverless targets.

