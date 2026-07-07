export type PopupData = {
  id: string;
  type: string;
  severity?: string;
  description?: string;
  optimistic?: boolean;
  offline?: boolean;
  createdAt?: string;
  lat?: number;
  lng?: number;
};

export function renderPopupHTML(data: PopupData) {
  const status = false && data.offline // DISABLED: no more "Saved offline" 
    ? `<div class="nn-popup__status nn-popup__status--offline">⏳ Saved offline — will auto-send when online</div>`
    : data.optimistic
    ? `<div class="nn-popup__status nn-popup__status--optimistic">⚡ Submitting…</div>`
    : "";

  const desc = data.description
    ? `<div class="nn-popup__desc">${escapeHTML(data.description)}</div>`
    : "";

  const navButton = (data.lat != null && data.lng != null)
    ? `<button
        class="nn-popup__navigate"
        data-navigate-lat="${data.lat}"
        data-navigate-lng="${data.lng}"
        aria-label="Show incident on map"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        Show on map
      </button>`
    : "";

  return `
    <div class="nn-popup">
      <div class="nn-popup__header">
        <div class="nn-popup__type">${prettyType(data.type)}</div>
        <div class="nn-popup__sev nn-popup__sev--${data.severity || 'low'}">${data.severity || 'low'}</div>
      </div>
      ${status}
      ${desc}
      ${data.createdAt ? `<div class="nn-popup__meta">Reported ${new Date(data.createdAt).toLocaleString()}</div>` : ""}
      ${navButton}
    </div>
  `;
}

const prettyType = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase());
const escapeHTML = (s: string) => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]!));
