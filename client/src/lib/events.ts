// Custom event utilities for type-safe event handling
export const beginLocationPick = () =>
  window.dispatchEvent(new CustomEvent("nn:begin-location-pick"));

export const emitLocationPicked = (lat: number, lng: number) =>
  window.dispatchEvent(new CustomEvent<{lat: number; lng: number}>("nn:location-picked", { detail: { lat, lng } }));