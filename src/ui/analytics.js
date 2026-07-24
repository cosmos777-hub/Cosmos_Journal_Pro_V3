// Sprint 1 — ARCH-001 (Livraison 3) : rendu de la vue Analytics (filtres, KPI
// recalculés en direct, tableau de performance par dimension), déplacé tel quel
// depuis main.js.
//
// DASH-001 (Phase 2) : Capital actuel et Drawdown max rejoignent cette vue,
// rapatriés depuis le Dashboard (voir DECISIONS_LOG.md D-048). Contrairement à
// leur ancien calcul Dashboard (toujours basé sur l'historique complet), les deux
// deviennent sensibles aux filtres actifs, cohérent avec la philosophie "laboratoire
// filtrable" de cette vue (Document 03) : Drawdown max est recalculé sur `filtered` ;
// Capital actuel se restreint au compte sélectionné si `filters.accountId` est
// renseigné, sinon reste la somme des comptes actifs (comportement hérité du
// Dashboard). Aucune nouvelle formule : réutilise calculations.drawdownMax(), déjà
// existante.
import { dom } from "./dom.js";
import { state } from "../core/state.js";
import { calculations } from "../core/calculations.js";
import { HISTORY_DISPLAY_LIMIT } from "../utils/constants.js";
import { utils } from "../utils/index.js";

