import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "@/styles/markers.css";
import "@/styles/nn-cluster.css";
import "@/styles/nn-popup.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { registerServiceWorker } from "./lib/serviceWorker";
import { setupOnlineListener, syncPendingIncidents } from "./lib/syncEngine";
import { purgeOldIncidents } from "./lib/offlineDb";

registerServiceWorker().then(() => {
  console.log('[App] Service worker registered');
});

setupOnlineListener();

purgeOldIncidents(7).then((count) => {
  if (count > 0) {
    console.log(`[App] Purged ${count} old pending incidents`);
  }
});

createRoot(document.getElementById("root")!).render(<App />);
