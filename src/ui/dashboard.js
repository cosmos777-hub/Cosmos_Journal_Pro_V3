// Sprint 1 — ARCH-001 (Livraison 3) : rendu du Dashboard (KPI, Feature Registry,
// Centre de Mission, Jumeau Numérique), déplacé tel quel depuis main.js.
//
// DASH-001 (Phase 2, Dashboard Architecture Foundation) : nouvelle architecture.
// - renderFeatureRegistry() est retiré : le panneau autrefois "Architecture V3"
//   n'affiche plus le Feature Registry ni le badge de version (voir
//   DECISIONS_LOG.md D-048 — application de D-018). L'import de `featureRegistry`
//   n'est donc plus nécessaire ici (il reste utilisé par storage.js pour la
//   sauvegarde JSON, ce module ne touche pas à cette partie).
// - renderDashboard()/renderEnrichedKpis() n'écrivent plus que dans les éléments
//   DOM qui existent encore après la refonte (kpi-real, kpi-avg-rr, kpi-drawdown,
//   kpi-delta, kpi-winrate, digital-twin-*, mission-*). Les anciens éléments
//   (kpi-theoretical, kpi-count, kpi-capital, kpi-profit-factor, kpi-expectancy,
//   kpi-avg-duration, kpi-plan-respect) n'existent plus dans le Dashboard — ces
//   KPI restent calculés et affichés dans Analytics (aucune perte fonctionnelle,
//   voir DECISIONS_LOG.md D-048).
import { dom } from "./dom.js";
import { state } from "../core/state.js";
import { calculations } from "../core/calculations.js";
import { utils } from "../utils/index.js";

export const dashboardUi = {
        renderDashboard() {
          const summary = calculations.summary(state.data.trades);
          summary.delta = summary.real - summary.theoretical;

          // DASH-001 (complément) : P&L théorique rejoint la colonne KPI principale.
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

          this.renderEnrichedKpis();
          this.renderDigitalTwin();
          this.renderMission();
        },
        // Milestone 4C (Document 03, "Centre de Mission"). DASH-001 : non concerné
        // par ce ticket (réorganisation prévue séparément) — comportement inchangé.
        renderMission() {
          if (!dom["mission-title"]) return;
          const mission = calculations.generateMission(state.data.trades);
          dom["mission-title"].textContent = mission.title;
          dom["mission-copy"].textContent = mission.copy;
        },
        // Milestone 4 (Document 05 §8) : graphique SVG fait main (fond transparent, peu de
        // grille — Document 03), sans dépendance externe (cohérent avec la suppression du CDN
        // au Milestone 1). Approximation multi-comptes : capital initial = somme des comptes actifs.
        // DASH-001 : fonctionnement strictement inchangé — seule sa position dans le DOM a
        // changé (carte .kpi--digital-twin, colonne gauche, au lieu d'un panneau en bas de
        // page). Les ids #digital-twin-chart / #digital-twin-gap sont conservés à l'identique.
        // DASH-001 (correction) : le graphique (SVG) et la légende sont désormais deux
        // conteneurs DOM distincts (#digital-twin-chart / #digital-twin-legend) répartis
        // dans les deux colonnes internes de la carte (voir index.html/dashboard.css).
        // Aucun calcul touché — buildEquityCurve() et la logique de mise à l'échelle
        // restent strictly identiques ; seul le point d'écriture DOM est scindé.
        renderDigitalTwin() {
          if (!dom["digital-twin-chart"]) return;
          const activeAccounts = state.data.accounts.filter(a => !a.archived);
          const initialCapital = activeAccounts.reduce((sum, a) => sum + (Number(a.initialCapital) || 0), 0);
          const points = calculations.buildEquityCurve(state.data.trades, initialCapital);

          if (points.length < 2) {
            dom["digital-twin-chart"].innerHTML = "";
            if (dom["digital-twin-legend"]) dom["digital-twin-legend"].innerHTML = "";
            dom["digital-twin-gap"].textContent = "Ajoutez des trades pour comparer votre exécution réelle à une exécution parfaite du plan.";
            return;
          }

          // Ratio horizontal élargi pour la rangée dédiée pleine largeur
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

          // Graphique SVG pur dans la colonne de droite
          dom["digital-twin-chart"].innerHTML = `
            <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%; height:100%;">
              <polyline points="${theoreticalPath}" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-dasharray="6 6" />
              <polyline points="${realPath}" fill="none" stroke="var(--cosmos)" stroke-width="2.5" />
            </svg>
          `;

          // Légende injectée dans la colonne de gauche (info)
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
        renderEnrichedKpis() {
    if (!dom["kpi-winrate"]) return;
    const trades = state.data.trades;
    const activeAccounts = state.data.accounts.filter(a => !a.archived);

    // 1. WINRATE (Valeur à gauche, Anneau agrandi à 52px à droite)
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

    // 2. RESPECT DU PLAN
    if (dom["kpi-plan-respect"]) {
      const planRespect = calculations.planRespectRate(trades);
      dom["kpi-plan-respect"].textContent = planRespect == null ? "—" : `${planRespect.toFixed(2)}%`;
    }

    // 3. CAPITAL ACTUEL (Chiffre à gauche, Badge Portefeuille néon à droite)
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