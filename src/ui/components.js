// Sprint 1 — ARCH-001 (Livraison 3) : composants communs et orchestration UI,
// déplacés tels quels depuis main.js. cache()/render() sont le point d'entrée qui
// assemble et rafraîchit toutes les vues ; renderChips/renderChecklist/setKpi/
// openModal/closeModal/toast sont des helpers réutilisés par Dashboard, Journal,
// Analytics, Insights et Settings.
//
// ─────────────────────────────────────────────────────────────────────────────
// Sprint 1 — ARCH-003 : Catalogue des composants génériques (Design System)
// ─────────────────────────────────────────────────────────────────────────────
// Identifiés par audit (Livraison 1), implémentés en Livraison 2, validés en
// Livraison 3. Utilisables partout via `this.xxx(...)` (méthodes de l'objet `ui`
// fusionné dans main.js) ou `ui.xxx(...)` depuis l'extérieur.
//
// • badge(toneClass, label) → string HTML
//     Pastille colorée. toneClass ∈ {"positive","negative","neutral"} (utils.tone(valeur)).
//     Exemple : this.badge(utils.tone(5), "+5.00R")
//     → <span class="badge positive">+5.00R</span>
//
// • emptyState(title, message) → string HTML
//     État vide standard (titre + message). À injecter directement dans .innerHTML.
//     Exemple : container.innerHTML = this.emptyState("Aucun trade", "Ajoutez-en un.")
//
// • tradeRow({ title, meta, notes?, badges?, actions? }) → string HTML
//     Carte de ligne bordée (utilisée par l'historique Journal et la liste Analytics).
//     - title, meta : string déjà échappées par l'appelant (utils.escape).
//     - notes : string optionnelle, affichée sur une ligne séparée si non vide.
//     - badges : tableau de { tone, label }, un badge() par élément.
//     - actions : string HTML optionnelle (ex: boutons Modifier/Supprimer).
//     Non utilisé par insights.js, qui a une mise en page à une seule colonne
//     structurellement différente (voir commentaire dans insights.js) — l'utiliser
//     là-bas en aurait fait un composant "fourre-tout" (Doc ARCH-003 §6).
// ─────────────────────────────────────────────────────────────────────────────
import { dom } from "./dom.js";
import { state } from "../core/state.js";
import { utils } from "../utils/index.js";

