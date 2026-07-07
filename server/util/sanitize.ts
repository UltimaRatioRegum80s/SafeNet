export function sanitizePlainText(input: unknown, max = 1000) {
  const s = String(input ?? "").trim().slice(0, max);
  // Escape HTML entities so text is safe to render
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}