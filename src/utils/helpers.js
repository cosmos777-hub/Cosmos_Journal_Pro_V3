// Sprint 1 — ARCH-001 (Livraison 1) : fonctions utilitaires génériques et pures,
// déplacées telles quelles depuis l'objet `utils` de app.js. Comportement inchangé.

export function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function escape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}