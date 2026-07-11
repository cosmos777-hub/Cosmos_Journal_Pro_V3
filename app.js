(() => {
      "use strict";

      const APP_VERSION = "3.0";
      const STORAGE_KEY = "cosmos_v3_data";
      // Milestone 5B (Document 06 §7) : nombre de trades affichés dans les listes d'historique.
      // Purement un plafond d'AFFICHAGE — toutes les données restent en mémoire et exploitables
      // sans limite via les filtres Analytics (3B/3C).
      const HISTORY_DISPLAY_LIMIT = 150;
      const LEGACY_TRADES_KEY = "cosmos_trades";
      const LEGACY_PREFS_KEY = "cosmos_prefs";

      const defaults = {
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
          activeSettingsCategory: "accounts"
        }
      };

      // Règle métier centralisée (Document 02, Carte 1) : les paliers de risque disponibles
      // dépendent strictement du type de compte. Ce n'est pas une liste personnalisable
      // (contrairement aux actifs/stratégies/sessions) : c'est une règle produit fixe.
      const RISK_LEVELS_BY_ACCOUNT_TYPE = {
        "Prop Firm": [0.25, 0.5, 0.75, 1],
        "Fonds propres": [5, 7.5, 10, 12.5, 15]
      };
      function riskLevelsFor(accountType) {
        return RISK_LEVELS_BY_ACCOUNT_TYPE[accountType] || RISK_LEVELS_BY_ACCOUNT_TYPE["Fonds propres"];
      }

      const featureRegistry = [
        { id: "accounts", name: "Multi-comptes", dependsOn: ["storage"], produces: ["journal", "risk"], status: "active" },
        { id: "settings", name: "Paramètres dynamiques", dependsOn: ["storage"], produces: ["journal", "analytics"], status: "active" },
        { id: "analytics", name: "Analytics", dependsOn: ["trades"], produces: ["dashboard"], status: "active" },
        { id: "insights", name: "Insights & Jumeau Numérique", dependsOn: ["trades", "accounts"], produces: ["dashboard"], status: "active" }
      ];

      const state = {
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
        currentView: "dashboard"
      };

      const WIZARD_CARD_LABELS = [
        "Compte", "Trade", "Analyse", "Gestion", "Résultat", "Delta émotionnel", "Notes", "Validation"
      ];

      const dom = {};

      const utils = {
        uid(prefix) {
          return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        },
        clone(value) {
          return JSON.parse(JSON.stringify(value));
        },
        escape(value) {
          return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        },
        formatPercent(value) {
          const number = Number(value) || 0;
          return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
        },
        // Milestone 2C : formate une valeur en multiples de R (Document 05), utilisé par
        // l'historique pour afficher réel/plan/delta de façon uniforme, legacy ou V3-8cartes.
        formatR(value) {
          const number = Number(value) || 0;
          return `${number >= 0 ? "+" : ""}${number.toFixed(2)}R`;
        },
        tone(value) {
          if (value > 0) return "positive";
          if (value < 0) return "negative";
          return "neutral";
        }
      };

      const calculations = {
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
                return account ? account.name : "Compte inconnu";
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

      const storage = {
        load() {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            try {
              return this.normalize(JSON.parse(saved));
            } catch (error) {
              console.warn("Cosmos storage parse failed", error);
            }
          }
          return this.migrateLegacy();
        },
        normalize(data) {
          const accounts = Array.isArray(data.accounts) && data.accounts.length ? data.accounts : utils.clone(defaults.accounts);
          const rawTrades = Array.isArray(data.trades) ? data.trades : [];
          const normalized = {
            version: data.version || APP_VERSION,
            migratedFrom: data.migratedFrom || null,
            accounts,
            // Milestone 2A : chaque trade (V2 migré ou V3 déjà sauvegardé) passe par le moteur de
            // calcul V3 pour compléter les champs manquants (riskAmount, resultR, emotionalDelta...)
            // sans jamais supprimer ou écraser une donnée déjà présente.
            trades: rawTrades.map(trade => migrations.upgradeTradeV3Calc(trade, accounts)),
            settings: { ...utils.clone(defaults.settings), ...(data.settings || {}) },
            preferences: { ...utils.clone(defaults.preferences), ...(data.preferences || {}) },
            featureRegistry
          };
          normalized.version = APP_VERSION;
          return normalized;
        },
        migrateLegacy() {
          const legacyTrades = this.readJSON(LEGACY_TRADES_KEY, []);
          const legacyPrefs = this.readJSON(LEGACY_PREFS_KEY, null);
          const data = this.normalize({
            version: APP_VERSION,
            migratedFrom: legacyTrades.length || legacyPrefs ? "2.0" : null,
            accounts: utils.clone(defaults.accounts),
            trades: legacyTrades.map(migrations.tradeV2ToV3),
            settings: legacyPrefs ? migrations.prefsV2ToSettings(legacyPrefs) : utils.clone(defaults.settings),
            preferences: utils.clone(defaults.preferences)
          });
          this.save(data);
          return data;
        },
        readJSON(key, fallback) {
          try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
          } catch (error) {
            console.warn(`Unable to parse ${key}`, error);
            return fallback;
          }
        },
        save(data = state.data) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
      };

      const migrations = {
        // Milestone 2A : complète un trade (peu importe son origine — legacy V2, V3 fondations,
        // ou déjà V3 complet) avec les champs du moteur de calcul V3. Fonction pure et idempotente :
        // appliquée plusieurs fois sur le même trade, elle produit toujours le même résultat.
        upgradeTradeV3Calc(trade, accounts) {
          const account = accounts.find(a => a.id === trade.accountId) || accounts[0];
          // riskCapitalSnapshot = capital du compte au moment précis où le trade a été pris.
          // C'est la référence à utiliser pour le risque, jamais le capital actuel (qui bouge avec les trades suivants).
          const capitalAtRisk = trade.riskCapitalSnapshot != null ? trade.riskCapitalSnapshot : (account ? account.initialCapital : 0);
          const riskPercent = Number(trade.riskPercent) || 0;

          const riskAmount = trade.riskAmount != null ? trade.riskAmount : calculations.riskAmount(capitalAtRisk, riskPercent);
          const resultR = trade.resultR != null ? trade.resultR : calculations.resultInR(trade.realPL, riskPercent);
          const theoreticalResultR = calculations.resultInR(trade.theoreticalPL, riskPercent);
          const resultCurrency = trade.resultCurrency != null ? trade.resultCurrency : calculations.resultCurrency(resultR, riskAmount);
          const deltaFull = calculations.emotionalDeltaFull(resultR, theoreticalResultR, riskAmount);

          return {
            // Valeurs par défaut V3 (Documents 02 et 05) pour tout champ pas encore collecté par l'UI.
            entryTime: null,
            exitTime: null,
            durationMinutes: null,
            setupQuality: null,
            confluences: [],
            rrPlanned: null,
            planRespect: null,
            manualIntervention: null,
            emotionalCause: null,
            emotionalCausesSecondary: [],
            tags: [],
            media: { htf: null, ltf: null, result: null },
            // Conserve tout ce que le trade avait déjà (jamais de suppression de donnée existante).
            ...trade,
            // Champs canoniques du moteur de calcul V3 : toujours recalculés pour rester cohérents.
            riskCapitalSnapshot: capitalAtRisk,
            riskAmount,
            resultR,
            resultCurrency,
            resultPercent: trade.resultPercent != null ? trade.resultPercent : trade.realPL,
            rrObtained: trade.rrObtained != null ? trade.rrObtained : resultR,
            emotionalDeltaR: deltaFull.r,
            emotionalDeltaCurrency: deltaFull.currency,
            updatedAt: trade.updatedAt || trade.createdAt || new Date().toISOString()
          };
        },
        prefsV2ToSettings(prefs) {
          return {
            ...utils.clone(defaults.settings),
            assets: Array.isArray(prefs.assets) ? prefs.assets : defaults.settings.assets,
            sessions: Array.isArray(prefs.sessions) ? prefs.sessions : defaults.settings.sessions,
            strategies: Array.isArray(prefs.strategies) ? prefs.strategies : defaults.settings.strategies,
            ltf: Array.isArray(prefs.uts) ? prefs.uts : defaults.settings.ltf
          };
        },
        tradeV2ToV3(trade) {
          const risk = Number(trade.risk) || 0.25;
          return {
            id: String(trade.id || utils.uid("trade")),
            accountId: "acc-personal-40",
            date: trade.date || new Date().toLocaleDateString("fr-FR"),
            asset: trade.asset || "",
            direction: trade.direction || "Buy",
            session: trade.session || "",
            strategy: trade.strategy || "",
            htf: trade.htf || "",
            ltf: trade.ltf || trade.ut || "",
            timeframeCombination: trade.htf && (trade.ltf || trade.ut) ? `${trade.htf} -> ${trade.ltf || trade.ut}` : trade.ut || "",
            setupQuality: trade.setupQuality || null,
            confluences: Array.isArray(trade.confluences) ? trade.confluences : [],
            riskPercent: risk,
            riskAmount: null,
            realOutcome: trade.realOutcome || "",
            theoreticalOutcome: trade.theoOutcome || trade.theoreticalOutcome || "",
            realPL: Number(trade.realPL) || 0,
            theoreticalPL: Number(trade.theoPL ?? trade.theoreticalPL) || 0,
            emotionalDelta: (Number(trade.realPL) || 0) - (Number(trade.theoPL ?? trade.theoreticalPL) || 0),
            notes: trade.notes || "",
            media: {
              htf: trade.imgHTF || null,
              ltf: trade.imgLTF || null,
              result: trade.imgResult || null
            },
            tags: Array.isArray(trade.tags) ? trade.tags : [],
            createdAt: new Date().toISOString(),
            source: trade.source || "legacy-v2"
          };
        }
      };

      const ui = {
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
            "notes", "tags-input", "capture-htf-input", "capture-ltf-input", "capture-result-input",
            "validation-summary", "wizard-prev", "wizard-next", "wizard-progress-fill", "wizard-step-label",
            "trade-form", "journal-panel", "history-panel",
            "trade-list", "history-subtitle", "kpi-real", "kpi-theoretical", "kpi-delta",
            "kpi-count", "delta-note", "settings-modal", "settings-nav", "settings-content",
            "export-modal", "export-output", "import-modal", "import-input", "import-file", "import-feedback",
            "toast-stack", "feature-registry", "data-version",
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
        renderFeatureRegistry() {
          dom["feature-registry"].innerHTML = featureRegistry.map(feature => `
            <span class="badge">${utils.escape(feature.name)} · ${utils.escape(feature.status)}</span>
          `).join("");
        },
        renderSelectors() {
          const activeAccounts = state.data.accounts.filter(account => !account.archived);
          dom["account-select"].innerHTML = activeAccounts.map(account => `
            <option value="${utils.escape(account.id)}">${utils.escape(account.name)} · ${utils.escape(account.currency)}</option>
          `).join("");

          this.renderChips(dom["asset-options"], state.data.settings.assets, state.selectedAsset, value => {
            state.selectedAsset = value;
            document.getElementById("asset-value").value = value;
            this.renderSelectors();
          });

          this.renderChips(dom["strategy-options"], state.data.settings.strategies, state.selectedStrategy, value => {
            state.selectedStrategy = value;
            document.getElementById("strategy-value").value = value;
            this.renderSelectors();
          });

          this.renderChips(dom["direction-options"], ["Buy", "Sell"], state.selectedDirection, value => {
            state.selectedDirection = value;
            dom["direction-value"].value = value;
            this.renderSelectors();
          });

          this.renderChips(dom["emotional-cause-options"], state.data.settings.emotionalCauses, state.selectedEmotionalCause, value => {
            state.selectedEmotionalCause = value;
            dom["emotional-cause-value"].value = value;
            this.renderSelectors();
          });

          this.renderChips(dom["manual-intervention-options"], ["Oui", "Non"], state.selectedManualIntervention, value => {
            state.selectedManualIntervention = value;
            dom["manual-intervention-value"].value = value;
            this.renderSelectors();
            this.updateResultPreviews();
          });

          dom["session-select"].innerHTML = state.data.settings.sessions.map(value => `<option>${utils.escape(value)}</option>`).join("");
          dom["timeframe-select"].innerHTML = state.data.settings.ltf.map(value => `<option>${utils.escape(value)}</option>`).join("");
          dom["htf-select"].innerHTML = state.data.settings.htf.map(value => `<option>${utils.escape(value)}</option>`).join("");

          this.renderChecklist(dom["confluences-options"], state.data.settings.confluences, state.selectedConfluences, value => {
            const index = state.selectedConfluences.indexOf(value);
            if (index === -1) state.selectedConfluences.push(value); else state.selectedConfluences.splice(index, 1);
          });

          this.renderChecklist(dom["emotional-causes-secondary-options"], state.data.settings.emotionalCauses, state.selectedEmotionalCausesSecondary, value => {
            const index = state.selectedEmotionalCausesSecondary.indexOf(value);
            if (index === -1) state.selectedEmotionalCausesSecondary.push(value); else state.selectedEmotionalCausesSecondary.splice(index, 1);
          });

          this.renderStars();
          this.renderRiskOptions();
          this.updateComboPreview();
          this.updateDurationPreview();
          this.updateResultPreviews();
        },
        // Milestone 2B : régénère les paliers de risque selon le type du compte sélectionné,
        // et rafraîchit l'aperçu du montant risqué en temps réel (Document 02).
        renderRiskOptions() {
          const account = state.data.accounts.find(a => a.id === dom["account-select"].value) || state.data.accounts[0];
          const levels = riskLevelsFor(account ? account.type : null);
          const previousValue = Number(dom["risk-select"].value);
          const keepPrevious = levels.includes(previousValue);

          dom["risk-select"].innerHTML = levels.map(level => `
            <option value="${level}"${!keepPrevious && level === levels[0] ? " selected" : ""}>${level}%</option>
          `).join("");
          if (keepPrevious) dom["risk-select"].value = String(previousValue);

          if (dom["account-type-preview"] && account) {
            dom["account-type-preview"].textContent = `Type : ${account.type} · Capital actuel : ${account.currentCapital.toFixed(2)} ${account.currency}`;
          }

          this.updateRiskPreview(account);
        },
        // Affiche instantanément le montant réellement risqué en devise du compte actif.
        updateRiskPreview(account) {
          if (!dom["risk-amount-preview"]) return;
          const acc = account || state.data.accounts.find(a => a.id === dom["account-select"].value);
          if (!acc) {
            dom["risk-amount-preview"].textContent = "";
            return;
          }
          const riskPercent = Number(dom["risk-select"].value) || 0;
          const amount = calculations.riskAmount(acc.currentCapital, riskPercent);
          dom["risk-amount-preview"].textContent = `Montant risqué : ${amount.toFixed(2)} ${acc.currency} (sur ${acc.currentCapital.toFixed(2)} ${acc.currency})`;
          if (dom["gestion-risk-summary"]) {
            dom["gestion-risk-summary"].textContent = `Risque : ${riskPercent}% · Montant risqué : ${amount.toFixed(2)} ${acc.currency}`;
          }
          this.updateResultPreviews();
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
        renderStars() {
          if (!dom["setup-quality-stars"]) return;
          dom["setup-quality-stars"].innerHTML = "";
          for (let i = 1; i <= 5; i += 1) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `star-button${i <= state.selectedSetupQuality ? " active" : ""}`;
            button.textContent = "★";
            button.addEventListener("click", () => {
              state.selectedSetupQuality = state.selectedSetupQuality === i ? 0 : i;
              dom["setup-quality-value"].value = String(state.selectedSetupQuality);
              this.renderStars();
            });
            dom["setup-quality-stars"].appendChild(button);
          }
        },
        // Combinaison HTF -> LTF enregistrée comme valeur unique (Document 02, Carte 3).
        updateComboPreview() {
          if (!dom["combo-preview"]) return;
          const htf = dom["htf-select"].value;
          const ltf = dom["timeframe-select"].value;
          dom["combo-preview"].textContent = htf && ltf ? `Combinaison : ${htf} → ${ltf}` : "Combinaison : —";
        },
        // Durée automatique du trade (Document 02, Carte 2).
        updateDurationPreview() {
          if (!dom["duration-preview"]) return;
          const date = dom["trade-date"].value;
          const entry = dom["entry-time"].value;
          const exit = dom["exit-time"].value;
          if (!date || !entry || !exit) {
            dom["duration-preview"].textContent = "Durée : —";
            return;
          }
          const minutes = calculations.durationMinutes(`${date}T${entry}`, `${date}T${exit}`);
          dom["duration-preview"].textContent = minutes != null ? `Durée : ${minutes} min` : "Durée : heure de sortie antérieure à l'entrée ?";
        },
        // Milestone 2C : recalcule en direct tout ce qui dépend du résultat saisi (Cartes 4, 5, 6),
        // sans jamais dupliquer le moteur de calcul (calculations.buildTradeMetricsV3Cards).
        updateResultPreviews() {
          if (!dom["result-percent-display"]) return;
          const account = state.data.accounts.find(a => a.id === dom["account-select"].value);
          if (!account) return;

          const riskPercent = Number(dom["risk-select"].value) || 0;
          const riskCapitalSnapshot = state.editingTradeId
            ? (state.data.trades.find(t => t.id === state.editingTradeId)?.riskCapitalSnapshot ?? account.currentCapital)
            : account.currentCapital;
          const riskAmount = calculations.riskAmount(riskCapitalSnapshot, riskPercent);
          const resultCurrency = Number(dom["result-currency-input"].value) || 0;
          const rrPlanned = Number(dom["rr-planned"].value) || 0;

          const metrics = calculations.buildTradeMetricsV3Cards({ resultCurrency, riskAmount, riskCapitalSnapshot, rrPlanned });

          dom["result-percent-display"].textContent = `Résultat % : ${metrics.resultPercent.toFixed(2)}%`;
          dom["trade-status-display"].textContent = `Trade : ${metrics.tradeStatus}`;
          dom["rr-obtained-display"].textContent = `RR obtenu : ${metrics.resultR.toFixed(2)}R`;
          dom["theoretical-result-display"].textContent = `Résultat théorique (plan) : ${metrics.theoreticalResultR.toFixed(2)}R soit ${metrics.theoreticalResultCurrency.toFixed(2)} ${account.currency}`;
          dom["real-result-display"].textContent = `Résultat réel : ${metrics.resultR.toFixed(2)}R soit ${metrics.resultCurrency.toFixed(2)} ${account.currency}`;
          dom["emotional-delta-display"].textContent = `Delta émotionnel : ${metrics.emotionalDeltaR.toFixed(2)}R soit ${metrics.emotionalDeltaCurrency.toFixed(2)} ${account.currency}`;

          this.updateValidationSummary(metrics, account);
        },
        // Récapitulatif de la Carte 8 (Document 03 : "un résumé intelligent qui se met à jour").
        updateValidationSummary(metrics, account) {
          if (!dom["validation-summary"]) return;
          const acc = account || state.data.accounts.find(a => a.id === dom["account-select"].value);
          if (!acc) return;
          const riskPercent = Number(dom["risk-select"].value) || 0;
          dom["validation-summary"].textContent =
            `${acc.name} · ${state.selectedAsset || "actif ?"} · ${state.selectedStrategy || "stratégie ?"} · ` +
            `Risque ${riskPercent}% · Résultat ${metrics.resultCurrency.toFixed(2)} ${acc.currency} (${metrics.tradeStatus}) · ` +
            `Delta émotionnel ${metrics.emotionalDeltaR.toFixed(2)}R.`;
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
        // Milestone 3B (Document 03 : "les graphiques se mettent à jour immédiatement, sans
        // bouton") : relit les filtres, recalcule avec le même moteur que le Dashboard (3A),
        // sans jamais dupliquer les formules.
        updateAnalyticsView() {
          if (!dom["analytics-kpi-count"]) return;
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
            dom["analytics-trade-list"].innerHTML = `
              <div class="empty-state">
                <div>
                  <h3>Aucun trade ne correspond</h3>
                  <p class="muted">Ajustez ou réinitialisez les filtres.</p>
                </div>
              </div>
            `;
            return;
          }
          // Milestone 5B : même plafond d'affichage que l'historique (Document 06 §7).
          const visibleTrades = trades.slice(0, HISTORY_DISPLAY_LIMIT);
          dom["analytics-trade-list"].innerHTML = visibleTrades.map(trade => {
            const resultR = Number(trade.resultR) || 0;
            return `
              <article class="trade-row">
                <div>
                  <p class="trade-title">${utils.escape(trade.asset || "Actif non défini")} · ${utils.escape(trade.strategy || "Stratégie non définie")}</p>
                  <p class="trade-meta">${utils.escape(trade.date)} · ${utils.escape(trade.session)} · ${utils.escape(trade.timeframeCombination || trade.ltf || "")}</p>
                </div>
                <span class="badge ${utils.tone(resultR)}">${utils.formatR(resultR)}</span>
              </article>
            `;
          }).join("") + (trades.length > HISTORY_DISPLAY_LIMIT
            ? `<p class="muted" style="text-align:center; padding:12px;">${HISTORY_DISPLAY_LIMIT} trades affichés sur ${trades.length} correspondant aux filtres.</p>`
            : "");
        },
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
        goToWizardCard(cardNumber) {
          const total = WIZARD_CARD_LABELS.length;
          const target = Math.min(Math.max(cardNumber, 1), total);
          state.currentCard = target;

          dom["trade-form"].querySelectorAll(".wizard-card").forEach(card => {
            card.classList.toggle("active", Number(card.dataset.card) === target);
          });

          dom["wizard-progress-fill"].style.width = `${(target / total) * 100}%`;
          dom["wizard-step-label"].textContent = `Carte ${target} / ${total} — ${WIZARD_CARD_LABELS[target - 1]}`;
          dom["wizard-prev"].style.visibility = target === 1 ? "hidden" : "visible";
          dom["wizard-next"].style.display = target === total ? "none" : "inline-flex";

          if (target === total) this.updateResultPreviews();
        },
        renderTrades() {
          const trades = state.data.trades;
          dom["history-subtitle"].textContent = trades.length ? `${trades.length} trade${trades.length > 1 ? "s" : ""} enregistré${trades.length > 1 ? "s" : ""}.` : "Aucun trade enregistré.";
          if (!trades.length) {
            dom["trade-list"].innerHTML = `
              <div class="empty-state">
                <div>
                  <h3>Aucun trade enregistré</h3>
                  <p class="muted">Ajoutez votre premier trade. Cosmos gardera la structure prête pour les Analytics V3.</p>
                </div>
              </div>
            `;
            return;
          }

          // Milestone 5B (Document 06 §7 : "Dashboard fluide avec plusieurs milliers de trades") :
          // l'historique affiché est plafonné aux HISTORY_DISPLAY_LIMIT trades les plus récents.
          // Aucune donnée n'est supprimée ni cachée ailleurs : la vue Analytics (3B/3C) donne
          // accès à l'intégralité de l'historique via ses filtres, sans cette limite d'affichage.
          const visibleTrades = trades.slice(0, HISTORY_DISPLAY_LIMIT);

          // resultR et emotionalDeltaR sont garantis présents sur TOUS les trades (legacy inclus)
          // grâce à la migration du Milestone 2A : l'affichage est donc unifié, sans branchement
          // selon la provenance du trade (règle Document 06 : pas de logique dupliquée).
          dom["trade-list"].innerHTML = visibleTrades.map(trade => {
            const resultR = Number(trade.resultR) || 0;
            const deltaR = Number(trade.emotionalDeltaR) || 0;
            const theoreticalR = resultR - deltaR;
            return `
              <article class="trade-row">
                <div>
                  <p class="trade-title">${utils.escape(trade.asset || "Actif non défini")} · ${utils.escape(trade.strategy || "Stratégie non définie")}</p>
                  <p class="trade-meta">${utils.escape(trade.date)} · ${utils.escape(trade.session)} · ${utils.escape(trade.timeframeCombination || trade.ltf || "")}</p>
                  ${trade.notes ? `<p class="trade-meta">${utils.escape(trade.notes)}</p>` : ""}
                </div>
                <span class="badge ${utils.tone(resultR)}">Réel ${utils.formatR(resultR)}</span>
                <span class="badge ${utils.tone(theoreticalR)}">Plan ${utils.formatR(theoreticalR)}</span>
                <span class="badge ${utils.tone(deltaR)}">Delta ${utils.formatR(deltaR)}</span>
                <div style="display:flex; gap:6px;">
                  <button type="button" class="button ghost" data-edit-trade="${utils.escape(trade.id)}">Modifier</button>
                  <button type="button" class="button danger" data-delete-trade="${utils.escape(trade.id)}">Supprimer</button>
                </div>
              </article>
            `;
          }).join("") + (trades.length > HISTORY_DISPLAY_LIMIT
            ? `<p class="muted" style="text-align:center; padding:12px;">Affichage des ${HISTORY_DISPLAY_LIMIT} trades les plus récents sur ${trades.length}. Utilisez Analytics pour explorer l'historique complet.</p>`
            : "");
        },
        // Bascule visuellement le formulaire entre "création" et "édition" d'un trade.
        // N'ajoute qu'un seul bouton "Annuler" dynamique, jamais dupliqué.
        setFormEditingMode(isEditing) {
          const submitButton = dom["trade-form"].querySelector('button[type="submit"]');
          if (!submitButton) return;
          submitButton.textContent = isEditing ? "Mettre à jour le trade" : "Enregistrer le trade";

          let cancelButton = dom["trade-form"].querySelector("[data-cancel-edit]");
          if (isEditing) {
            if (!cancelButton) {
              cancelButton = document.createElement("button");
              cancelButton.type = "button";
              cancelButton.className = "button ghost";
              cancelButton.textContent = "Annuler la modification";
              cancelButton.setAttribute("data-cancel-edit", "true");
              submitButton.insertAdjacentElement("afterend", cancelButton);
            }
          } else if (cancelButton) {
            cancelButton.remove();
          }
        },
        renderSettings() {
          const categories = settings.categories();
          const active = state.data.preferences.activeSettingsCategory || categories[0].id;

          dom["settings-nav"].innerHTML = categories.map(category => `
            <button class="button settings-tab ${category.id === active ? "active" : ""}" type="button" data-settings-category="${category.id}">
              ${utils.escape(category.label)}
            </button>
          `).join("");

          const category = categories.find(item => item.id === active) || categories[0];
          dom["settings-content"].innerHTML = settings.renderCategory(category);
        },
        openModal(modal) {
          modal.classList.add("open");
          modal.setAttribute("aria-hidden", "false");
        },
        closeModal(modal) {
          modal.classList.remove("open");
          modal.setAttribute("aria-hidden", "true");
        },
        toast(message) {
          const toast = document.createElement("div");
          toast.className = "toast";
          toast.textContent = message;
          dom["toast-stack"].appendChild(toast);
          setTimeout(() => toast.remove(), 3000);
        }
      };

      const settings = {
        categories() {
          return [
            { id: "accounts", label: "Comptes", type: "accounts" },
            { id: "assets", label: "Actifs", key: "assets" },
            { id: "sessions", label: "Sessions", key: "sessions" },
            { id: "htf", label: "HTF", key: "htf" },
            { id: "ltf", label: "LTF", key: "ltf" },
            { id: "strategies", label: "Stratégies", key: "strategies" },
            { id: "confluences", label: "Confluences", key: "confluences" },
            { id: "emotionalCauses", label: "Causes émotionnelles", key: "emotionalCauses" },
            { id: "tags", label: "Tags", key: "tags" },
            { id: "appearance", label: "Apparence", type: "appearance" }
          ];
        },
        renderCategory(category) {
          if (category.type === "accounts") return this.renderAccounts();
          if (category.type === "appearance") return this.renderAppearance();
          const values = state.data.settings[category.key] || [];
          return `
            <h3>${utils.escape(category.label)}</h3>
            <p class="muted">Ajoutez ou supprimez les options utilisées par le Journal et les Analytics.</p>
            <div class="setting-items">
              ${values.map((value, index) => `
                <span class="setting-pill">${utils.escape(value)} <button type="button" data-remove-setting="${category.key}" data-index="${index}" aria-label="Supprimer ${utils.escape(value)}">×</button></span>
              `).join("")}
            </div>
            <form class="form-grid" data-add-setting="${category.key}">
              <div class="field">
                <label for="setting-${category.key}">Nouvelle option</label>
                <input id="setting-${category.key}" name="value" type="text" autocomplete="off" required>
              </div>
              <button class="button primary" type="submit">Ajouter</button>
            </form>
          `;
        },
        renderAccounts() {
          return `
            <h3>Comptes</h3>
            <p class="muted">Fondation multi-comptes. Les règles avancées Prop Firm / Fonds propres seront enrichies au Milestone 2.</p>
            <div class="setting-items">
              ${state.data.accounts.map(account => `
                <span class="setting-pill">${utils.escape(account.name)} · ${utils.escape(account.type)} · ${utils.escape(account.currency)}</span>
              `).join("")}
            </div>
            <form class="form-grid" data-add-account>
              <div class="field">
                <label for="account-name">Nom</label>
                <input id="account-name" name="name" required placeholder="Compte Perso 40$">
              </div>
              <div class="field">
                <label for="account-type">Type</label>
                <select id="account-type" name="type">
                  <option>Fonds propres</option>
                  <option>Prop Firm</option>
                </select>
              </div>
              <div class="field">
                <label for="account-capital">Capital</label>
                <input id="account-capital" name="capital" type="number" min="0" step="0.01" required>
              </div>
              <div class="field">
                <label for="account-currency">Devise</label>
                <input id="account-currency" name="currency" value="USD" maxlength="8" required>
              </div>
              <button class="button primary" type="submit">Créer le compte</button>
            </form>
          `;
        },
        renderAppearance() {
          return `
            <h3>Apparence</h3>
            <p class="muted">Le thème est stocké dans les préférences V3.</p>
            <div class="segmented">
              <button class="chip ${state.data.preferences.theme === "dark" ? "active" : ""}" type="button" data-theme-choice="dark">Sombre</button>
              <button class="chip ${state.data.preferences.theme === "light" ? "active" : ""}" type="button" data-theme-choice="light">Clair</button>
            </div>
          `;
        }
      };

      const actions = {
        // Point d'entrée unique du formulaire : crée un nouveau trade, ou met à jour celui en cours
        // d'édition (state.editingTradeId). Aucune logique de calcul dupliquée entre les deux cas.
        saveTrade(event) {
          event.preventDefault();

          if (!state.selectedAsset || !state.selectedStrategy) {
            ui.toast("Sélectionnez un actif et une stratégie.");
            return;
          }

          const accountId = dom["account-select"].value;
          const account = state.data.accounts.find(a => a.id === accountId);
          const risk = Number(dom["risk-select"].value);
          const resultCurrency = Number(dom["result-currency-input"].value) || 0;
          const rrPlanned = Number(dom["rr-planned"].value) || 0;

          const payload = { account, accountId, risk, resultCurrency, rrPlanned };

          if (state.editingTradeId) {
            actions.updateTrade(state.editingTradeId, payload);
          } else {
            actions.createTrade(payload);
          }

          storage.save();
          actions.resetTradeForm();
          ui.render();
        },

        // Rassemble tous les champs des cartes 2, 3, 6, 7 communs à la création et la modification.
        // Jamais dupliqué entre createTrade et updateTrade (règle absolue Document 06).
        collectWizardFields() {
          const date = dom["trade-date"].value || new Date().toISOString().slice(0, 10);
          const entryTime = dom["entry-time"].value || null;
          const exitTime = dom["exit-time"].value || null;
          const tags = dom["tags-input"].value.split(",").map(t => t.trim()).filter(Boolean);
          return {
            date,
            entryTime,
            exitTime,
            durationMinutes: calculations.durationMinutes(
              entryTime ? `${date}T${entryTime}` : null,
              exitTime ? `${date}T${exitTime}` : null
            ),
            asset: state.selectedAsset,
            direction: dom["direction-value"].value || "Buy",
            session: dom["session-select"].value,
            strategy: state.selectedStrategy,
            htf: dom["htf-select"].value,
            ltf: dom["timeframe-select"].value,
            timeframeCombination: `${dom["htf-select"].value} → ${dom["timeframe-select"].value}`,
            setupQuality: state.selectedSetupQuality || null,
            confluences: [...state.selectedConfluences],
            planRespect: dom["plan-respect-select"].value,
            emotionalCause: state.selectedEmotionalCause || null,
            emotionalCausesSecondary: [...state.selectedEmotionalCausesSecondary],
            manualIntervention: dom["manual-intervention-value"].value || "Non",
            notes: dom.notes.value.trim(),
            tags,
            media: {
              htf: dom["capture-htf-input"].value.trim() || null,
              ltf: dom["capture-ltf-input"].value.trim() || null,
              result: dom["capture-result-input"].value.trim() || null
            }
          };
        },

        createTrade({ account, accountId, risk, resultCurrency, rrPlanned }) {
          // Milestone 2A/2C : moteur de calcul V3 (Document 05). Le risque est toujours calculé
          // sur le capital du compte AU MOMENT du trade, jamais sur un capital déjà mis à jour.
          const riskCapitalSnapshot = account ? account.currentCapital : 0;
          const riskAmount = calculations.riskAmount(riskCapitalSnapshot, risk);
          const metrics = calculations.buildTradeMetricsV3Cards({ resultCurrency, riskAmount, riskCapitalSnapshot, rrPlanned });
          const createdAt = new Date().toISOString();
          const fields = actions.collectWizardFields();

          const trade = {
            id: utils.uid("trade"),
            accountId,
            ...fields,
            riskPercent: risk,
            riskCapitalSnapshot,
            riskAmount,
            rrPlanned,
            rrObtained: metrics.resultR,
            // Champs conservés pour compatibilité du Dashboard existant (calculations.summary),
            // reconstitués à partir du nouveau moteur R afin de ne jamais dupliquer/casser cette formule.
            realPL: +(metrics.resultR * risk).toFixed(4),
            theoreticalPL: +(metrics.theoreticalResultR * risk).toFixed(4),
            resultPercent: metrics.resultPercent,
            resultR: metrics.resultR,
            resultCurrency: metrics.resultCurrency,
            tradeStatus: metrics.tradeStatus,
            emotionalDelta: +(metrics.resultR * risk).toFixed(4) - +(metrics.theoreticalResultR * risk).toFixed(4),
            emotionalDeltaR: metrics.emotionalDeltaR,
            emotionalDeltaCurrency: metrics.emotionalDeltaCurrency,
            createdAt,
            updatedAt: createdAt,
            source: "v3-journal-8cards"
          };

          state.data.trades.unshift(trade);

          // Le capital du compte évolue avec le résultat en devise du trade (Document 05, Account.capital_actuel).
          if (account) {
            account.currentCapital = +((Number(account.currentCapital) || 0) + metrics.resultCurrency).toFixed(2);
          }

          ui.toast("Trade enregistré.");
        },

        // Modifie un trade existant. Révertit d'abord son impact sur le capital du compte
        // d'origine, puis recalcule tout avec les nouvelles valeurs, avant de réappliquer
        // l'impact sur le compte (éventuellement différent) sélectionné dans le formulaire.
        updateTrade(tradeId, { account, accountId, risk, resultCurrency, rrPlanned }) {
          const trade = state.data.trades.find(t => t.id === tradeId);
          if (!trade) {
            ui.toast("Ce trade n'existe plus.");
            return;
          }

          const previousAccount = state.data.accounts.find(a => a.id === trade.accountId);
          if (previousAccount) {
            previousAccount.currentCapital = +((Number(previousAccount.currentCapital) || 0) - (Number(trade.resultCurrency) || 0)).toFixed(2);
          }

          // Le compte de référence pour le nouveau risque est celui sélectionné dans le formulaire,
          // avec son capital déjà "assaini" de l'ancien impact ci-dessus (cas où le compte n'a pas changé).
          const riskCapitalSnapshot = account ? account.currentCapital : 0;
          const riskAmount = calculations.riskAmount(riskCapitalSnapshot, risk);
          const metrics = calculations.buildTradeMetricsV3Cards({ resultCurrency, riskAmount, riskCapitalSnapshot, rrPlanned });
          const fields = actions.collectWizardFields();

          Object.assign(trade, {
            accountId,
            ...fields,
            riskPercent: risk,
            riskCapitalSnapshot,
            riskAmount,
            rrPlanned,
            rrObtained: metrics.resultR,
            realPL: +(metrics.resultR * risk).toFixed(4),
            theoreticalPL: +(metrics.theoreticalResultR * risk).toFixed(4),
            resultPercent: metrics.resultPercent,
            resultR: metrics.resultR,
            resultCurrency: metrics.resultCurrency,
            tradeStatus: metrics.tradeStatus,
            emotionalDelta: +(metrics.resultR * risk).toFixed(4) - +(metrics.theoreticalResultR * risk).toFixed(4),
            emotionalDeltaR: metrics.emotionalDeltaR,
            emotionalDeltaCurrency: metrics.emotionalDeltaCurrency,
            source: "v3-journal-8cards",
            updatedAt: new Date().toISOString()
          });

          if (account) {
            account.currentCapital = +((Number(account.currentCapital) || 0) + metrics.resultCurrency).toFixed(2);
          }

          state.editingTradeId = null;
          ui.toast("Trade mis à jour.");
        },

        // Passe le formulaire en mode édition pour un trade donné (Document 06 : jamais de
        // suppression de fonctionnalité isolée — l'édition réutilise le même formulaire que la création).
        startEditTrade(tradeId) {
          const trade = state.data.trades.find(t => t.id === tradeId);
          if (!trade) return;

          state.editingTradeId = tradeId;
          state.selectedAsset = trade.asset || "";
          state.selectedStrategy = trade.strategy || "";
          state.selectedDirection = trade.direction || "Buy";
          state.selectedSetupQuality = trade.setupQuality || 0;
          state.selectedConfluences = Array.isArray(trade.confluences) ? [...trade.confluences] : [];
          state.selectedEmotionalCause = trade.emotionalCause || "";
          state.selectedEmotionalCausesSecondary = Array.isArray(trade.emotionalCausesSecondary) ? [...trade.emotionalCausesSecondary] : [];
          state.selectedManualIntervention = trade.manualIntervention || "Non";

          dom["account-select"].value = trade.accountId;
          // renderSelectors reconstruit chips/checklists/étoiles à partir des state.selected* ci-dessus,
          // ainsi que les listes HTF/LTF et les paliers de risque (Milestone 2B).
          ui.renderSelectors();

          if (Array.from(dom["risk-select"].options).some(opt => opt.value === String(trade.riskPercent))) {
            dom["risk-select"].value = String(trade.riskPercent);
          }
          ui.updateRiskPreview();

          // trade.date est au format ISO (YYYY-MM-DD) uniquement pour les trades créés via
          // le formulaire 8 cartes. Les trades legacy/2A-2B ont un format d'affichage différent :
          // on laisse alors le champ date vide plutôt que d'injecter une valeur invalide.
          dom["trade-date"].value = /^\d{4}-\d{2}-\d{2}$/.test(trade.date) ? trade.date : "";
          dom["entry-time"].value = trade.entryTime || "";
          dom["exit-time"].value = trade.exitTime || "";
          dom["session-select"].value = trade.session || "";
          dom["htf-select"].value = trade.htf || "";
          dom["timeframe-select"].value = trade.ltf || "";
          dom["rr-planned"].value = trade.rrPlanned != null ? trade.rrPlanned : "";
          dom["plan-respect-select"].value = trade.planRespect || "Oui";
          dom["result-currency-input"].value = trade.resultCurrency != null ? trade.resultCurrency : "";
          dom.notes.value = trade.notes || "";
          dom["tags-input"].value = Array.isArray(trade.tags) ? trade.tags.join(", ") : "";
          dom["capture-htf-input"].value = (trade.media && trade.media.htf) || "";
          dom["capture-ltf-input"].value = (trade.media && trade.media.ltf) || "";
          dom["capture-result-input"].value = (trade.media && trade.media.result) || "";

          ui.updateComboPreview();
          ui.updateDurationPreview();
          ui.updateResultPreviews();
          ui.setFormEditingMode(true);
          ui.goToWizardCard(1);
          dom["trade-form"].scrollIntoView({ behavior: "smooth", block: "start" });
        },

        cancelEditTrade() {
          actions.resetTradeForm();
          ui.render();
        },

        resetTradeForm() {
          state.editingTradeId = null;
          dom["trade-form"].reset();
          state.selectedAsset = "";
          state.selectedStrategy = "";
          // Milestone 2C : ces sélections (étoiles, confluences, causes...) vivent dans state.*
          // et ne sont PAS remises à zéro par le reset() natif du formulaire — il faut les
          // réinitialiser explicitement, sinon elles restent cochées pour le trade suivant.
          state.selectedDirection = "Buy";
          state.selectedSetupQuality = 0;
          state.selectedConfluences = [];
          state.selectedEmotionalCause = "";
          state.selectedEmotionalCausesSecondary = [];
          state.selectedManualIntervention = "Non";
          document.getElementById("asset-value").value = "";
          document.getElementById("strategy-value").value = "";
          dom["direction-value"].value = "Buy";
          dom["setup-quality-value"].value = "0";
          dom["emotional-cause-value"].value = "";
          dom["manual-intervention-value"].value = "Non";
          ui.setFormEditingMode(false);
          ui.goToWizardCard(1);
        },

        // Suppression d'un trade (Document 04 §13 : jamais sans confirmation). Révertit
        // son impact sur le capital du compte pour garder les statistiques cohérentes.
        deleteTrade(tradeId) {
          const trade = state.data.trades.find(t => t.id === tradeId);
          if (!trade) return;

          const confirmed = confirm(`Supprimer ce trade (${trade.asset || "actif inconnu"}, ${trade.date}) ? Cette action est définitive.`);
          if (!confirmed) return;

          const account = state.data.accounts.find(a => a.id === trade.accountId);
          if (account) {
            account.currentCapital = +((Number(account.currentCapital) || 0) - (Number(trade.resultCurrency) || 0)).toFixed(2);
          }

          state.data.trades = state.data.trades.filter(t => t.id !== tradeId);

          if (state.editingTradeId === tradeId) {
            actions.resetTradeForm();
          }

          storage.save();
          ui.render();
          ui.toast("Trade supprimé.");
        },
        clearData() {
          if (!confirm("Voulez-vous vraiment vider l'historique des trades ? Les comptes et paramètres V3 seront conservés.")) return;
          state.data.trades = [];
          storage.save();
          ui.render();
          ui.toast("Historique réinitialisé.");
        },
        exportJSON() {
          dom["export-output"].value = JSON.stringify(state.data, null, 2);
          ui.openModal(dom["export-modal"]);
        },
        copyExport() {
          dom["export-output"].select();
          document.execCommand("copy");
          ui.toast("Export copié.");
        },
        openImport() {
          dom["import-input"].value = "";
          dom["import-feedback"].textContent = "";
          dom["import-file"].value = "";
          ui.openModal(dom["import-modal"]);
        },
        // Milestone : Import JSON. Réutilise storage.normalize() pour valider et assainir
        // n'importe quelle sauvegarde (V2 legacy ou V3) — aucune logique de validation dupliquée.
        // Règle Document 04 §13 : aucune donnée n'est écrasée sans confirmation explicite.
        runImport() {
          const raw = dom["import-input"].value.trim();
          if (!raw) {
            dom["import-feedback"].textContent = "Collez ou chargez un fichier JSON avant d'importer.";
            return;
          }

          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (error) {
            dom["import-feedback"].textContent = "JSON invalide : impossible de le lire. Vérifiez le contenu collé.";
            console.warn("Import JSON invalide", error);
            return;
          }

          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            dom["import-feedback"].textContent = "Ce fichier ne ressemble pas à une sauvegarde Cosmos valide.";
            return;
          }

          const tradeCount = Array.isArray(parsed.trades) ? parsed.trades.length : 0;
          const accountCount = Array.isArray(parsed.accounts) ? parsed.accounts.length : 0;
          const confirmed = confirm(
            `Importer cette sauvegarde remplacera TOUTES les données actuelles ` +
            `(${state.data.accounts.length} compte(s), ${state.data.trades.length} trade(s)) ` +
            `par ${accountCount} compte(s) et ${tradeCount} trade(s) importés. Continuer ?`
          );
          if (!confirmed) return;

          let normalized;
          try {
            normalized = storage.normalize(parsed);
          } catch (error) {
            dom["import-feedback"].textContent = "La sauvegarde n'a pas pu être validée. Import annulé.";
            console.error("Échec normalisation import", error);
            return;
          }

          state.data = normalized;
          storage.save();
          dom["import-feedback"].textContent = `Import réussi : ${normalized.accounts.length} compte(s), ${normalized.trades.length} trade(s).`;
          ui.closeModal(dom["import-modal"]);
          ui.render();
          ui.toast(`Import réussi : ${normalized.accounts.length} compte(s), ${normalized.trades.length} trade(s).`);
        },
        loadImportFile(file) {
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            dom["import-input"].value = String(reader.result || "");
            dom["import-feedback"].textContent = `Fichier chargé : ${file.name}`;
          };
          reader.onerror = () => {
            dom["import-feedback"].textContent = "Impossible de lire ce fichier.";
          };
          reader.readAsText(file);
        },
        toggleTheme() {
          state.data.preferences.theme = state.data.preferences.theme === "dark" ? "light" : "dark";
          storage.save();
          ui.render();
        },
        addSetting(event, key) {
          event.preventDefault();
          const input = event.target.elements.value;
          const value = input.value.trim();
          if (!value) return;
          const list = state.data.settings[key];
          if (!list.includes(value)) list.push(value);
          input.value = "";
          storage.save();
          ui.render();
          ui.toast("Option ajoutée.");
        },
        removeSetting(key, index) {
          const list = state.data.settings[key];
          if (!Array.isArray(list) || list.length <= 1) {
            ui.toast("Gardez au moins une option.");
            return;
          }
          list.splice(index, 1);
          storage.save();
          ui.render();
        },
        addAccount(event) {
          event.preventDefault();
          const form = event.target;
          const account = {
            id: utils.uid("acc"),
            name: form.elements.name.value.trim(),
            type: form.elements.type.value,
            initialCapital: Number(form.elements.capital.value) || 0,
            currentCapital: Number(form.elements.capital.value) || 0,
            currency: form.elements.currency.value.trim() || "USD",
            color: "#5aa7ff",
            createdAt: new Date().toISOString(),
            archived: false
          };
          state.data.accounts.push(account);
          storage.save();
          ui.render();
          ui.toast("Compte créé.");
        }
      };

      function bindEvents() {
        dom["trade-form"].addEventListener("submit", actions.saveTrade);

        // Milestone 2B : changer de compte régénère les paliers de risque (type de compte)
        // et le montant risqué ; changer le palier de risque recalcule juste le montant.
        dom["account-select"].addEventListener("change", () => ui.renderRiskOptions());
        dom["risk-select"].addEventListener("change", () => ui.updateRiskPreview());

        // Milestone 2C : navigation du formulaire 8 cartes (Document 03).
        dom["wizard-prev"].addEventListener("click", () => ui.goToWizardCard(state.currentCard - 1));
        dom["wizard-next"].addEventListener("click", () => ui.goToWizardCard(state.currentCard + 1));

        // Milestone 2C : recalculs en temps réel (Document 03 : "je veux que les calculs
        // apparaissent pendant la saisie... sans cliquer").
        ["trade-date", "entry-time", "exit-time"].forEach(id => {
          dom[id].addEventListener("change", () => ui.updateDurationPreview());
        });
        ["htf-select", "timeframe-select"].forEach(id => {
          dom[id].addEventListener("change", () => ui.updateComboPreview());
        });
        ["result-currency-input", "rr-planned"].forEach(id => {
          dom[id].addEventListener("input", () => ui.updateResultPreviews());
        });
        dom["plan-respect-select"].addEventListener("change", () => ui.updateResultPreviews());

        // Milestone 2C : Mode Focus (Document 03) — l'historique s'estompe pendant la saisie.
        dom["trade-form"].addEventListener("focusin", () => {
          dom["history-panel"].classList.add("wizard-focus-dim");
        });
        dom["trade-form"].addEventListener("focusout", event => {
          if (!dom["trade-form"].contains(event.relatedTarget)) {
            dom["history-panel"].classList.remove("wizard-focus-dim");
          }
        });

        // Milestone 3B : filtres Analytics — recalcul en direct, sans bouton (Document 03).
        [
          "analytics-filter-account", "analytics-filter-asset", "analytics-filter-session",
          "analytics-filter-htf", "analytics-filter-ltf", "analytics-filter-strategy",
          "analytics-filter-date-from", "analytics-filter-date-to"
        ].forEach(id => {
          dom[id].addEventListener("change", () => ui.updateAnalyticsView());
        });
        dom["analytics-filter-reset"].addEventListener("click", () => {
          ["analytics-filter-account", "analytics-filter-asset", "analytics-filter-session",
            "analytics-filter-htf", "analytics-filter-ltf", "analytics-filter-strategy",
            "analytics-filter-date-from", "analytics-filter-date-to"].forEach(id => { dom[id].value = ""; });
          ui.updateAnalyticsView();
        });
        dom["breakdown-dimension"].addEventListener("change", () => ui.updateAnalyticsView());

        document.addEventListener("click", event => {
          const navButton = event.target.closest("[data-view]");
          if (navButton) ui.switchView(navButton.dataset.view);

          const editButton = event.target.closest("[data-edit-trade]");
          if (editButton) actions.startEditTrade(editButton.dataset.editTrade);

          const deleteButton = event.target.closest("[data-delete-trade]");
          if (deleteButton) actions.deleteTrade(deleteButton.dataset.deleteTrade);

          if (event.target.closest("[data-cancel-edit]")) actions.cancelEditTrade();

          const action = event.target.closest("[data-action]")?.dataset.action;
          if (action === "open-settings") ui.openModal(dom["settings-modal"]);
          if (action === "close-settings") ui.closeModal(dom["settings-modal"]);
          if (action === "export-json") actions.exportJSON();
          if (action === "close-export") ui.closeModal(dom["export-modal"]);
          if (action === "copy-export") actions.copyExport();
          if (action === "import-json") actions.openImport();
          if (action === "close-import") ui.closeModal(dom["import-modal"]);
          if (action === "run-import") actions.runImport();
          if (action === "toggle-theme") actions.toggleTheme();
          if (action === "clear-data") actions.clearData();

          const categoryButton = event.target.closest("[data-settings-category]");
          if (categoryButton) {
            state.data.preferences.activeSettingsCategory = categoryButton.dataset.settingsCategory;
            storage.save();
            ui.renderSettings();
          }

          const removeButton = event.target.closest("[data-remove-setting]");
          if (removeButton) {
            actions.removeSetting(removeButton.dataset.removeSetting, Number(removeButton.dataset.index));
          }

          const themeChoice = event.target.closest("[data-theme-choice]");
          if (themeChoice) {
            state.data.preferences.theme = themeChoice.dataset.themeChoice;
            storage.save();
            ui.render();
          }
        });

        document.addEventListener("submit", event => {
          const addSettingForm = event.target.closest("[data-add-setting]");
          if (addSettingForm) actions.addSetting(event, addSettingForm.dataset.addSetting);
          const addAccountForm = event.target.closest("[data-add-account]");
          if (addAccountForm) actions.addAccount(event);
        });

        dom["import-file"].addEventListener("change", event => {
          actions.loadImportFile(event.target.files[0]);
        });

        document.addEventListener("keydown", event => {
          if (event.key === "Escape") {
            ui.closeModal(dom["settings-modal"]);
            ui.closeModal(dom["export-modal"]);
            ui.closeModal(dom["import-modal"]);
          }
        });

        [dom["settings-modal"], dom["export-modal"], dom["import-modal"]].forEach(modal => {
          modal.addEventListener("click", event => {
            if (event.target === modal) ui.closeModal(modal);
          });
        });
      }

      function init() {
        ui.cache();
        state.data = storage.load();
        storage.save();
        bindEvents();
        ui.render();
        ui.goToWizardCard(1);
        ui.switchView("dashboard");
        if (state.data.migratedFrom) ui.toast("Données V2 migrées vers les fondations V3.");
      }

      init();
    })();