export const analyticsUi = {
        renderAnalyticsFilters() {
          if (!dom["analytics-filter-account"]) return;
          const activeAccounts = state.data.accounts.filter(a => !a.archived);
          this.fillFilterSelect(dom["analytics-filter-account"], activeAccounts.map(a => ({ value: a.id, label: a.name })), "Tous");
          this.fillFilterSelect(dom["analytics-filter-asset"], state.data.settings.assets.map(v => ({ value: v, label: v })), "Tous");
          this.fillFilterSelect(dom["analytics-filter-session"], state.data.settings.sessions.map(v => ({ value: v, label: v })), "Toutes");
          this.fillFilterSelect(dom["analytics-filter-htf"], state.data.settings.htf.map(v => ({ value: v, label: v })), "Tous");
          this.fillFilterSelect(dom["analytics-filter-ltf"], state.data.settings.ltf.map(v => ({ value: v, label: v })), "Tous");
          this.fillFilterSelect(dom["analytics-filter-strategy"], state.data.settings.strategies.map(v => ({ value: v, label: v })), "Toutes");
        },
        fillFilterSelect(select, options, allLabel) {
          const previous = select.value;
          select.innerHTML = `<option value="">${utils.escape(allLabel)}</option>` +
            options.map(o => `<option value="${utils.escape(o.value)}">${utils.escape(o.label)}</option>`).join("");
          if (options.some(o => o.value === previous)) select.value = previous;
        },
        // ANALYTICS-001 (Bloc ③ Preuves) : miroir exact de
        // journalUi.renderHistoryToggle() — même préférence persistée,
        // même mécanisme d'accordéon, réutilisé sans divergence.
        renderAnalyticsProofToggle() {
          if (!dom["analytics-proof-collapsible"]) return;
          const collapsed = state.data.preferences.analyticsProofCollapsed !== false;
          dom["analytics-proof-collapsible"].classList.toggle("open", !collapsed);
          dom["analytics-proof-toggle"].setAttribute("aria-expanded", String(!collapsed));
        },
        // ANALYTICS-002 (Bloc ③ Comprendre vos indicateurs) : contenu
        // statique (aucune donnée à recalculer) — seul l'état replié/ouvert
        // est piloté, même mécanisme que renderAnalyticsProofToggle().
        renderAnalyticsHelpToggle() {
          if (!dom["analytics-help-collapsible"]) return;
          const collapsed = state.data.preferences.analyticsHelpCollapsed !== false;
          dom["analytics-help-collapsible"].classList.toggle("open", !collapsed);
          dom["analytics-help-toggle"].setAttribute("aria-expanded", String(!collapsed));
        },
        // Milestone 3B (Document 03 : "les graphiques se mettent à jour immédiatement, sans
        // bouton") : relit les filtres, recalcule avec le même moteur que le Dashboard (3A),
        // sans jamais dupliquer les formules.
        updateAnalyticsView() {
          if (!dom["analytics-kpi-count"]) return;
          try {
            this.updateAnalyticsViewInner();
          } catch (error) {
            // Défense en profondeur (bug report #6) : aucune Promise/fetch n'existe
            // dans ce pipeline (entièrement synchrone), donc si cette erreur se
            // déclenche malgré tout, elle n'est presque certainement pas produite
            // par ce bloc — mais on l'isole proprement plutôt que de laisser un
            // crash silencieux remonter et casser le reste de render().
            console.error("Échec du rendu Analytics", error);
            this.toast("Erreur lors du filtrage des Analytics.", "negative");
          }
        },
        updateAnalyticsViewInner() {
          this.renderAnalyticsProofToggle();
          this.renderAnalyticsHelpToggle();
          const filters = {
            accountId: dom["analytics-filter-account"].value,
            asset: dom["analytics-filter-asset"].value,
            session: dom["analytics-filter-session"].value,
            htf: dom["analytics-filter-htf"].value,
            ltf: dom["analytics-filter-ltf"].value,
            strategy: dom["analytics-filter-strategy"].value,
            dateFrom: dom["analytics-filter-date-from"].value,
            dateTo: dom["analytics-filter-date-to"].value
          };
          const filtered = calculations.filterTrades(state.data.trades, filters);

          dom["analytics-kpi-count"].textContent = `${filtered.length} / ${state.data.trades.length}`;

          const summary = calculations.summary(filtered);
          summary.delta = summary.real - summary.theoretical;
          this.setKpi(dom["analytics-kpi-real"], summary.real);
          this.setKpi(dom["analytics-kpi-theoretical"], summary.theoretical);
          this.setKpi(dom["analytics-kpi-delta"], summary.delta);

          const winrate = calculations.winrate(filtered);
          dom["analytics-kpi-winrate"].textContent = winrate == null ? "—" : `${winrate.toFixed(2)}%`;

          const profitFactor = calculations.profitFactor(filtered);
          dom["analytics-kpi-profit-factor"].textContent = filtered.length ? (profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)) : "—";

          const expectancy = calculations.expectancy(filtered);
          dom["analytics-kpi-expectancy"].textContent = filtered.length ? utils.formatR(expectancy) : "—";
          dom["analytics-kpi-expectancy"].className = `kpi-value ${filtered.length ? utils.tone(expectancy) : "neutral"}`;

          const avgRR = calculations.averageRR(filtered);
          dom["analytics-kpi-avg-rr"].textContent = avgRR == null ? "—" : `${avgRR.toFixed(2)}R`;

          const avgDuration = calculations.averageDuration(filtered);
          dom["analytics-kpi-avg-duration"].textContent = avgDuration == null ? "—" : `${avgDuration} min`;

          const planRespect = calculations.planRespectRate(filtered);
          dom["analytics-kpi-plan-respect"].textContent = planRespect == null ? "—" : `${planRespect.toFixed(2)}%`;

          // DASH-001 (D-048) : Capital actuel et Drawdown max, rapatriés depuis le
          // Dashboard. Le compte pris en compte se restreint au filtre Compte actif
          // s'il est renseigné (cohérent avec le reste de cette vue, filtrable par
          // compte) ; sinon, comportement hérité du Dashboard (somme des comptes actifs).
          if (dom["analytics-kpi-capital"]) {
            const activeAccounts = state.data.accounts.filter(a => !a.archived);
            const scopedAccounts = filters.accountId
              ? activeAccounts.filter(a => a.id === filters.accountId)
              : activeAccounts;

            const totalCapital = scopedAccounts.reduce((sum, a) => sum + (Number(a.currentCapital) || 0), 0);
            dom["analytics-kpi-capital"].textContent = totalCapital.toFixed(2);

            const totalInitialCapital = scopedAccounts.reduce((sum, a) => sum + (Number(a.initialCapital) || 0), 0);
            const drawdown = calculations.drawdownMax(filtered, totalInitialCapital);
            dom["analytics-kpi-drawdown"].textContent = filtered.length ? `${drawdown.toFixed(2)}%` : "—";
          }

          const dateFilterActive = Boolean(filters.dateFrom || filters.dateTo);
          dom["analytics-filter-note"].textContent = dateFilterActive
            ? "Le filtre de période exclut les trades sans date au format JJ/MM/AAAA saisie via le formulaire 8 cartes."
            : "";

          this.renderAnalyticsTradeList(filtered);
          this.renderBreakdownTable(filtered);
        },
        // Milestone 3C : tableau de performance par dimension, calculé sur les trades déjà filtrés.
        renderBreakdownTable(filtered) {
          if (!dom["breakdown-table"]) return;
          const dimension = dom["breakdown-dimension"].value;
          const groups = calculations.groupTradesByDimension(filtered, dimension, state.data.accounts);

          if (!groups.length) {
            dom["breakdown-table"].innerHTML = `<p class="muted">Aucune donnée à regrouper pour cette sélection.</p>`;
            return;
          }

          dom["breakdown-table"].innerHTML = `
            <table class="breakdown-table">
              <thead>
                <tr>
                  <th>Groupe</th>
                  <th>Trades</th>
                  <th>Winrate</th>
                  <th>Profit Factor</th>
                  <th>Expectancy</th>
                  <th>RR moyen</th>
                  <th>Résultat total</th>
                </tr>
              </thead>
              <tbody>
                ${groups.map(g => `
                  <tr>
                    <td>${utils.escape(g.label)}</td>
                    <td>${g.count}</td>
                    <td>${g.winrate == null ? "—" : g.winrate.toFixed(2) + "%"}</td>
                    <td>${g.profitFactor === Infinity ? "∞" : g.profitFactor.toFixed(2)}</td>
                    <td class="${utils.tone(g.expectancy)}">${utils.formatR(g.expectancy)}</td>
                    <td>${g.averageRR == null ? "—" : g.averageRR.toFixed(2) + "R"}</td>
                    <td class="${utils.tone(g.totalResultCurrency)}">${g.totalResultCurrency.toFixed(2)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `;
        },
        renderAnalyticsTradeList(trades) {
          if (!trades.length) {
            dom["analytics-trade-list"].innerHTML = this.emptyState(
              "Aucun trade ne correspond",
              "Ajustez ou réinitialisez les filtres."
            );
            return;
          }
          // Milestone 5B : même plafond d'affichage que l'historique (Document 06 §7).
          const visibleTrades = trades.slice(0, HISTORY_DISPLAY_LIMIT);
          dom["analytics-trade-list"].innerHTML = visibleTrades.map(trade => {
            const resultR = Number(trade.resultR) || 0;
            return this.tradeRow({
              title: `${utils.escape(trade.asset || "Actif non défini")} · ${utils.escape(trade.strategy || "Stratégie non définie")}`,
              meta: `${utils.escape(trade.date)} · ${utils.escape(trade.session)} · ${utils.escape(trade.timeframeCombination || trade.ltf || "")}`,
              badges: [{ tone: utils.tone(resultR), label: utils.formatR(resultR) }]
            });
          }).join("") + (trades.length > HISTORY_DISPLAY_LIMIT
            ? `<p class="muted" style="text-align:center; padding:12px;">${HISTORY_DISPLAY_LIMIT} trades affichés sur ${trades.length} correspondant aux filtres.</p>`
            : "");
        },
};