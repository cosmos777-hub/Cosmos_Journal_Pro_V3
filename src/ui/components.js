// Sprint 1 — ARCH-001 (Livraison 3) : composants communs et orchestration UI,
// déplacés tels quels depuis main.js. cache()/render() sont le point d'entrée qui
// assemble et rafraîchit toutes les vues ; renderChips/renderChecklist/setKpi/
// openModal/closeModal/toast sont des helpers réutilisés par Dashboard, Journal,
// Analytics, Coach et Settings.
//
// DASH-001 (Phase 2) : le Feature Registry et le badge de version ne sont plus
// rendus (panneau "Architecture V3" retiré du Dashboard, voir DECISIONS_LOG.md
// D-048 — application de D-018). L'appel à renderFeatureRegistry() est retiré de
// render() ; les ids DOM correspondants ("feature-registry", "data-version")
// ainsi que les anciens KPI Dashboard désormais absents du DOM ("kpi-theoretical",
// "kpi-count", "kpi-capital", "kpi-profit-factor", "kpi-expectancy",
// "kpi-avg-duration", "kpi-plan-respect") sont retirés de cache(). Deux nouveaux
// ids Analytics ("analytics-kpi-capital", "analytics-kpi-drawdown") sont ajoutés,
// ces KPI ayant rejoint la vue Analytics (D-048).
//
// COACH-001 (Mission Workspace Foundation) : Insights est intégralement remplacé
// par Coach (voir DECISIONS_LOG.md — Insights devient Coach, COACH_PRODUCT_VISION.md
// et COACH_UI_ARCHITECTURE.md font désormais autorité sur ce module, en lieu et
// place du Document 02 "INSIGHTS IA"). Les ids "insights-*" et l'appel
// this.renderInsights() sont retirés ; remplacés par les ids "coach-*" et
// this.renderCoach() (voir coach.js).
//
// COACH-002 (Playbook Workspace) : ajoute l'id "coach-playbook-card".
// COACH-003 (Progress Workspace) : ajoute l'id "coach-progress-card".
// COACH-004 (Achievements Workspace) : ajoute l'id "coach-achievements-card".
// COACH-005 (Digital Twin Workspace) : ajoute l'id "coach-digitaltwin-card",
// même principe exact que les trois précédents — le conteneur générique dans
// lequel ui/digitalTwin.js injecte tout son balisage. components.js n'a
// besoin de connaître que ces quatre ids ; la structure interne de chacun
// reste entièrement encapsulée dans son composant de présentation respectif
// (séparation présentation/génération, voir coach.js, core/playbooks.js,
// core/progress.js, core/achievements.js et core/digitalTwin.js). Ce ticket
// clôt le cœur fonctionnel du module Coach.
//
// COACH-POLISH-001 (Premium Visual Polish) : ajoute trois ids pour le Journey
// Container (voir ui/coach.js, renderCoachJourney()) — "coach-journey-nav"
// (navigation latérale gauche), "coach-journey-viewport" (conteneur scrollable
// à hauteur fixe contenant les 5 chapitres), "coach-journey-dots" (indicateurs
// de progression à droite). Pure présentation : aucun de ces éléments n'est lu
// ni écrit par core/*.
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
//     Non utilisé par coach.js/playbook.js/progress.js/achievements.js/
//     digitalTwin.js, qui ont chacun une mise en page structurellement
//     différente — l'utiliser là-bas en aurait fait un composant
//     "fourre-tout" (Doc ARCH-003 §6).
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
      "emotional-cause-options",
      "manual-intervention-options", "manual-intervention-value",
      "notes", "tags-options", "capture-slots",
      "validation-summary", "wizard-prev", "wizard-next", "wizard-progress-fill", "wizard-step-label",
      "trade-form", "journal-panel", "history-panel",
      // UX-003 (Sprint 3, Livraison 2A) : historique repliable.
      "history-toggle", "history-toggle-icon", "history-collapsible",
      "trade-list", "history-subtitle", "kpi-real", "kpi-delta",
      // Régression DASH-001 corrigée : "delta-note" avait été supprimé par erreur
      // de cette liste lors du nettoyage des anciens ids Dashboard. L'élément
      // existe toujours dans le DOM et dans dashboard.js (renderDashboard) —
      // dom["delta-note"] valait donc `undefined`, d'où le crash
      // "Cannot set properties of undefined (setting 'textContent')" qui
      // interrompait le reste de render() (renderTrades, renderSettings,
      // renderAnalyticsFilters, updateAnalyticsView, renderCoach) à chaque appel.
      "delta-note",
      "settings-modal", "settings-nav", "settings-content",
      "export-modal", "export-output", "import-modal", "import-input", "import-file", "import-feedback",
      "toast-stack",
      "capture-viewer-modal", "capture-viewer-image",
      // DASH-001 (complément de validation) : RR moyen / Drawdown max quittent le
      // Dashboard (restent dans Analytics, ids "analytics-kpi-avg-rr"/"analytics-kpi-drawdown",
      // déjà en cache plus bas — inchangés). P&L théorique, Respect du plan et Capital
      // actuel rejoignent la colonne KPI principale du Dashboard.
      "kpi-winrate", "kpi-theoretical", "kpi-plan-respect", "kpi-capital", "dashboard-account-filter",
      "view-dashboard", "view-journal", "view-analytics", "view-coach",
      // Milestone 3B : filtres et KPI de la vue Analytics.
      "analytics-filter-account", "analytics-filter-asset", "analytics-filter-session",
      "analytics-filter-htf", "analytics-filter-ltf", "analytics-filter-strategy",
      "analytics-filter-date-from", "analytics-filter-date-to", "analytics-filter-reset", "analytics-filter-note",
      "analytics-kpi-count", "analytics-kpi-real", "analytics-kpi-theoretical", "analytics-kpi-delta",
      "analytics-kpi-winrate", "analytics-kpi-profit-factor", "analytics-kpi-expectancy",
      "analytics-kpi-avg-rr", "analytics-kpi-avg-duration", "analytics-kpi-plan-respect",
      // DASH-001 : Capital actuel et Drawdown max rejoignent Analytics (D-048).
      "analytics-kpi-capital", "analytics-kpi-drawdown",
      "analytics-trade-list", "breakdown-dimension", "breakdown-table",
      "analytics-proof-panel", "analytics-proof-toggle", "analytics-proof-toggle-icon", "analytics-proof-collapsible",
      // ANALYTICS-002 (Bloc ③ Comprendre vos indicateurs) : même famille
      // d'ids que le Bloc ④ Preuves ci-dessus.
      "analytics-help-panel", "analytics-help-toggle", "analytics-help-toggle-icon", "analytics-help-collapsible",
      // COACH-001 (Mission Workspace Foundation) : remplace les anciens ids
      // "insights-*". Voir coach.js pour leur utilisation.
      "coach-empty-state", "coach-empty-title", "coach-empty-copy", "coach-content",
      "coach-mission-card", "coach-mission-priority", "coach-mission-title",
      "coach-mission-description", "coach-mission-reasoning", "coach-mission-cta",
      // COACH-002 (Playbook Workspace) : conteneur générique unique, tout le
      // reste du balisage est injecté par ui/playbook.js (voir coach.js).
      "coach-playbook-card",
      // COACH-003 (Progress Workspace) : conteneur générique unique, tout le
      // reste du balisage est injecté par ui/progress.js (voir coach.js).
      "coach-progress-card",
      // COACH-004 (Achievements Workspace) : conteneur générique unique, tout
      // le reste du balisage est injecté par ui/achievements.js (voir coach.js).
      "coach-achievements-card",
      // COACH-005 (Digital Twin Workspace) : conteneur générique unique, tout
      // le reste du balisage est injecté par ui/digitalTwin.js (voir coach.js).
      "coach-digitaltwin-card",
      // COACH-POLISH-001 (Journey Container) : navigation latérale, conteneur
      // scrollable des 5 chapitres, indicateurs de progression. Voir
      // ui/coach.js, renderCoachJourney().
      "coach-journey-nav", "coach-journey-viewport", "coach-journey-dots",
      "digital-twin-chart", "digital-twin-gap", "digital-twin-legend", "mission-title", "mission-copy"
    ].forEach(id => {
      dom[id] = document.getElementById(id);
    });
  },
  render() {
    document.documentElement.dataset.theme = state.data.preferences.theme === "light" ? "light" : "dark";
    // DASH-001 : this.renderFeatureRegistry() et l'écriture de #data-version sont
    // retirés — ces deux éléments n'existent plus dans le DOM Dashboard (voir
    // DECISIONS_LOG.md D-048, application de D-018).
    this.renderSelectors();
    // MEDIA-001 (Livraison G — A1) : renderCaptureSlots() retiré de renderSelectors()
    // (qui s'exécute à chaque clic de chip du Wizard, sans rapport avec les captures)
    // et appelé ici une seule fois, au même niveau que les autres rendus de premier
    // niveau. Les seuls autres déclencheurs légitimes restent explicites :
    // actions.handleCaptureFile/removeCapture (main.js) et startEditTrade (main.js),
    // qui appellent déjà this.renderCaptureSlots() directement — jamais via
    // renderSelectors(). Le Wizard (sélection d'actif, stratégie, direction...) ne
    // provoque donc plus aucune lecture IndexedDB.
    this.renderCaptureSlots();
    this.renderDashboard();
    this.renderTrades();
    this.renderSettings();
    this.renderAnalyticsFilters();
    this.updateAnalyticsView();
    // COACH-001 : this.renderInsights() → this.renderCoach() (voir coach.js).
    // COACH-002/003/004/005 : renderCoach() couvre désormais aussi le rendu
    // du Playbook, du Progress, des Achievements et du Digital Twin (délégués
    // en interne) — rien à ajouter ici. COACH-POLISH-001 : renderCoach()
    // construit aussi le Journey Container (nav/dots/scroll-spy) en fin de
    // pipeline, toujours en interne — rien à ajouter ici non plus.
    this.renderCoach();
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
    
    // RP-002B : identifiants uniques pour les cases à cocher
    const safeValue = String(item).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    checkbox.id = `${container.id || "checklist"}-${safeValue}`;
    checkbox.name = container.id || "checklist-item";

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
  // COACH-001 : la vue "insights" devient "coach" (dom["view-coach"]).
  switchView(viewName) {
    const views = { dashboard: dom["view-dashboard"], journal: dom["view-journal"], analytics: dom["view-analytics"], coach: dom["view-coach"] };
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
    if (viewName === "coach") this.renderCoach();
  },
  // Milestone 4 (Document 03) : état vide intelligent tant que l'échantillon est
  // insuffisant (Document 05 §7), puis structure Mission + Playbook + Progress
  // + Achievements + Digital Twin (COACH-001 à COACH-005).
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
  // avant ce composant (journal.js ×3, analytics.js ×1, coach.js indirectement).
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
  // méta + 1 badge, sans actions). coach.js et ses composants (Playbook, Progress,
  // Achievements, Digital Twin) utilisent une mise en page volontairement
  // différente (Card dédiée, sans méta ni badge de trade) et ne sont pas
  // concernés par ce composant — le forcer dedans en aurait fait un composant
  // "fourre-tout" (Doc §6).
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