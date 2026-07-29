import { dom } from "./dom.js";
import { state } from "../core/state.js";
import { calculations } from "../core/calculations.js";
import { utils } from "../utils/index.js";

export const dashboardUi = {
  renderDashboard() {
    // RP-006 : le bouton d'onboarding n'est visible que tant qu'aucun trade
    // n'existe — disparaît automatiquement dès l'injection ou dès le premier
    // trade réel enregistré par l'utilisateur.
    if (dom["dashboard-demo-cta"]) {
      dom["dashboard-demo-cta"].classList.toggle("hidden", state.data.trades.length > 0);
    }

    this.renderDashboardAccountFilter();

    const filterAccountId = state.dashboardAccountFilter || "";
    const filteredTrades = calculations.filterTrades(state.data.trades, { accountId: filterAccountId });

    const summary = calculations.summary(filteredTrades);
    summary.delta = summary.real - summary.theoretical;

    this.setKpi(dom["kpi-real"], summary.real);
    this.setKpi(dom["kpi-theoretical"], summary.theoretical);
    this.setKpi(dom["kpi-delta"], summary.delta);

    if (!summary.count) {
      dom["delta-note"].textContent = "Ajoutez un trade pour mesurer le coût réel de l'exécution.";
    } else if (summary.delta > 0) {
      dom["delta-note"].textContent = "L'exécution réelle améliore le scénario théorique sur cette série.";
    } else if (summary.delta < 0) {
      dom["delta-note"].textContent = "Les décisions manuelles coûtent de la performance sur cette série.";
    } else {
      dom["delta-note"].textContent = "Le réel et le théorique sont alignés.";
    }

    this.renderEnrichedKpis(filteredTrades);
    this.renderDigitalTwin(filteredTrades);
    this.renderMission();
  },

  renderDashboardAccountFilter() {
    if (!dom["dashboard-account-filter"]) return;
    const activeAccounts = state.data.accounts.filter(a => !a.archived);

    const stillValid = !state.dashboardAccountFilter ||
      activeAccounts.some(a => a.id === state.dashboardAccountFilter);
    if (!stillValid) state.dashboardAccountFilter = "";

    dom["dashboard-account-filter"].innerHTML = `<option value="">Tous</option>` +
      activeAccounts.map(a => `<option value="${utils.escape(a.id)}">${utils.escape(a.name)}</option>`).join("");
    dom["dashboard-account-filter"].value = state.dashboardAccountFilter || "";
  },

  renderMission() {
    if (!dom["mission-title"]) return;
    const mission = calculations.generateMission(state.data.trades);
    dom["mission-title"].textContent = mission.title;
    dom["mission-copy"].textContent = mission.copy;
  },

  renderDigitalTwin(trades) {
    if (!dom["digital-twin-chart"]) return;
    const filterAccountId = state.dashboardAccountFilter || "";
    const activeAccounts = state.data.accounts.filter(a => !a.archived && (!filterAccountId || a.id === filterAccountId));
    const initialCapital = activeAccounts.reduce((sum, a) => sum + (Number(a.initialCapital) || 0), 0);
    const points = calculations.buildEquityCurve(trades, initialCapital);

    if (points.length < 2) {
      dom["digital-twin-chart"].innerHTML = "";
      if (dom["digital-twin-legend"]) dom["digital-twin-legend"].innerHTML = "";
      dom["digital-twin-gap"].textContent = "Ajoutez des trades pour comparer votre exécution réelle à une exécution parfaite du plan.";
      return;
    }

    const width = 900;
    const height = 100;
    const padding = 12;
    const allValues = points.flatMap(p => [p.real, p.theoretical]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;

    const scaleX = i => padding + (i / (points.length - 1)) * (width - padding * 2);
    const scaleY = v => height - padding - ((v - min) / range) * (height - padding * 2);

    const realPath = points.map((p, i) => `${scaleX(i)},${scaleY(p.real)}`).join(" ");
    const theoreticalPath = points.map((p, i) => `${scaleX(i)},${scaleY(p.theoretical)}`).join(" ");

    dom["digital-twin-chart"].innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%; height:100%;">
        <polyline points="${theoreticalPath}" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-dasharray="6 6" />
        <polyline points="${realPath}" fill="none" stroke="var(--cosmos)" stroke-width="2.5" />
      </svg>
    `;

    if (dom["digital-twin-legend"]) {
      dom["digital-twin-legend"].innerHTML = `
        <span><span style="display:inline-block; width:10px; height:10px; background:var(--cosmos); border-radius:50%; margin-right:6px;"></span>Réel</span>
        <span><span style="display:inline-block; width:10px; height:2px; background:var(--text-muted); margin-right:6px; vertical-align:middle;"></span>Théorique (plan parfait)</span>
      `;
    }

    const last = points[points.length - 1];
    const gap = +(last.theoretical - last.real).toFixed(2);
    if (gap > 0) {
      dom["digital-twin-gap"].textContent = `Potentiel inexploité : ${gap.toFixed(2)} (ce que l'exécution parfaite du plan aurait rapporté de plus).`;
    } else if (gap < 0) {
      dom["digital-twin-gap"].textContent = `Ton exécution réelle dépasse le plan théorique de ${Math.abs(gap).toFixed(2)}.`;
    } else {
      dom["digital-twin-gap"].textContent = "Le résultat réel est aligné avec le plan théorique.";
    }
  },

  renderEnrichedKpis(trades) {
    if (!dom["kpi-winrate"]) return;
    const filterAccountId = state.dashboardAccountFilter || "";
    const activeAccounts = state.data.accounts.filter(a => !a.archived && (!filterAccountId || a.id === filterAccountId));

    const winrate = calculations.winrate(trades);
    const pct = winrate == null ? 0 : Math.max(0, Math.min(100, winrate));
    const radius = 20, circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - pct / 100);

    dom["kpi-winrate"].innerHTML = winrate == null
      ? "—"
      : `
        <div class="kpi-row-layout">
          <span>${winrate.toFixed(2)}%</span>
          <div class="winrate-ring-wrap">
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle class="winrate-ring-track" cx="26" cy="26" r="${radius}" stroke-width="4.5"></circle>
              <circle class="winrate-ring-value" cx="26" cy="26" r="${radius}" stroke-width="4.5"
                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                transform="rotate(-90 26 26)"></circle>
            </svg>
          </div>
        </div>`;
    dom["kpi-winrate"].className = "kpi-value neutral";

    if (dom["kpi-plan-respect"]) {
      const planRespect = calculations.planRespectRate(trades);
      dom["kpi-plan-respect"].textContent = planRespect == null ? "—" : `${planRespect.toFixed(2)}%`;
    }

    if (dom["kpi-capital"]) {
      const totalCapital = activeAccounts.reduce((sum, a) => sum + (Number(a.currentCapital) || 0), 0);
      dom["kpi-capital"].innerHTML = `
        <div class="kpi-row-layout">
          <span>${totalCapital.toFixed(2)}</span>
          <div class="capital-badge-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
              <path d="M18 12a2 2 0 0 0 0 4h4v-4z"></path>
            </svg>
          </div>
        </div>`;
    }
  },
};