// Sprint 1 — ARCH-001 (Livraison 3) : rendu de la vue Insights (Forces/Faiblesses/
// Opportunités/Recommandations, état vide intelligent), déplacé tel quel depuis main.js.
import { dom } from "./dom.js";
import { state } from "../core/state.js";
import { calculations } from "../core/calculations.js";
import { utils } from "../utils/index.js";

export const insightsUi = {
        renderInsights() {
          if (!dom["insights-content"]) return;
          const result = calculations.generateInsights(state.data.trades, state.data.accounts);

          if (!result.ready) {
            dom["insights-empty-state"].classList.remove("hidden");
            dom["insights-content"].classList.add("hidden");
            const remaining = result.minSample - result.sampleSize;
            dom["insights-empty-copy"].textContent = `Ajoutez encore ${remaining} trade${remaining > 1 ? "s" : ""} (${result.sampleSize}/${result.minSample}) pour obtenir une analyse fiable.`;
            return;
          }

          dom["insights-empty-state"].classList.add("hidden");
          dom["insights-content"].classList.remove("hidden");

          const byType = {
            force: dom["insights-forces"],
            faiblesse: dom["insights-faiblesses"],
            opportunite: dom["insights-opportunites"],
            recommandation: dom["insights-recommandations"]
          };

          Object.entries(byType).forEach(([type, container]) => {
            const items = result.insights.filter(i => i.type === type);
            container.innerHTML = items.length
              ? items.map(i => `<article class="trade-row" style="grid-template-columns:1fr;"><p class="trade-title" style="font-weight:500;">${utils.escape(i.text)}</p></article>`).join("")
              : `<p class="muted">Rien de significatif pour l'instant.</p>`;
          });
        },
        // Milestone 2C : navigation du formulaire 8 cartes (Document 03 : barre de progression,
        // Mode Focus). currentCard reste borné entre 1 et 8 quel que soit l'appel.
};