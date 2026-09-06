/**
 * Tile-failure detection for the map basemap.
 *
 * Regression cover for a defect found in review: Leaflet fires `load` when the
 * visible tile batch has *settled*, including when every tile in it errored, so
 * treating `load` as recovery made the "Map background unavailable" notice
 * appear and then vanish over a blank map.
 *
 * These tests replay the exact event orders Leaflet emits (see
 * `GridLayer._tileReady`: `tileerror` per failure, `tileload` per success, then
 * one `load` once nothing is outstanding).
 */
import { describe, it, expect } from "vitest";
import { createTileHealthWatcher, TILE_FAILURE_RUN } from "@/lib/mapTiles";

/** Records every state change the watcher reports. */
function watch() {
  const changes: boolean[] = [];
  let state = false;
  const watcher = createTileHealthWatcher((next) => {
    changes.push(next);
    state = next;
  });
  return { watcher, changes, failing: () => state };
}

describe("createTileHealthWatcher", () => {
  it("stays quiet while tiles load", () => {
    const { watcher, changes, failing } = watch();
    for (let i = 0; i < 8; i++) watcher.tileload();
    watcher.load();
    expect(changes).toEqual([false]);
    expect(failing()).toBe(false);
  });

  it("ignores a short run of dropped tiles at the edge of a pan", () => {
    const { watcher, changes } = watch();
    for (let i = 0; i < TILE_FAILURE_RUN - 1; i++) watcher.tileerror();
    for (let i = 0; i < 8; i++) watcher.tileload();
    watcher.load();
    expect(changes).not.toContain(true);
  });

  it("reports a failure once the run threshold is reached", () => {
    const { watcher, failing } = watch();
    for (let i = 0; i < TILE_FAILURE_RUN; i++) watcher.tileerror();
    expect(failing()).toBe(true);
  });

  it("keeps reporting the failure after Leaflet settles a fully failed batch", () => {
    // The defect: `load` fires here, because every errored tile is still
    // marked loaded and nothing is left outstanding.
    const { watcher, failing } = watch();
    for (let i = 0; i < 12; i++) watcher.tileerror();
    watcher.load();
    expect(failing()).toBe(true);
  });

  it("reports a failure when a batch too small to reach the threshold fails entirely", () => {
    const { watcher, failing } = watch();
    watcher.tileerror();
    watcher.tileerror();
    watcher.load();
    expect(failing()).toBe(true);
  });

  it("stays failing while every subsequent batch also fails", () => {
    const { watcher, failing } = watch();
    for (let batch = 0; batch < 3; batch++) {
      for (let i = 0; i < 6; i++) watcher.tileerror();
      watcher.load();
      expect(failing()).toBe(true);
    }
  });

  it("clears once tiles render again", () => {
    const { watcher, failing } = watch();
    for (let i = 0; i < 6; i++) watcher.tileerror();
    watcher.load();
    expect(failing()).toBe(true);

    for (let i = 0; i < 8; i++) watcher.tileload();
    watcher.load();
    expect(failing()).toBe(false);
  });

  it("does not clear on a batch that rendered nothing at all", () => {
    // Leaflet also fires `load` when the visible tiles were already present,
    // with neither errors nor loads. That says nothing new, so the current
    // state must stand.
    const { watcher, failing } = watch();
    for (let i = 0; i < 6; i++) watcher.tileerror();
    watcher.load();
    watcher.load();
    expect(failing()).toBe(true);
  });

  it("does not clear on a batch that mostly failed", () => {
    const { watcher, failing } = watch();
    for (let i = 0; i < 6; i++) watcher.tileerror();
    watcher.load();

    watcher.tileload();
    for (let i = 0; i < TILE_FAILURE_RUN; i++) watcher.tileerror();
    watcher.load();
    expect(failing()).toBe(true);
  });

  it("counts failures per batch, not for the life of the layer", () => {
    const { watcher, failing } = watch();
    for (let batch = 0; batch < 4; batch++) {
      watcher.tileerror();
      for (let i = 0; i < 8; i++) watcher.tileload();
      watcher.load();
    }
    expect(failing()).toBe(false);
  });

  it("clears and forgets the failed batch on retry", () => {
    const { watcher, failing } = watch();
    for (let i = 0; i < 6; i++) watcher.tileerror();
    expect(failing()).toBe(true);

    watcher.reset();
    expect(failing()).toBe(false);

    // The retried batch drops one tile and serves the rest: the pre-retry
    // count must not carry over and re-trip the threshold.
    watcher.tileerror();
    for (let i = 0; i < 8; i++) watcher.tileload();
    watcher.load();
    expect(failing()).toBe(false);
  });
});
