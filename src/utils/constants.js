// Sprint 1 — ARCH-001 (Livraison 1) : constantes globales déplacées telles quelles
// depuis app.js. Aucune valeur ni logique modifiée.

export const APP_VERSION = "3.0";
export const STORAGE_KEY = "cosmos_v3_data";

// Milestone 5B (Document 06 §7) : nombre de trades affichés dans les listes d'historique.
// Purement un plafond d'AFFICHAGE — toutes les données restent en mémoire et exploitables
// sans limite via les filtres Analytics (3B/3C).
export const HISTORY_DISPLAY_LIMIT = 150;

export const LEGACY_TRADES_KEY = "cosmos_trades";
export const LEGACY_PREFS_KEY = "cosmos_prefs";

// Règle métier centralisée (Document 02, Carte 1) : les paliers de risque disponibles
// dépendent strictement du type de compte. Ce n'est pas une liste personnalisable
// (contrairement aux actifs/stratégies/sessions) : c'est une règle produit fixe.
export const RISK_LEVELS_BY_ACCOUNT_TYPE = {
  "Prop Firm": [0.25, 0.5, 0.75, 1],
  "Fonds propres": [5, 7.5, 10, 12.5, 15]
};

export function riskLevelsFor(accountType) {
  return RISK_LEVELS_BY_ACCOUNT_TYPE[accountType] || RISK_LEVELS_BY_ACCOUNT_TYPE["Fonds propres"];
}