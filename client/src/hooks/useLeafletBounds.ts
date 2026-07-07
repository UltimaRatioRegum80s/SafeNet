import { useEffect, useState } from "react";
import type { Map as LeafletMap, LatLngBounds } from "leaflet";

export type BBox = { north: number; south: number; east: number; west: number };

export default function useLeafletBounds(map: LeafletMap | null) {
  const [bbox, setBbox] = useState<BBox | null>(null);

  useEffect(() => {
    if (!map) return;
    const update = () => {
      const b: LatLngBounds = map.getBounds();
      setBbox({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
    };
    update();
    map.on("moveend zoomend", update);
    return () => { map.off("moveend zoomend", update); };
  }, [map]);

  return bbox;
}