export const componentsUi = {
        cache() {
          [
            "account-select", "account-type-preview", "asset-options", "strategy-options",
            "session-select", "timeframe-select", "htf-select", "combo-preview",
            "risk-select", "risk-amount-preview", "gestion-risk-summary",
            "trade-date", "entry-time", "exit-time", "duration-preview",
            "direction-options", "direction-value",
            "setup-quality-stars", "setup-quality-value", "confluences-options",
            "rr-planned", "rr-obtained-display", "plan-respect-select",
            "result-currency-input", "result-percent-display", "trade-status-display",
            "theoretical-result-display", "real-result-display", "emotional-delta-display",
            "emotional-cause-options", "emotional-cause-value", "emotional-causes-secondary-options",
            "manual-intervention-options", "manual-intervention-value",
            "notes", "tags-options", "capture-slots",
            "validation-summary", "wizard-prev", "wizard-next", "wizard-progress-fill", "wizard-step-label",
            "trade-form", "journal-panel", "history-panel",
            // UX-003 (Sprint 3, Livraison 2A) : historique repliable.
            "history-toggle", "history-toggle-icon", "history-collapsible",
            "trade-list", "history-subtitle", "kpi-real", "kpi-theoretical", "kpi-delta",
            "kpi-count", "delta-note", "settings-modal", "settings-nav", "settings-content",
            "export-modal", "export-output", "import-modal", "import-input", "import-file", "import-feedback",
            "toast-stack", "feature-registry", "data-version",
            "capture-viewer-modal", "capture-viewer-image",
            // Milestone 3A : KPI enrichis + navigation multi-vues.
            "kpi-capital", "kpi-winrate", "kpi-profit-factor", "kpi-expectancy", "kpi-drawdown",
            "kpi-avg-rr", "kpi-avg-duration", "kpi-plan-respect",
            "view-dashboard", "view-journal", "view-analytics", "view-insights",
            // Milestone 3B : filtres et KPI de la vue Analytics.
            "analytics-filter-account", "analytics-filter-asset", "analytics-filter-session",
            "analytics-filter-htf", "analytics-filter-ltf", "analytics-filter-strategy",
            "analytics-filter-date-from", "analytics-filter-date-to", "analytics-filter-reset", "analytics-filter-note",
            "analytics-kpi-count", "analytics-kpi-real", "analytics-kpi-theoretical", "analytics-kpi-delta",
            "analytics-kpi-winrate", "analytics-kpi-profit-factor", "analytics-kpi-expectancy",
            "analytics-kpi-avg-rr", "analytics-kpi-avg-duration", "analytics-kpi-plan-respect",
            "analytics-trade-list", "breakdown-dimension", "breakdown-table",
            "insights-empty-state", "insights-empty-copy", "insights-content",
            "insights-forces", "insights-faiblesses", "insights-opportunites", "insights-recommandations",
            "digital-twin-chart", "digital-twin-gap", "mission-title", "mission-copy"
          ].forEach(id => {
            dom[id] = document.getElementById(id);
          });
        },
        render() {
          document.documentElement.dataset.theme = state.data.preferences.theme === "light" ? "light" : "dark";
          dom["data-version"].textContent = `Data v${state.data.version}`;
          this.renderFeatureRegistry();
          this.renderSelectors();
          this.renderDashboard();
          this.renderTrades();
          this.renderSettings();
          this.renderAnalyticsFilters();
          this.updateAnalyticsView();
          this.renderInsights();
        },
        renderChips(container, items, activeValue, onSelect) {
          container.innerHTML = "";
          items.forEach(item => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `chip${item === activeValue ? " active" : ""}`;
            button.textContent = item;
            button.addEventListener("click", () => onSelect(item));
            container.appendChild(button);
          });
        },
        // Milestone 2C : liste à sélection multiple (confluences, causes secondaires du Delta Émotionnel).
        renderChecklist(container, items, activeValues, onToggle) {
          if (!container) return;
          container.innerHTML = "";
          items.forEach(item => {
            const label = document.createElement("label");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = activeValues.includes(item);
            checkbox.addEventListener("change", () => onToggle(item));
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(item));
            container.appendChild(label);
          });
        },
        // Milestone 2C : qualité du setup en 5 étoiles (Document 02, Carte 3).
        setKpi(element, value) {
          element.textContent = utils.formatPercent(value);
          element.className = `kpi-value ${utils.tone(value)}`;
        },
        // Milestone 3A : navigation entre les 4 vues (Document 03). Ne détruit jamais le
        // contenu des vues non actives — bascule uniquement une classe CSS.
        switchView(viewName) {
          const views = { dashboard: dom["view-dashboard"], journal: dom["view-journal"], analytics: dom["view-analytics"], insights: dom["view-insights"] };
          if (!views[viewName]) return;
          state.currentView = viewName;

          Object.entries(views).forEach(([name, element]) => {
            if (element) element.classList.toggle("active", name === viewName);
          });

          document.querySelectorAll("[data-view]").forEach(button => {
            button.classList.toggle("active", button.dataset.view === viewName);
          });

          if (viewName === "dashboard") this.renderDashboard();
          if (viewName === "analytics") this.updateAnalyticsView();
          if (viewName === "insights") this.renderInsights();
        },
        // Milestone 4 (Document 03) : état vide intelligent tant que l'échantillon est
        // insuffisant (Document 05 §7), puis structure Forces/Faiblesses/Opportunités/Recommandations.
        openModal(modal) {
          modal.classList.add("open");
          modal.setAttribute("aria-hidden", "false");
        },
        closeModal(modal) {
          modal.classList.remove("open");
          modal.setAttribute("aria-hidden", "true");
        },
        // UI-004 (Sprint 2, R1) : tone optionnel, rétrocompatible avec les appels
        // existants ui.toast("message") qui restent neutres par défaut. Réutilise
        // le même vocabulaire de teinte (positive/negative/neutral) déjà employé
        // par badge()/kpi-value, plutôt que d'introduire un nouveau système.
        toast(message, tone = "neutral") {
          const toast = document.createElement("div");
          toast.className = tone === "neutral" ? "toast" : `toast ${tone}`;
          toast.textContent = message;
          dom["toast-stack"].appendChild(toast);
          setTimeout(() => toast.remove(), 3000);
        },

        // UI-004 (Sprint 2, R2) : même vocabulaire de teinte que toast() (Feedback
        // State), appliqué cette fois à un texte de statut inline (ex. import-feedback)
        // plutôt qu'à une notification flottante. Les classes .positive/.negative
        // (components.css) et .muted (typography.css) coexistent déjà sans conflit :
        // .muted fixe la taille de police, .positive/.negative/.neutral la couleur.
        setFeedback(element, message, tone = "neutral") {
          element.textContent = message;
          element.className = tone === "neutral" ? "muted" : `muted ${tone}`;
        },

        // Sprint 1 — ARCH-003 (Livraison 2) : composants génériques identifiés lors de
        // l'audit (Livraison 1) comme dupliqués entre journal.js et analytics.js.
        // API simple, responsabilité unique (Doc §6) — pas de logique métier ici,
        // uniquement de l'assemblage de balisage.

        // Badge à teinte dynamique (positive/negative/neutral). 5 occurrences identiques
        // avant ce composant (journal.js ×3, analytics.js ×1, insights.js indirectement).
        badge(toneClass, label) {
          return `<span class="badge ${toneClass}">${label}</span>`;
        },

        // État vide (titre + message). Structure strictement identique entre journal.js
        // et analytics.js avant ce composant — seuls titre/message différaient.
        emptyState(title, message) {
          return `
            <div class="empty-state">
              <div>
                <h3>${title}</h3>
                <p class="muted">${message}</p>
              </div>
            </div>
          `;
        },

        // Ligne de trade (carte bordée). Couvre les deux usages identiques en forme
        // (journal.js : titre + méta + notes + 3 badges + actions ; analytics.js : titre +
        // méta + 1 badge, sans actions). insights.js utilise une variante volontairement
        // différente (une seule colonne, sans méta ni badge) et n'est pas concerné par ce
        // composant — le forcer dedans en ferait un composant "fourre-tout" (Doc §6).
        tradeRow({ title, meta, notes = "", badges = [], actions = "" }) {
          return `
            <article class="trade-row">
              <div>
                <p class="trade-title">${title}</p>
                <p class="trade-meta">${meta}</p>
                ${notes ? `<p class="trade-meta">${notes}</p>` : ""}
              </div>
              ${badges.map(b => this.badge(b.tone, b.label)).join("")}
              ${actions}
            </article>
          `;
        }
};