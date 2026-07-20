// Sprint 1 — ARCH-001 (Livraison 1) : fonctions de formatage pures, déplacées telles
// quelles depuis l'objet `utils` de app.js. Comportement inchangé.

export function formatPercent(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

// Milestone 2C : formate une valeur en multiples de R (Document 05), utilisé par
// l'historique pour afficher réel/plan/delta de façon uniforme, legacy ou V3-8cartes.
export function formatR(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}R`;
}

export function tone(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}