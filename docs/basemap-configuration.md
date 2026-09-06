# Basemap configuration

The map on `/community/map` renders CARTO raster basemaps through Leaflet.
**CARTO now requires an API key** for those tiles
(<https://carto.com/basemaps/apikey/>). An unauthenticated request still returns
HTTP 200 and a valid PNG — but the PNG is a grey tile stamped
`API KEY REQUIRED`, which is what was visible on production on 6 September 2026.

Because the failing response is a *success*, Leaflet's `tileerror` never fires.
Nothing in the app can detect the watermark at runtime, so this is handled as a
configuration concern instead.

## The variable

| Variable | Where | Value |
|---|---|---|
| `VITE_CARTO_API_KEY` | Replit **Secrets**, on the deployment that runs `npm run build` | The project's CARTO basemap API key |

Notes:

- `VITE_*` variables are **embedded into the client bundle at build time** and
  are visible in the browser and in network requests. Use only a key scoped to
  basemap tiles. Never put an administrative or account-level credential here.
- Setting it at runtime is not enough. The app must be **rebuilt** after the
  value changes (`npm run build`, then redeploy).
- Do not commit the key. It does not belong in `.replit`, `.env.example` or any
  tracked file.
- CARTO notes that already-cached tiles can keep rendering the old watermark
  after a fix. Verify with a hard reload / fresh profile, not a warm cache.

## What happens without the key

`client/src/lib/mapTiles.ts` marks the CARTO styles (Light, Dark) unavailable.
The app then:

- never adds a key-required tile layer to the map,
- hides Light/Dark from the map style picker,
- shows an explicit **"Map background unavailable"** panel on the map surface,
  stating the reason and offering **Retry**, **View activity** and a switch to
  **Satellite** (Esri imagery, which needs no key),
- keeps the nearby incident count and the activity list reachable.

Required provider attribution is retained in every case, and no watermark is
hidden with CSS.

## Verifying a fix

1. Build with the key set, deploy, then open the map in a **fresh** browser
   profile at 390 × 844 and on desktop, in both light and dark themes.
2. Pan, zoom, resize, navigate away and back. Tiles must fill the map each time.
3. Check the rendered images, not just the network panel — a watermarked tile is
   an HTTP 200.
4. Confirm the CARTO and OpenStreetMap attribution is still visible.
