import { RoutePaths } from "@/router/routePaths";

// Map sharing functionality
export async function shareMap(url = window.location.origin + RoutePaths.Map) {
  if (navigator.share) {
    await navigator.share({ title: "NaborNet Map", url });
  } else {
    await navigator.clipboard.writeText(url);
    // Could show a toast here: "Map link copied to clipboard"
  }
}