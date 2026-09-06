/**
 * Basemap tile configuration — one source of truth for every map surface.
 *
 * Why this file exists
 * --------------------
 * CARTO's public basemaps now require an API key. Unauthenticated requests
 * still return HTTP 200 with a valid PNG, but that PNG is a grey tile stamped
 * "API KEY REQUIRED". Because the response is a success, Leaflet's `tileerror`
 * event never fires and nothing in the app notices. The watermark was visible
 * on production on both mobile and desktop.
 *
 * See https://carto.com/basemaps/apikey/ for the key requirement and the note
 * that already-cached tiles can keep rendering for a while after a fix.
 *
 * Configuration
 * -------------
 * `VITE_CARTO_API_KEY` is read at **build time** and is embedded in the client
 * bundle, so it is visible in the browser and in network requests. Only ever
 * put a basemap-scoped public key here — never an administrative credential.
 * It must be set in the environment that runs `npm run build` (Replit), not
 * only at runtime, and the app must be rebuilt after it changes.
 *
 * Behaviour without a key
 * -----------------------
 * We do not ship key-required tiles and we do not quietly swap in a different
 * provider. A style whose provider is not configured reports itself as
 * unavailable, and the map surface shows an explicit "basemap unavailable"
 * state with Retry, a route to the activity list, and — because Esri satellite
 * imagery needs no key — an offer to switch to a style that does work.
 * Incident data stays reachable either way.
 */

export type MapStyle = "light" | "dark" | "satellite";

export interface MapStyleConfig {
  /** Leaflet URL template, already carrying any required credentials. */
  url: string;
  /** Required provider attribution. Never strip this. */
  attribution: string;
  label: string;
  /** Tile subdomains, or `[]` for providers that do not shard. */
  subdomains: string[];
  maxZoom: number;
  /**
   * False when the provider needs configuration this build does not have.
   * Callers must not add such a layer to the map.
   */
  available: boolean;
  /** Human-readable reason, present only when `available` is false. */
  unavailableReason?: string;
}

/**
 * Build-time key. Vite replaces `import.meta.env.VITE_*` literally, so this
 * must stay a direct property access — a computed lookup is not substituted.
 */
const CARTO_API_KEY: string = (import.meta.env?.VITE_CARTO_API_KEY ?? "").trim();

export const hasCartoKey = CARTO_API_KEY.length > 0;

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const CARTO_UNCONFIGURED =
  "This basemap style needs a CARTO API key, which this build does not have.";

/** `https://{s}.basemaps.cartocdn.com/<style>/{z}/{x}/{y}{r}.png?api_key=…` */
function cartoUrl(styleId: string): string {
  const base = `https://{s}.basemaps.cartocdn.com/${styleId}/{z}/{x}/{y}{r}.png`;
  return hasCartoKey ? `${base}?api_key=${encodeURIComponent(CARTO_API_KEY)}` : base;
}

export const MAP_STYLES: Record<MapStyle, MapStyleConfig> = {
  light: {
    url: cartoUrl("light_all"),
    attribution: CARTO_ATTRIBUTION,
    label: "Light",
    subdomains: ["a", "b", "c"],
    maxZoom: 19,
    available: hasCartoKey,
    unavailableReason: hasCartoKey ? undefined : CARTO_UNCONFIGURED,
  },
  dark: {
    url: cartoUrl("dark_all"),
    attribution: CARTO_ATTRIBUTION,
    label: "Dark",
    subdomains: ["a", "b", "c"],
    maxZoom: 19,
    available: hasCartoKey,
    unavailableReason: hasCartoKey ? undefined : CARTO_UNCONFIGURED,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      'Imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    label: "Satellite",
    subdomains: [],
    maxZoom: 19,
    available: true,
  },
};

export const MAP_STYLE_ORDER: MapStyle[] = ["light", "dark", "satellite"];

/** Styles this build can actually render. */
export function availableMapStyles(): MapStyle[] {
  return MAP_STYLE_ORDER.filter((style) => MAP_STYLES[style].available);
}

/**
 * The style to open with: the caller's preference when it works, otherwise the
 * first style that does. Returns `null` when no provider is configured at all,
 * which is the caller's signal to render the unavailable state instead of a
 * blank grey map.
 */
export function resolveInitialStyle(preferred: MapStyle): MapStyle | null {
  if (MAP_STYLES[preferred].available) return preferred;
  return availableMapStyles()[0] ?? null;
}

/**
 * A run of tile errors long enough to mean the basemap is not serving, rather
 * than the one or two dropped tiles that are normal at the edge of a pan.
 */
export const TILE_FAILURE_RUN = 4;

export interface TileHealthWatcher {
  /** Bind to Leaflet's `tileerror`. */
  tileerror(): void;
  /** Bind to Leaflet's `tileload`. */
  tileload(): void;
  /** Bind to Leaflet's `load`. */
  load(): void;
  /** Forget the current batch — for an explicit retry. */
  reset(): void;
}

/**
 * Tile-failure state machine for one Leaflet grid layer.
 *
 * Leaflet fires `load` when the visible batch has **settled**, not when it has
 * succeeded: `_tileReady` marks an errored tile loaded and fires `load` as soon
 * as nothing is outstanding. Treating `load` as recovery therefore clears the
 * failure state even when every tile in the batch failed, so the "Map
 * background unavailable" notice appears and then disappears over a blank map.
 *
 * `tileload` is the only event that means a tile actually rendered, so recovery
 * is decided from what the batch produced:
 *
 * - nothing rendered and something failed → failing, however short the batch
 *   (a two-tile batch never reaches {@link TILE_FAILURE_RUN});
 * - something rendered and failures stayed below the run threshold → serving;
 * - otherwise the current state stands until the next batch settles.
 */
export function createTileHealthWatcher(
  onChange: (failing: boolean) => void,
): TileHealthWatcher {
  let failures = 0;
  let rendered = 0;

  return {
    tileerror() {
      failures += 1;
      if (failures >= TILE_FAILURE_RUN) onChange(true);
    },
    tileload() {
      rendered += 1;
    },
    load() {
      if (rendered === 0 && failures > 0) {
        onChange(true);
      } else if (rendered > 0 && failures < TILE_FAILURE_RUN) {
        onChange(false);
      }
      failures = 0;
      rendered = 0;
    },
    reset() {
      failures = 0;
      rendered = 0;
      onChange(false);
    },
  };
}
