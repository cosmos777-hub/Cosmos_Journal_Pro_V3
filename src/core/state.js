// Sprint 1 — ARCH-001 (Livraison 2) : conteneur d'état applicatif, déplacé tel quel
// depuis main.js. C'est un objet mutable partagé : les modules qui l'importent
// mutent ses propriétés directement (state.data = ..., state.currentCard = ...),
// exactement comme avant le découpage — aucun changement de comportement.
export const state = {
  data: null,
  selectedAsset: "",
  selectedStrategy: "",
  editingTradeId: null,
  currentCard: 1,
  selectedDirection: "Buy",
  selectedSetupQuality: 0,
  selectedConfluences: [],
  selectedEmotionalCause: "",
  selectedEmotionalCausesSecondary: [],
  selectedManualIntervention: "Non",
  // UX-004 (Dynamic Tag Chips) : tags sélectionnés dans le Wizard, même famille
  // que selectedConfluences/selectedEmotionalCausesSecondary (multi-sélection).
  selectedTags: [],
  currentView: "dashboard",
  // MEDIA-001 (Livraison C) : identifiant de travail utilisé pour écrire dans
  // mediaStorage AVANT que le trade soit enregistré (Workflow First — ajouter une
  // capture ne doit jamais attendre la sauvegarde du trade). Généré une seule fois
  // par formulaire de création via journalUi.ensureDraftTradeId(), repris comme
  // trade.id définitif à la sauvegarde (actions.createTrade). Nettoyé (et ses
  // captures orphelines supprimées) par actions.resetTradeForm() si l'utilisateur
  // abandonne sans enregistrer. Reste `null` en mode édition : startEditTrade()
  // utilise directement l'id du trade existant, jamais de draft dans ce cas.
  draftTradeId: null,
  // Miroir local de trade.media pendant la création (avant que le trade existe dans
  // state.data.trades). En mode édition, les captures sont écrites directement sur
  // le trade existant (state.data.trades) — ce champ n'est alors pas utilisé.
  draftMedia: { htf: null, ltf: null, result: null }
};
