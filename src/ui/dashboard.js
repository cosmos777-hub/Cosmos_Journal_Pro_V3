// Sprint 1 — ARCH-001 (Livraison 3) : rendu du Dashboard (KPI, Feature Registry,
// Centre de Mission, Jumeau Numérique), déplacé tel quel depuis main.js.
import { dom } from "./dom.js";
import { state } from "../core/state.js";
import { calculations } from "../core/calculations.js";
import { featureRegistry } from "../core/storage.js";
import { utils } from "../utils/index.js";

export const dashboardUi = {
        renderFeatureRegistry() {
          dom["feature-registry"].innerHTML = featureRegistry.map(feature => `
            <span class="badge">${utils.escape(feature.name)} · ${utils.escape(feature.status)}</span>
          `).join("");
        },
        renderDashboard() {
          const summary = calculations.summary(state.data.trades);
          summary.delta = summary.real - summary.theoretical;

          this.setKpi(dom["kpi-real"], summary.real);
          this.setKpi(dom["kpi-theoretical"], summary.theoretical);
          this.setKpi(dom["kpi-delta"], summary.delta);
          dom["kpi-count"].textContent = String(summary.count);

          if (!summary.count) {
            dom["delta-note"].textContent = "Ajoutez un trade pour mesurer le coût réel de l'exécution.";
          } else if (summary.delta > 0) {
            dom["delta-note"].textContent = "L'exécution réelle améliore le scénario théorique sur cette série.";
          } else if (summary.delta < 0) {
            dom["delta-note"].textContent = "Les décisions manuelles coûtent de la performance sur cette série.";
          } else {
            dom["delta-note"].textContent = "Le réel et le théorique sont alignés.";
          }

          this.renderEnrichedKpis();
          this.renderDigitalTwin();
          this.renderMission();
        },
        // Milestone 4C (Document 03, "Centre de Mission").
        renderMission() {
          if (!dom["mission-title"]) return;
          const mission = calculations.generateMission(state.data.trades);
          dom["mission-title"].textContent = mission.title;
          dom["mission-copy"].textContent = mission.copy;
        },
        // Milestone 4 (Document 05 §8) : graphique SVG fait main (fond transparent, peu de
        // grille — Document 03), sans dépendance externe (cohérent avec la suppression du CDN
        // au Milestone 1). Approximation multi-comptes : capital initial = somme des comptes actifs.
        renderDigitalTwin() {
          if (!dom["digital-twin-chart"]) return;
          const activeAccounts = state.data.accounts.filter(a => !a.archived);
          const initialCapital = activeAccounts.reduce((sum, a) => sum + (Number(a.initialCapital) || 0), 0);
          const points = calculations.buildEquityCurve(state.data.trades, initialCapital);

          if (points.length < 2) {
            dom["digital-twin-chart"].innerHTML = "";
            dom["digital-twin-gap"].textContent = "Ajoutez des trades pour comparer votre exécution réelle à une exécution parfaite du plan.";
            return;
          }

          const width = 700;
          const height = 220;
          const padding = 16;
          const allValues = points.flatMap(p => [p.real, p.theoretical]);
          const min = Math.min(...allValues);
          const max = Math.max(...allValues);
          const range = max - min || 1;

          const scaleX = i => padding + (i / (points.length - 1)) * (width - padding * 2);
          const scaleY = v => height - padding - ((v - min) / range) * (height - padding * 2);

          const realPath = points.map((p, i) => `${scaleX(i)},${scaleY(p.real)}`).join(" ");
          const theoreticalPath = points.map((p, i) => `${scaleX(i)},${scaleY(p.theoretical)}`).join(" ");

          dom["digital-twin-chart"].innerHTML = `
            <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto;">
              <polyline points="${theoreticalPath}" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-dasharray="6 6" />
              <polyline points="${realPath}" fill="none" stroke="var(--cosmos)" stroke-width="2.5" />
            </svg>
            <div style="display:flex; gap:16px; margin-top:8px; font-size:12px; color:var(--text-muted);">
              <span><span style="display:inline-block; width:10px; height:10px; background:var(--cosmos); border-radius:50%; margin-right:6px;"></span>Réel</span>
              <span><span style="display:inline-block; width:10px; height:2px; background:var(--text-muted); margin-right:6px; vertical-align:middle;"></span>Théorique (plan parfait)</span>
            </div>
          `;

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
        // Milestone 3A (Document 05 §9) : KPI additionnels calculés via le moteur d'analyse
        // agrégé déjà prêt depuis le 2A. N'affecte jamais les 4 KPI historiques ci-dessus.
        renderEnrichedKpis() {
          if (!dom["kpi-capital"]) return;
          const trades = state.data.trades;
          const activeAccounts = state.data.accounts.filter(a => !a.archived);

          const totalCapital = activeAccounts.reduce((sum, a) => sum + (Number(a.currentCapital) || 0), 0);
          dom["kpi-capital"].textContent = totalCapital.toFixed(2);

          const winrate = calculations.winrate(trades);
          dom["kpi-winrate"].textContent = winrate == null ? "—" : `${winrate.toFixed(2)}%`;

          const profitFactor = calculations.profitFactor(trades);
          dom["kpi-profit-factor"].textContent = trades.length ? (profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)) : "—";

          const expectancy = calculations.expectancy(trades);
          dom["kpi-expectancy"].textContent = trades.length ? utils.formatR(expectancy) : "—";
          dom["kpi-expectancy"].className = `kpi-value ${trades.length ? utils.tone(expectancy) : "neutral"}`;

          // Approximation Milestone 3A : basée sur la somme des capitaux initiaux de tous les
          // comptes actifs. Un drawdown par compte individuel arrivera avec les filtres du 3B.
          const totalInitialCapital = activeAccounts.reduce((sum, a) => sum + (Number(a.initialCapital) || 0), 0);
          const drawdown = calculations.drawdownMax(trades, totalInitialCapital);
          dom["kpi-drawdown"].textContent = trades.length ? `${drawdown.toFixed(2)}%` : "—";

          const avgRR = calculations.averageRR(trades);
          dom["kpi-avg-rr"].textContent = avgRR == null ? "—" : `${avgRR.toFixed(2)}R`;

          const avgDuration = calculations.averageDuration(trades);
          dom["kpi-avg-duration"].textContent = avgDuration == null ? "—" : `${avgDuration} min`;

          const planRespect = calculations.planRespectRate(trades);
          dom["kpi-plan-respect"].textContent = planRespect == null ? "—" : `${planRespect.toFixed(2)}%`;
        },
        // Milestone 3B : peuple les 6 filtres de la vue Analytics à partir des comptes/settings.
        // Préserve la sélection en cours si elle reste valide (même logique que renderRiskOptions).
};