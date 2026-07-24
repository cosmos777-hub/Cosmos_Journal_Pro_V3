// Sprint 1 — ARCH-001 (Livraison 2) : moteur de calcul complet, déplacé tel quel
// depuis main.js. Regroupe les formules historiques (Document 05), le moteur V3
// (risque, R, Delta Émotionnel), le moteur d'analyse agrégé (Milestone 3),
// le moteur d'Insights (Milestone 4A) et le Jumeau Numérique + Centre de Mission
// (Milestone 4B/4C).
//
// Choix d'architecture assumé : ces cinq familles de fonctions restent dans UN SEUL
// objet plutôt que d'être éclatées en calculations.js/analytics.js/insights.js/
// missions.js séparés. Raison : generateInsights() et generateMission() appellent
// groupTradesByDimension()/winrate()/expectancy()/planRespectRate() via `this`,
// et buildTradeMetrics() fait de même avec riskAmount()/resultInR()/emotionalDeltaFull().
// Séparer ces fonctions en plusieurs fichiers aurait exigé de réécrire ces appels
// internes (risque de régression, Règle 7 du Sprint 1) sans bénéfice réel : la cohésion
// via "this" est précisément ce qui garantit qu'aucune formule n'est dupliquée entre
// Analytics, Insights et Missions (Document 04, Document 06).
export const calculations = {
        // --- Fonctions historiques (V3 fondations) : conservées à l'identique. ---
        // Ne jamais modifier ces deux fonctions sans mettre à jour Document 05.
        realPL(outcome, risk) {
          const r = Number(risk) || 0;
          const map = {
            "TP Max": r * 2,
            "Partiel + BE": r * 0.5,
            "Moitié SL": -r * 0.5,
            "Full SL": -r
          };
          return map[outcome] ?? 0;
        },
        theoreticalPL(outcome, risk) {
          const r = Number(risk) || 0;
          return outcome === "TP" ? r * 2 : -r;
        },
        summary(trades) {
          return trades.reduce((acc, trade) => {
            acc.real += Number(trade.realPL) || 0;
            acc.theoretical += Number(trade.theoreticalPL) || 0;
            acc.count += 1;
            return acc;
          }, { real: 0, theoretical: 0, count: 0, delta: 0 });
        },

        // --- Milestone 2A : moteur de calcul V3 (Document 05, sections 4 et 5). ---
        // Toutes ces fonctions sont pures : même entrée -> même sortie, aucun effet de bord.

        // Montant réellement risqué sur un trade, dérivé du capital du compte au moment du trade.
        riskAmount(capital, riskPercent) {
          const c = Number(capital) || 0;
          const r = Number(riskPercent) || 0;
          return +(c * (r / 100)).toFixed(2);
        },

        // Convertit un P&L exprimé en "points de risque" (ex: 2 = 2R) en multiple de R.
        // Sert de pont entre l'ancien moteur (realPL/theoreticalPL en %) et le nouveau moteur en R.
        resultInR(pl, riskPercent) {
          const r = Number(riskPercent) || 0;
          if (!r) return 0;
          return +((Number(pl) || 0) / r).toFixed(4);
        },

        // Résultat exprimé en devise, à partir du résultat en R et du montant risqué.
        resultCurrency(resultR, riskAmount) {
          return +((Number(resultR) || 0) * (Number(riskAmount) || 0)).toFixed(2);
        },

        // Inverse de resultCurrency : nécessaire au Milestone 2C, où l'utilisateur saisit
        // directement le résultat en devise (Carte 5) plutôt qu'un outcome catégoriel.
        resultRFromCurrency(resultCurrency, riskAmount) {
          const amount = Number(riskAmount) || 0;
          if (!amount) return 0;
          return +((Number(resultCurrency) || 0) / amount).toFixed(4);
        },

        // Durée automatique d'un trade (Document 02, Carte 2). Retourne null tant que les
        // heures d'entrée/sortie ne sont pas collectées (arrivera au Milestone 2C).
        durationMinutes(entryISO, exitISO) {
          if (!entryISO || !exitISO) return null;
          const start = new Date(entryISO).getTime();
          const end = new Date(exitISO).getTime();
          if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
          return Math.round((end - start) / 60000);
        },

        // Delta Émotionnel complet (Document 05, section 5) : différence entre le résultat
        // réel et le résultat théorique, exprimée en R puis convertie en devise.
        emotionalDeltaFull(realResultR, theoreticalResultR, riskAmount) {
          const deltaR = (Number(realResultR) || 0) - (Number(theoreticalResultR) || 0);
          return {
            r: +deltaR.toFixed(4),
            currency: +(deltaR * (Number(riskAmount) || 0)).toFixed(2)
          };
        },

        // --- Moteur d'analyse agrégé (Document 05, sections 4 et 6). ---
        // Fondations prêtes pour le Milestone 3 (Dashboard & Analytics) ; non branchées à l'UI pour l'instant.
        winrate(trades) {
          const closed = trades.filter(t => typeof t.resultR === "number");
          if (!closed.length) return null;
          const wins = closed.filter(t => t.resultR > 0).length;
          return +((wins / closed.length) * 100).toFixed(2);
        },
        profitFactor(trades) {
          const gains = trades.reduce((sum, t) => sum + (Number(t.resultCurrency) > 0 ? Number(t.resultCurrency) : 0), 0);
          const losses = trades.reduce((sum, t) => sum + (Number(t.resultCurrency) < 0 ? Math.abs(Number(t.resultCurrency)) : 0), 0);
          if (!losses) return gains > 0 ? Infinity : 0;
          return +(gains / losses).toFixed(2);
        },
        expectancy(trades) {
          const closed = trades.filter(t => typeof t.resultR === "number");
          if (!closed.length) return 0;
          const wins = closed.filter(t => t.resultR > 0);
          const losses = closed.filter(t => t.resultR < 0);
          const winRatio = wins.length / closed.length;
          const lossRatio = losses.length / closed.length;
          const avgWinR = wins.length ? wins.reduce((s, t) => s + t.resultR, 0) / wins.length : 0;
          const avgLossR = losses.length ? Math.abs(losses.reduce((s, t) => s + t.resultR, 0) / losses.length) : 0;
          return +((avgWinR * winRatio) - (avgLossR * lossRatio)).toFixed(4);
        },
        averageDuration(trades) {
          const withDuration = trades.filter(t => typeof t.durationMinutes === "number");
          if (!withDuration.length) return null;
          return Math.round(withDuration.reduce((s, t) => s + t.durationMinutes, 0) / withDuration.length);
        },
        averageRR(trades) {
          const withRR = trades.filter(t => typeof t.rrObtained === "number");
          if (!withRR.length) return null;
          return +(withRR.reduce((s, t) => s + t.rrObtained, 0) / withRR.length).toFixed(2);
        },
        // Milestone 3A : % de trades où le plan a été respecté (Document 05 §9, KPI Dashboard).
        // Ignore les trades où planRespect n'est pas encore renseigné (legacy/2A/2B).
        planRespectRate(trades) {
          const answered = trades.filter(t => t.planRespect === "Oui" || t.planRespect === "Partiellement" || t.planRespect === "Non");
          if (!answered.length) return null;
          const respected = answered.filter(t => t.planRespect === "Oui").length;
          return +((respected / answered.length) * 100).toFixed(2);
        },
        // Drawdown maximum (%) recalculé après chaque trade, en ordre chronologique.
        drawdownMax(trades, initialCapital) {
          let capital = Number(initialCapital) || 0;
          let peak = capital;
          let maxDrawdown = 0;
          const chronological = [...trades].reverse(); // trades stockés du plus récent au plus ancien
          chronological.forEach(trade => {
            capital += Number(trade.resultCurrency) || 0;
            peak = Math.max(peak, capital);
            const dd = peak > 0 ? ((peak - capital) / peak) * 100 : 0;
            if (dd > maxDrawdown) maxDrawdown = dd;
          });
          return +maxDrawdown.toFixed(2);
        },

        // Milestone 2C : moteur de calcul du formulaire 8 cartes (Document 02).
        // Remplace buildTradeMetrics (ancien modèle par outcome catégoriel "TP Max"/"Full SL"),
        // explicitement annoncé comme temporaire depuis le Milestone 1. Les fonctions realPL/
        // theoreticalPL restent intactes ci-dessus : elles servent encore à lire les anciens
        // trades migrés (source: "v3-foundation") sans jamais les modifier ni les supprimer.
        //
        // Nouveau modèle : l'utilisateur saisit le résultat réel en devise (Carte 5) et le RR
        // prévu (Carte 4). Le résultat théorique ("Trade idéal", Document 05 §8 - Jumeau
        // Numérique) est déduit du RR prévu, jamais saisi séparément.
        buildTradeMetricsV3Cards({ resultCurrency, riskAmount, riskCapitalSnapshot, rrPlanned }) {
          const resultR = this.resultRFromCurrency(resultCurrency, riskAmount);
          const theoreticalResultR = Number(rrPlanned) || 0;
          const theoreticalResultCurrency = this.resultCurrency(theoreticalResultR, riskAmount);
          const resultPercent = riskCapitalSnapshot ? +((Number(resultCurrency) / riskCapitalSnapshot) * 100).toFixed(2) : 0;
          const deltaFull = this.emotionalDeltaFull(resultR, theoreticalResultR, riskAmount);
          const rounded = Math.round((Number(resultCurrency) || 0) * 100) / 100;
          const tradeStatus = rounded > 0 ? "Gagnant" : rounded < 0 ? "Perdant" : "BE";
          return {
            resultR,
            resultCurrency: rounded,
            resultPercent,
            theoreticalResultR,
            theoreticalResultCurrency,
            emotionalDeltaR: deltaFull.r,
            emotionalDeltaCurrency: deltaFull.currency,
            tradeStatus
          };
        },

        // Milestone 3B : filtre pur les trades selon les critères Analytics (Document 03).
        // Un filtre vide ("") n'exclut rien pour ce critère. Fonction pure : ne modifie jamais
        // le tableau reçu, retourne un nouveau tableau.
        filterTrades(trades, filters = {}) {
          return trades.filter(trade => {
            if (filters.accountId && trade.accountId !== filters.accountId) return false;
            if (filters.asset && trade.asset !== filters.asset) return false;
            if (filters.session && trade.session !== filters.session) return false;
            if (filters.htf && trade.htf !== filters.htf) return false;
            if (filters.ltf && trade.ltf !== filters.ltf) return false;
            if (filters.strategy && trade.strategy !== filters.strategy) return false;
            if (filters.dateFrom || filters.dateTo) {
              // Le filtre de période ne peut s'appliquer qu'aux trades avec une date ISO
              // (saisie via le formulaire 8 cartes, Milestone 2C). Les trades legacy/2A-2B
              // (date au format localisé "08 juil., 14:32") sont exclus dès qu'un filtre de
              // période est actif, faute de pouvoir les situer de façon fiable dans la plage.
              if (!/^\d{4}-\d{2}-\d{2}$/.test(trade.date)) return false;
              if (filters.dateFrom && trade.date < filters.dateFrom) return false;
              if (filters.dateTo && trade.date > filters.dateTo) return false;
            }
            return true;
          });
        },

        // Milestone 3C (Document 02, section ANALYTICS) : regroupe des trades déjà filtrés
        // par une dimension donnée, et calcule les mêmes statistiques que le Dashboard/Analytics
        // pour chaque groupe. Fonction pure, aucune formule dupliquée (réutilise winrate,
        // profitFactor, expectancy, averageRR déjà existants).
        groupTradesByDimension(trades, dimension, accounts) {
          const bucketOf = trade => {
            switch (dimension) {
              case "account": {
  const account = accounts.find(a => a.id === trade.accountId);
  return account ? account.name : (trade.accountName || "Compte inconnu");
}
              case "asset": return trade.asset || "Non défini";
              case "strategy": return trade.strategy || "Non définie";
              case "session": return trade.session || "Non définie";
              case "htf": return trade.htf || "Non défini";
              case "ltf": return trade.ltf || "Non défini";
              case "combination": return trade.timeframeCombination || "Non définie";
              case "risk": return trade.riskPercent != null ? `${trade.riskPercent}%` : "Non défini";
              case "setupQuality": return trade.setupQuality ? `${trade.setupQuality} ★` : "Non renseignée";
              case "planRespect": return trade.planRespect || "Non renseigné";
              case "manualIntervention": return trade.manualIntervention || "Non renseigné";
              case "duration": {
                const d = trade.durationMinutes;
                if (typeof d !== "number") return "Non renseignée";
                if (d < 15) return "< 15 min";
                if (d < 30) return "15-30 min";
                if (d < 60) return "30-60 min";
                return "> 60 min";
              }
              default: return "Non défini";
            }
          };

          const groups = new Map();
          trades.forEach(trade => {
            const label = bucketOf(trade);
            if (!groups.has(label)) groups.set(label, []);
            groups.get(label).push(trade);
          });

          return Array.from(groups.entries())
            .map(([label, groupTrades]) => ({
              label,
              count: groupTrades.length,
              winrate: this.winrate(groupTrades),
              profitFactor: this.profitFactor(groupTrades),
              expectancy: this.expectancy(groupTrades),
              averageRR: this.averageRR(groupTrades),
              totalResultCurrency: +groupTrades.reduce((sum, t) => sum + (Number(t.resultCurrency) || 0), 0).toFixed(2)
            }))
            .sort((a, b) => b.count - a.count);
        },

        // Milestone 4 (Document 05 §7) : "Ne jamais inventer une conclusion". Un Insight n'est
        // généré que si l'échantillon global est statistiquement pertinent (30 trades minimum),
        // et chaque comparaison interne exige au moins 5 trades par groupe. Réutilise
        // groupTradesByDimension (3C) et expectancy/winrate (2A) — aucune formule dupliquée.
        generateInsights(trades, accounts) {
          const MIN_SAMPLE = 30;
          const MIN_GROUP = 5;

          if (trades.length < MIN_SAMPLE) {
            return { ready: false, sampleSize: trades.length, minSample: MIN_SAMPLE, insights: [] };
          }

          const insights = [];
          const bySetupQuality = this.groupTradesByDimension(trades, "setupQuality", accounts).filter(g => g.count >= MIN_GROUP && g.winrate != null);
          if (bySetupQuality.length >= 2) {
            const sorted = [...bySetupQuality].sort((a, b) => b.winrate - a.winrate);
            const best = sorted[0];
            const worst = sorted[sorted.length - 1];
            if (best.label !== worst.label) {
              insights.push({ type: "force", text: `Tes setups notés ${best.label} ont un taux de réussite de ${best.winrate.toFixed(0)}%, contre ${worst.winrate.toFixed(0)}% pour ${worst.label}.` });
            }
          }

          const byIntervention = this.groupTradesByDimension(trades, "manualIntervention", accounts).filter(g => g.count >= MIN_GROUP);
          const interventionOui = byIntervention.find(g => g.label === "Oui");
          const interventionNon = byIntervention.find(g => g.label === "Non");
          if (interventionOui && interventionNon) {
            const diff = interventionNon.expectancy - interventionOui.expectancy;
            if (diff > 0) {
              insights.push({ type: "faiblesse", text: `Les trades où tu interviens manuellement réduisent ton expectancy moyenne de ${diff.toFixed(2)}R.` });
            }
          }

          const byCombo = this.groupTradesByDimension(trades, "combination", accounts).filter(g => g.count >= MIN_GROUP);
          if (byCombo.length) {
            // Profit brut (somme des gains uniquement) comme référence, pour éviter qu'un
            // groupe perdant ailleurs ne fasse dépasser 100% la part d'un groupe gagnant.
            const grossProfit = trades.reduce((sum, t) => sum + Math.max(0, Number(t.resultCurrency) || 0), 0);
            const best = [...byCombo].sort((a, b) => b.totalResultCurrency - a.totalResultCurrency)[0];
            if (best && grossProfit > 0 && best.totalResultCurrency > 0) {
              const shareTrades = (best.count / trades.length) * 100;
              const shareProfit = Math.min(100, (best.totalResultCurrency / grossProfit) * 100);
              insights.push({ type: "opportunite", text: `La combinaison ${best.label} représente ${shareTrades.toFixed(0)}% de tes trades mais ${shareProfit.toFixed(0)}% de ton profit brut.` });
            }
          }

          const byRisk = this.groupTradesByDimension(trades, "risk", accounts).filter(g => g.count >= MIN_GROUP);
          if (byRisk.length >= 2) {
            const sorted = [...byRisk].sort((a, b) => b.expectancy - a.expectancy);
            const best = sorted[0];
            const worst = sorted[sorted.length - 1];
            if (best.label !== worst.label && best.expectancy > worst.expectancy) {
              insights.push({ type: "recommandation", text: `Tu performes mieux avec un risque de ${best.label} (expectancy ${best.expectancy.toFixed(2)}R) qu'avec ${worst.label} (${worst.expectancy.toFixed(2)}R).` });
            }
          }

          const byPlanRespect = this.groupTradesByDimension(trades, "planRespect", accounts).filter(g => g.count >= MIN_GROUP);
          const planOui = byPlanRespect.find(g => g.label === "Oui");
          const planNon = byPlanRespect.find(g => g.label === "Non");
          if (planOui && planNon) {
            const diff = planOui.expectancy - planNon.expectancy;
            if (diff > 0) {
              insights.push({ type: "force", text: `Respecter ton plan de trading améliore ton expectancy de ${diff.toFixed(2)}R en moyenne.` });
            }
          }

          return { ready: true, sampleSize: trades.length, minSample: MIN_SAMPLE, insights };
        },

        // Milestone 4 (Document 05 §8, "Jumeau Numérique") : construit les deux courbes de
        // capital — réelle et théorique (exécution parfaite du plan) — en ordre chronologique.
        // Dérive le résultat théorique par trade à partir de theoreticalPL/riskPercent/riskAmount
        // déjà stockés, sans introduire de nouveau champ ni dupliquer resultInR/resultCurrency.
        buildEquityCurve(trades, initialCapital) {
          const chronological = [...trades].reverse(); // trades stockés du plus récent au plus ancien
          let real = Number(initialCapital) || 0;
          let theoretical = real;
          const points = [{ real: +real.toFixed(2), theoretical: +theoretical.toFixed(2) }];

          chronological.forEach(trade => {
            real += Number(trade.resultCurrency) || 0;
            const theoreticalResultR = this.resultInR(trade.theoreticalPL, trade.riskPercent);
            theoretical += this.resultCurrency(theoreticalResultR, trade.riskAmount);
            points.push({ real: +real.toFixed(2), theoretical: +theoretical.toFixed(2) });
          });

          return points;
        },

        // Milestone 4C (Document 03, "Centre de Mission") : choisit UNE mission pertinente
        // selon une cascade de priorités, réutilisant planRespectRate/groupTradesByDimension/
        // les champs déjà stockés sur chaque trade — aucune nouvelle formule statistique.
        generateMission(trades) {
          if (!trades.length) {
            return {
              title: "Construire une base statistique fiable",
              copy: "Ajoutez vos premiers trades pour permettre à Cosmos de comparer le résultat réel, le résultat théorique et le Delta émotionnel."
            };
          }

          const MIN_SAMPLE = 30;
          if (trades.length < MIN_SAMPLE) {
            const remaining = MIN_SAMPLE - trades.length;
            return {
              title: "Débloquer les Insights automatiques",
              copy: `Enregistrez encore ${remaining} trade${remaining > 1 ? "s" : ""} (${trades.length}/${MIN_SAMPLE}) pour que Cosmos génère des observations fiables sur tes habitudes.`
            };
          }

          // Priorité 1 : le Delta Émotionnel cumulé est le pilier de discipline (Document 01).
          const cumulativeDeltaR = +trades.reduce((sum, t) => sum + (Number(t.emotionalDeltaR) || 0), 0).toFixed(1);
          if (cumulativeDeltaR < -3) {
            const target = +(cumulativeDeltaR / 2).toFixed(1);
            return {
              title: "Réduire le coût de tes émotions",
              copy: `Ton Delta Émotionnel cumulé est de ${cumulativeDeltaR}R. Objectif du mois : le ramener au-dessus de ${target}R en respectant ton plan sur les prochains trades.`
            };
          }

          // Priorité 2 : l'intervention manuelle coûte cher en expectancy.
          const byIntervention = this.groupTradesByDimension(trades, "manualIntervention", []).filter(g => g.count >= 5);
          const interventionOui = byIntervention.find(g => g.label === "Oui");
          const interventionNon = byIntervention.find(g => g.label === "Non");
          if (interventionOui && interventionNon && (interventionNon.expectancy - interventionOui.expectancy) > 0.3) {
            const diff = +(interventionNon.expectancy - interventionOui.expectancy).toFixed(2);
            return {
              title: "Réduire les interventions manuelles",
              copy: `Elles coûtent en moyenne ${diff}R d'expectancy. Objectif : laisser tes ${interventionOui.count} prochains trades suivre le plan sans intervenir.`
            };
          }

          // Priorité 3 : respect du plan perfectible.
          const planRespect = this.planRespectRate(trades);
          if (planRespect != null && planRespect < 80) {
            return {
              title: "Améliorer le respect du plan",
              copy: `Ton taux de respect du plan est de ${planRespect.toFixed(0)}%. Objectif du mois : viser 90% sur tes prochains trades.`
            };
          }

          // Par défaut : rien d'alarmant, encourager la continuité.
          return {
            title: "Continuer à construire l'échantillon",
            copy: `${trades.length} trades enregistrés, aucune faiblesse majeure détectée. Continue à documenter chaque trade pour affiner les Insights.`
          };
        }
};