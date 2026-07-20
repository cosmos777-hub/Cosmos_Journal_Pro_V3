// Sprint 1 — ARCH-001 (Livraison 2) : données par défaut déplacées telles quelles
// depuis main.js. Utilisées par core/storage.js et core/migrations.js.

export const defaults = {
  accounts: [
    {
      id: "acc-personal-40",
      name: "Compte Perso 40$",
      type: "Fonds propres",
      initialCapital: 40,
      currentCapital: 40,
      currency: "USD",
      color: "#5aa7ff",
      createdAt: new Date().toISOString(),
      archived: false
    }
  ],
  settings: {
    assets: ["EUR/USD", "GBP/USD", "XAU/USD", "BTC/USD"],
    sessions: ["Asie", "Londres", "New York"],
    htf: ["Weekly", "Daily", "H4", "H1"],
    ltf: ["M15", "M5", "M1"],
    strategies: ["Strat 1 - OB/BPR", "Strat 2 - OB/POC/LIQ"],
    confluences: ["Structure", "Liquidité", "OB", "FVG", "SMT", "Volume"],
    emotionalCauses: ["Sortie anticipée", "Déplacement SL", "FOMO", "Revenge", "Peur", "Hésitation"],
    tags: ["A revoir", "Setup A+", "Erreur", "Patience"]
  },
  preferences: {
    theme: "dark",
    activeSettingsCategory: "accounts",
    // UX-003 (Sprint 3, Livraison 2A — D-017) : historique du Journal fermé
    // par défaut, état persisté au même titre que le thème.
    historyCollapsed: true
  }
};