// Sprint 1 — ARCH-001 (Livraison 3) : cache DOM partagé, référence mutable unique.
// Tous les modules ui/* importent cette même référence : ui.cache() (dans
// components.js) la peuple une fois au démarrage, tous les autres modules la lisent.
export const dom = {};