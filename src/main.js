// Sprint 1 — ARCH-001 (Livraison 3) : state, storage, migrations, calculations
    // (Livraison 2) et maintenant la couche UI complète (Livraison 3) sont extraits.
    // main.js ne garde plus que l'orchestration : actions (logique métier des
    // événements), bindEvents, init.
    //
    // Bug report post-DASH-001, #2A : ajout de actions.toggleAccountArchive() +
    // délégation de clic sur [data-toggle-account-archive] — voir settings.js pour
    // le bouton correspondant sur la pill de compte.
    import { utils } from "./utils/index.js";
    import { state } from "./core/state.js";
    import { calculations } from "./core/calculations.js";
    import { mediaStorage } from "./core/mediastorage.js";
    import { CAPTURE_SLOT_KEYS } from "./ui/journal.js";
    import { storage } from "./core/storage.js";
    import { isNativeCapture, isEncodedCapture } from "./core/migrations.js";
    import { buildDemoTrades } from "./core/demoData.js";
    import { dom } from "./ui/dom.js";
    import { componentsUi } from "./ui/components.js";
    import { dashboardUi } from "./ui/dashboard.js";
    import { journalUi } from "./ui/journal.js";
    import { analyticsUi } from "./ui/analytics.js";
    import { coachUi } from "./ui/coach.js";
    import { settingsUi } from "./ui/settings.js";

    (() => {
      "use strict";

      const ui = { ...componentsUi, ...dashboardUi, ...journalUi, ...analyticsUi, ...coachUi, ...settingsUi };

      // MEDIA-001 (Livraison E) : conversion Blob -> Data URL (base64)
      function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
      }

      // MEDIA-001 (Livraison E) : conversion inverse (Data URL -> Blob)
      async function dataUrlToBlob(dataUrl) {
        const response = await fetch(dataUrl);
        return response.blob();
      }

      // MEDIA-001 (Livraison E) : construit une COPIE enrichie de state.data en base64
      async function encodeCapturesForExport(data) {
        const clone = utils.clone(data);
        for (const trade of clone.trades) {
          if (!trade.media) continue;
          for (const slotKey of CAPTURE_SLOT_KEYS) {
            const value = trade.media[slotKey];
            if (!isNativeCapture(value)) continue;
            try {
              const entry = await mediaStorage.get(trade.id, slotKey);
              if (!entry) continue;
              const dataUrl = await blobToBase64(entry.blob);
              trade.media[slotKey] = { native: true, type: entry.type, dataUrl };
            } catch (error) {
              console.warn(`Capture illisible pour le trade ${trade.id} (${slotKey})`, error);
            }
          }
        }
        return clone;
      }

      // MEDIA-001 (Livraison E) : écrit chaque capture encodée dans IndexedDB à l'import
      async function reviveCapturesFromImport(parsed) {
        if (!Array.isArray(parsed.trades)) return parsed;
        for (const trade of parsed.trades) {
          if (!trade.media || !trade.id) continue;
          for (const slotKey of CAPTURE_SLOT_KEYS) {
            const value = trade.media[slotKey];
            if (!isEncodedCapture(value)) continue;
            try {
              const blob = await dataUrlToBlob(value.dataUrl);
              await mediaStorage.save(trade.id, slotKey, blob);
              trade.media[slotKey] = { native: true, type: value.type };
            } catch (error) {
              console.warn(`Échec de restauration de la capture ${trade.id}/${slotKey}`, error);
              trade.media[slotKey] = null;
            }
          }
        }
        return parsed;
      }

      // RISK-001 : Validations numériques strictes pour les opérations financières
      function isStrictPositiveFiniteNumber(val) {
        return typeof val === "number" && Number.isFinite(val) && val > 0;
      }

      function isFiniteNumber(val) {
        return typeof val === "number" && Number.isFinite(val);
      }

      function parseStrictNumber(raw, fieldName) {
        if (raw === "" || raw === null || raw === undefined) {
          throw new Error(`Le champ "${fieldName}" est obligatoire.`);
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          throw new Error(`La valeur saisie pour "${fieldName}" est invalide.`);
        }
        return n;
      }

      const actions = {
        saveTrade(event) {
          event.preventDefault();

          if (!state.selectedAsset || !state.selectedStrategy) {
            ui.toast("Sélectionnez un actif et une stratégie.", "negative");
            return;
          }

          const accountId = dom["account-select"].value;
          const account = state.data.accounts.find(a => a.id === accountId);
          if (!account) {
            ui.toast("Compte sélectionné introuvable.", "negative");
            return;
          }

          let risk, resultCurrency, rrPlanned;
          try {
            risk = parseStrictNumber(dom["risk-select"].value, "Risque %");
            resultCurrency = parseStrictNumber(dom["result-currency-input"].value, "Résultat en devise");
            rrPlanned = parseStrictNumber(dom["rr-planned"].value, "RR prévu");
          } catch (err) {
            ui.toast(err.message, "negative");
            return;
          }

          const payload = { account, accountId, risk, resultCurrency, rrPlanned };

          let success = false;
          if (state.editingTradeId) {
            success = actions.updateTrade(state.editingTradeId, payload);
          } else {
            success = actions.createTrade(payload);
          }

          if (!success) {
            return;
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
            emotionalCauses: [...state.selectedEmotionalCauses],
            
            manualIntervention: dom["manual-intervention-value"].value || "Non",
            notes: dom.notes.value.trim(),
            // UX-004 (Dynamic Tag Chips) : tags provient désormais de state.selectedTags
            // (chips synchronisées avec Paramètres → Tags), plus d'un champ texte parsé
            // par virgules. Même pattern que confluences/emotionalCausesSecondary ci-dessus.
            tags: [...state.selectedTags],
           
           
          };
        },

        createTrade({ account, accountId, risk, resultCurrency, rrPlanned }) {
          if (!account) {
            ui.toast("Compte de trading introuvable.", "negative");
            return false;
          }
          if (!isStrictPositiveFiniteNumber(account.initialCapital)) {
            ui.toast("Le capital initial du compte est invalide. Enregistrement impossible.", "negative");
            return false;
          }
          if (!isFiniteNumber(account.currentCapital)) {
            ui.toast("Le solde actuel du compte est invalide. Enregistrement impossible.", "negative");
            return false;
          }

          const riskCapitalSnapshot = account.initialCapital;
          const riskAmount = calculations.riskAmount(riskCapitalSnapshot, risk);
          const metrics = calculations.buildTradeMetricsV3Cards({ resultCurrency, riskAmount, riskCapitalSnapshot, rrPlanned });
          const createdAt = new Date().toISOString();
          const fields = actions.collectWizardFields();

          const trade = {
            id: state.draftTradeId || utils.uid("trade"),
            accountId,
            accountName: account.name || "Compte inconnu",
            ...fields,
            media: { ...state.draftMedia },

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
            createdAt,
            updatedAt: createdAt,
            source: "v3-journal-8cards"
          };

          state.data.trades.unshift(trade);

          account.currentCapital = +(account.currentCapital + metrics.resultCurrency).toFixed(2);

          // Le trade est maintenant propriétaire de ce tradeId — le draft n'a plus
          // lieu d'être, mais on ne supprime SURTOUT PAS ses captures.
          state.draftTradeId = null;
          state.draftMedia = { htf: null, ltf: null, result: null };
          ui.toast("Trade enregistré.", "positive");
          return true;
        },

        updateTrade(tradeId, { accountId, risk, resultCurrency, rrPlanned }) {
          // Étape 1 : Résolution et validation de l'existence du trade
          const trade = state.data.trades.find(t => t.id === tradeId);
          if (!trade) {
            ui.toast("Ce trade n'existe plus.", "negative");
            return false;
          }

          // Étape 2 : Résolution et validation stricte des comptes
          const previousAccount = state.data.accounts.find(a => a.id === trade.accountId);
          const targetAccount = state.data.accounts.find(a => a.id === accountId);

          if (!targetAccount) {
            ui.toast("Le compte sélectionné est introuvable.", "negative");
            return false;
          }

          const isTransfer = trade.accountId !== accountId;

          if (isTransfer) {
            if (!previousAccount) {
              ui.toast("Le compte d'origine est introuvable. Transfert impossible.", "negative");
              return false;
            }
            if (!isFiniteNumber(previousAccount.currentCapital)) {
              ui.toast("Solde du compte d'origine corrompu. Transfert interrompu.", "negative");
              return false;
            }
            if (!isFiniteNumber(trade.resultCurrency)) {
              ui.toast("Résultat historique du trade invalide. Transfert interrompu.", "negative");
              return false;
            }
            if (!isStrictPositiveFiniteNumber(targetAccount.initialCapital)) {
              ui.toast("Capital initial du compte de destination invalide. Transfert interrompu.", "negative");
              return false;
            }
            if (!isFiniteNumber(targetAccount.currentCapital)) {
              ui.toast("Solde du compte de destination corrompu. Transfert interrompu.", "negative");
              return false;
            }
          } else {
            if (!isFiniteNumber(targetAccount.currentCapital)) {
              ui.toast("Solde du compte corrompu. Mise à jour interrompue.", "negative");
              return false;
            }
            if (!isFiniteNumber(trade.resultCurrency)) {
              ui.toast("Résultat historique du trade invalide. Mise à jour interrompue.", "negative");
              return false;
            }
          }

          // Étape 3 : Détection des déclencheurs
          const isLegacy = !isStrictPositiveFiniteNumber(trade.riskCapitalSnapshot);
          const riskInteracted = Boolean(state.hasInteractedWithRisk);
          const riskValueChanged = isFiniteNumber(trade.riskPercent) ? risk !== trade.riskPercent : true;
          const riskTrigger = isLegacy ? riskInteracted : riskValueChanged;

          const resultChanged = resultCurrency !== trade.resultCurrency;
          const rrPlannedChanged = trade.rrPlanned != null ? rrPlanned !== trade.rrPlanned : true;

          // Étape 4 : Calcul en mémoire de la mise à jour (aucune mutation)
          let finalSnapshot = trade.riskCapitalSnapshot;
          let finalRiskPercent = trade.riskPercent;
          let finalRiskAmount = trade.riskAmount;
          let finalResultCurrency = trade.resultCurrency;
          let finalRrPlanned = trade.rrPlanned;
          let finalResultR = trade.resultR;
          let finalResultPercent = trade.resultPercent;
          let finalTradeStatus = trade.tradeStatus;
          let finalRrObtained = trade.rrObtained;
          let finalRealPL = trade.realPL;
          let finalTheoreticalPL = trade.theoreticalPL;
          let finalEmotionalDelta = trade.emotionalDelta;
          let finalEmotionalDeltaR = trade.emotionalDeltaR;
          let finalEmotionalDeltaCurrency = trade.emotionalDeltaCurrency;

          if (isTransfer) {
            // Transfert vers un autre compte : nouveau snapshot = targetAccount.initialCapital
            finalSnapshot = targetAccount.initialCapital;
            finalRiskPercent = risk;
            finalRiskAmount = calculations.riskAmount(finalSnapshot, finalRiskPercent);
            finalResultCurrency = resultCurrency;
            finalRrPlanned = rrPlanned;

            const metrics = calculations.buildTradeMetricsV3Cards({
              resultCurrency: finalResultCurrency,
              riskAmount: finalRiskAmount,
              riskCapitalSnapshot: finalSnapshot,
              rrPlanned: finalRrPlanned
            });

            finalResultR = metrics.resultR;
            finalResultPercent = metrics.resultPercent;
            finalTradeStatus = metrics.tradeStatus;
            finalRrObtained = metrics.resultR;
            finalRealPL = +(metrics.resultR * finalRiskPercent).toFixed(4);
            finalTheoreticalPL = +(metrics.theoreticalResultR * finalRiskPercent).toFixed(4);
            finalEmotionalDelta = +(metrics.resultR * finalRiskPercent).toFixed(4) - +(metrics.theoreticalResultR * finalRiskPercent).toFixed(4);
            finalEmotionalDeltaR = metrics.emotionalDeltaR;
            finalEmotionalDeltaCurrency = metrics.emotionalDeltaCurrency;
          } else {
            // Même compte : gestion stricte des 4 situations et des cas legacy
            if (riskTrigger) {
              if (isLegacy) {
                // Régularisation explicite : adossement au capital initial du compte
                if (!isStrictPositiveFiniteNumber(targetAccount.initialCapital)) {
                  ui.toast("Capital initial du compte invalide pour régulariser le risque.", "negative");
                  return false;
                }
                finalSnapshot = targetAccount.initialCapital;
              }
              finalRiskPercent = risk;
              finalRiskAmount = calculations.riskAmount(finalSnapshot, finalRiskPercent);
            }

            if (resultChanged) {
              finalResultCurrency = resultCurrency;
              const rounded = Math.round(finalResultCurrency * 100) / 100;
              finalTradeStatus = rounded > 0 ? "Gagnant" : rounded < 0 ? "Perdant" : "BE";
            }

            if (rrPlannedChanged) {
              finalRrPlanned = rrPlanned;
            }

            // Recalcul des métriques selon la disponibilité des données
            if (riskTrigger || resultChanged || rrPlannedChanged) {
              if (isStrictPositiveFiniteNumber(finalRiskAmount)) {
                finalResultR = calculations.resultRFromCurrency(finalResultCurrency, finalRiskAmount);
                finalRrObtained = finalResultR;
                if (isFiniteNumber(finalRiskPercent)) {
                  finalRealPL = +(finalResultR * finalRiskPercent).toFixed(4);
                  finalTheoreticalPL = +(Number(finalRrPlanned || 0) * finalRiskPercent).toFixed(4);
                  finalEmotionalDelta = finalRealPL - finalTheoreticalPL;
                }
                const deltaFull = calculations.emotionalDeltaFull(finalResultR, Number(finalRrPlanned || 0), finalRiskAmount);
                finalEmotionalDeltaR = deltaFull.r;
                finalEmotionalDeltaCurrency = deltaFull.currency;
              } else {
                // Trade legacy sans riskAmount valide et sans régularisation
                finalResultR = null;
                finalRrObtained = null;
                finalRealPL = null;
                finalTheoreticalPL = null;
                finalEmotionalDelta = null;
                finalEmotionalDeltaR = null;
                finalEmotionalDeltaCurrency = null;
              }

              if (isStrictPositiveFiniteNumber(finalSnapshot)) {
                finalResultPercent = +((finalResultCurrency / finalSnapshot) * 100).toFixed(2);
              } else if (!resultChanged) {
                finalResultPercent = trade.resultPercent; // conservation valeur historique
              } else {
                finalResultPercent = null; // résultat changé sans snapshot
              }
            }
          }

          // Étape 5 : Calcul des soldes cibles
          let newPreviousCapital = null;
          let newTargetCapital = null;

          if (isTransfer) {
            newPreviousCapital = +(previousAccount.currentCapital - trade.resultCurrency).toFixed(2);
            newTargetCapital = +(targetAccount.currentCapital + finalResultCurrency).toFixed(2);
          } else {
            const balanceDelta = finalResultCurrency - trade.resultCurrency;
            newTargetCapital = +(targetAccount.currentCapital + balanceDelta).toFixed(2);
          }

          // Étape 6 : Application atomique des mutations
          const fields = actions.collectWizardFields();

          if (isTransfer) {
            previousAccount.currentCapital = newPreviousCapital;
            targetAccount.currentCapital = newTargetCapital;
          } else {
            targetAccount.currentCapital = newTargetCapital;
          }

          Object.assign(trade, {
            accountId,
            accountName: targetAccount.name || trade.accountName,
            ...fields,
            riskPercent: finalRiskPercent,
            riskCapitalSnapshot: finalSnapshot,
            riskAmount: finalRiskAmount,
            rrPlanned: finalRrPlanned,
            rrObtained: finalRrObtained,
            realPL: finalRealPL,
            theoreticalPL: finalTheoreticalPL,
            resultPercent: finalResultPercent,
            resultR: finalResultR,
            resultCurrency: finalResultCurrency,
            tradeStatus: finalTradeStatus,
            emotionalDelta: finalEmotionalDelta,
            emotionalDeltaR: finalEmotionalDeltaR,
            emotionalDeltaCurrency: finalEmotionalDeltaCurrency,
            source: trade.source || "v3-journal-8cards",
            updatedAt: new Date().toISOString()
          });

          // Révocation des captures temporaires et nettoyage
          ui.revokeCaptureUrlsForTrade(tradeId);
          state.editingTradeId = null;
          state.hasInteractedWithRisk = false;
          ui.toast("Trade mis à jour.", "positive");
          return true;
        },

        // Passe le formulaire en mode édition pour un trade donné (Document 06 : jamais de
        // suppression de fonctionnalité isolée — l'édition réutilise le même formulaire que la création).
        startEditTrade(tradeId) {
          const trade = state.data.trades.find(t => t.id === tradeId);
          if (!trade) return;

          state.editingTradeId = tradeId;
          state.hasInteractedWithRisk = false;
          state.selectedAsset = trade.asset || "";
          state.selectedStrategy = trade.strategy || "";
          state.selectedDirection = trade.direction || "Buy";
          state.selectedSetupQuality = trade.setupQuality || 0;
          state.selectedConfluences = Array.isArray(trade.confluences) ? [...trade.confluences] : [];
          state.selectedEmotionalCauses = Array.isArray(trade.emotionalCauses) ? [...trade.emotionalCauses] : [];
          state.selectedManualIntervention = trade.manualIntervention || "Non";
          // UX-004 : restaure les tags sélectionnés du trade en cours d'édition,
          // même logique que les autres sélections multiples ci-dessus.
          state.selectedTags = Array.isArray(trade.tags) ? [...trade.tags] : [];

          dom["account-select"].value = trade.accountId;
          // renderSelectors reconstruit chips/checklists/étoiles à partir des state.selected* ci-dessus,
          // ainsi que les listes HTF/LTF et les paliers de risque (Milestone 2B).
          ui.renderSelectors();

          if (Array.from(dom["risk-select"].options).some(opt => opt.value === String(trade.riskPercent))) {
            dom["risk-select"].value = String(trade.riskPercent);
          }
          ui.updateRiskPreview();

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
          ui.renderCaptureSlots();

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
          // MEDIA-001 (Livraison G — A2, correction) : capturé AVANT la mise à null
          // ci-dessous. Couvre le cas "annulation d'une édition" (cancelEditTrade →
          // resetTradeForm, où editingTradeId est encore renseigné à cet instant).
          // Le cas "sauvegarde réussie après édition" est couvert séparément dans
          // updateTrade() (voir point 2 ci-dessous), car à ce stade updateTrade() a
          // déjà nullifié editingTradeId avant que resetTradeForm() ne soit appelée.
          const previousEditingTradeId = state.editingTradeId;
          state.editingTradeId = null;
          state.hasInteractedWithRisk = false;
          dom["trade-form"].reset();
          state.selectedAsset = "";
          state.selectedStrategy = "";
          state.selectedDirection = "Buy";
          state.selectedSetupQuality = 0;
          state.selectedConfluences = [];
          state.selectedEmotionalCauses = [];
          state.selectedManualIntervention = "Non";
          // UX-004 : réinitialise les tags sélectionnés, même logique que les
          // autres sélections multiples ci-dessus — sinon ils resteraient cochés
          // pour le trade suivant (le reset() natif du formulaire ne les touche pas).
          state.selectedTags = [];
          document.getElementById("asset-value").value = "";
          document.getElementById("strategy-value").value = "";
          dom["direction-value"].value = "Buy";
          dom["setup-quality-value"].value = "0";
          
          dom["manual-intervention-value"].value = "Non";
          // MEDIA-001 (Livraison C) : si l'utilisateur a ajouté des captures sans
    // jamais enregistrer le trade (abandon, annulation), elles restent seules
    // dans IndexedDB sans aucun trade pour les référencer — nettoyage explicite
    // pour ne jamais laisser de données orphelines (cohérent avec la suppression
    // en cascade de deleteTrade ci-dessous).
    // MEDIA-001 (Livraison C) : si l'utilisateur a ajouté des captures sans
          // jamais enregistrer le trade (abandon, annulation), elles restent seules
          // dans IndexedDB sans aucun trade pour les référencer — nettoyage explicite
          // pour ne jamais laisser de données orphelines (cohérent avec la suppression
          // en cascade de deleteTrade ci-dessous).
          if (state.draftTradeId) {
            mediaStorage.deleteAllForTrade(state.draftTradeId).catch(error => {
              console.warn("Impossible de nettoyer les médias du brouillon abandonné :", error);
            });
            ui.revokeCaptureUrlsForTrade(state.draftTradeId);
          }
          // MEDIA-001 (Livraison G — A2) : en mode édition, les captures du trade sont
          // hydratées (URL.createObjectURL) mais NE DOIVENT JAMAIS être supprimées
          // d'IndexedDB ici — le trade existe toujours, seule la session d'édition se
          // termine. Seule l'URL objet temporaire (mémoire de la page, pas la donnée
          // elle-même) doit être révoquée. C'était le trou identifié par l'audit : cette
          // révocation n'existait pour aucun des deux chemins de sortie d'édition
          // (validation du formulaire ou annulation), seul le chemin "draft abandonné"
          // ci-dessus était couvert.
          if (previousEditingTradeId) {
            ui.revokeCaptureUrlsForTrade(previousEditingTradeId);
          }
          state.draftTradeId = null;
          state.draftMedia = { htf: null, ltf: null, result: null };

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
mediaStorage.deleteAllForTrade(tradeId).catch(error => {
  console.warn("Impossible de nettoyer les médias du trade supprimé :", error);
});
ui.revokeCaptureUrlsForTrade(tradeId);
          if (state.editingTradeId === tradeId) {
            actions.resetTradeForm();
          }

          storage.save();
          ui.render();
          ui.toast("Trade supprimé.", "positive");
        },

        // RP-006 — Onboarding : injection de trades de démonstration.
        // Garde de sécurité : ne s'exécute jamais si des trades existent déjà
        // (le bouton lui-même est masqué dans ce cas, voir dashboardUi.renderDashboard,
        // mais cette vérification reste la source de vérité — jamais uniquement l'UI).
        loadDemoExperience() {
          if (state.data.trades.length > 0) return;

          const account = state.data.accounts.find(a => !a.archived) || state.data.accounts[0];
          if (!account) return;

          const { trades, finalCapital } = buildDemoTrades(account);
          // Les trades générés sont chronologiques (plus ancien en premier) ;
          // reverse() respecte la convention "plus récent en premier" déjà
          // utilisée par createTrade (state.data.trades.unshift(trade)).
          state.data.trades = [...trades].reverse();
          account.currentCapital = finalCapital;

          storage.save();
          ui.render();
          ui.toast("Données de démonstration ajoutées — explorez le Dashboard, Analytics et Coach.", "positive");
        },
        clearData() {
          if (!confirm("Voulez-vous vraiment vider l'historique des trades ? Les comptes et paramètres V3 seront conservés.")) return;
          state.data.trades = [];
          // RP-006 : sans trade, le capital courant doit refléter le capital
          // initial de chaque compte (plus aucun P&L accumulé). Couvre à la
          // fois un reset de trades réels et le nettoyage des trades de
          // démonstration — sans introduire de mécanisme dédié à la démo,
          // conformément à la contrainte "réutiliser clearData() existant,
          // aucun nouveau système de suppression".
          state.data.accounts.forEach(account => {
            account.currentCapital = account.initialCapital;
          });
          mediaStorage.clear().catch(error => {
            console.warn("Impossible de nettoyer intégralement IndexedDB lors de la réinitialisation :", error);
          });
          storage.save();
          ui.render();
          ui.toast("Historique réinitialisé.", "positive");
        },
        handleCaptureFile(slotKey, file) {
      if (!file) return;
      const tradeId = ui.ensureDraftTradeId();
      mediaStorage.save(tradeId, slotKey, file)
        .then(({ type }) => {
          const value = { native: true, type };
          if (state.editingTradeId) {
            const trade = state.data.trades.find(t => t.id === state.editingTradeId);
            if (trade) {
              trade.media = { ...(trade.media || {}), [slotKey]: value };
              storage.save();
            }
          } else {
            state.draftMedia = { ...state.draftMedia, [slotKey]: value };
          }
          ui.renderCaptureSlots();
          ui.toast("Capture ajoutée.", "positive");
        })
        .catch(error => {
          console.error("Échec de l'enregistrement de la capture", error);
          ui.toast("Impossible d'enregistrer cette capture.", "negative");
        });
    },

    removeCapture(slotKey) {
      const tradeId = state.editingTradeId || state.draftTradeId;
      if (!tradeId) return;
      mediaStorage.delete(tradeId, slotKey)
        .then(() => {
          ui.revokeCaptureUrlsForTrade(tradeId);
          if (state.editingTradeId) {
            const trade = state.data.trades.find(t => t.id === state.editingTradeId);
            if (trade) {
              trade.media = { ...(trade.media || {}), [slotKey]: null };
              storage.save();
            }
          } else {
            state.draftMedia = { ...state.draftMedia, [slotKey]: null };
          }
          ui.renderCaptureSlots();
        })
        .catch(error => {
          console.error("Échec de la suppression de la capture", error);
          ui.toast("Impossible de supprimer cette capture.", "negative");
        });
    },
        exportJSON() {
          dom["export-output"].value = JSON.stringify(state.data, null, 2);
          ui.openModal(dom["export-modal"]);
        },
        // MEDIA-001 (Livraison E) : export complet, opt-in. exportJSON() (léger,
        // ci-dessus) reste totalement inchangé — comportement par défaut préservé.
        async exportJSONWithCaptures() {
          ui.toast("Préparation de l'export avec captures...", "neutral");
          try {
            const enriched = await encodeCapturesForExport(state.data);
            dom["export-output"].value = JSON.stringify(enriched, null, 2);
            ui.openModal(dom["export-modal"]);
          } catch (error) {
            console.error("Échec de l'export avec captures", error);
            ui.toast("Impossible de préparer l'export avec captures.", "negative");
          }
        },
        copyExport() {
          dom["export-output"].select();
          document.execCommand("copy");
          ui.toast("Export copié.", "positive");
        },
        openImport() {
          dom["import-input"].value = "";
          ui.setFeedback(dom["import-feedback"], "", "neutral");
          dom["import-file"].value = "";
          ui.openModal(dom["import-modal"]);
        },
async runImport() {
          const raw = dom["import-input"].value.trim();
          if (!raw) {
            ui.setFeedback(dom["import-feedback"], "Collez ou chargez un fichier JSON avant d'importer.", "negative");
            return;
          }

          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (error) {
            ui.setFeedback(dom["import-feedback"], "JSON invalide : impossible de le lire. Vérifiez le contenu collé.", "negative");
            console.warn("Import JSON invalide", error);
            return;
          }

          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            ui.setFeedback(dom["import-feedback"], "Ce fichier ne ressemble pas à une sauvegarde Cosmos valide.", "negative");
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

          await mediaStorage.clear().catch(() => {});

          let revived;
          try {
            revived = await reviveCapturesFromImport(parsed);
          } catch (error) {
            ui.setFeedback(dom["import-feedback"], "Échec de la restauration des captures. Import annulé.", "negative");
            console.error("Échec revival captures import", error);
            return;
          }

          let normalized;
          try {
            normalized = storage.normalize(revived);
          } catch (error) {
            ui.setFeedback(dom["import-feedback"], "La sauvegarde n'a pas pu être validée. Import annulé.", "negative");
            console.error("Échec normalisation import", error);
            return;
          }

          state.data = normalized;
          storage.save();
          ui.setFeedback(dom["import-feedback"], `Import réussi : ${normalized.accounts.length} compte(s), ${normalized.trades.length} trade(s).`, "positive");
          ui.closeModal(dom["import-modal"]);
          ui.render();
          ui.toast(`Import réussi : ${normalized.accounts.length} compte(s), ${normalized.trades.length} trade(s).`, "positive");
        },
        loadImportFile(file) {
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            dom["import-input"].value = String(reader.result || "");
            ui.setFeedback(dom["import-feedback"], `Fichier chargé : ${file.name}`, "neutral");
          };
          reader.onerror = () => {
            ui.setFeedback(dom["import-feedback"], "Impossible de lire ce fichier.", "negative");
          };
          reader.readAsText(file);
        },
        toggleTheme() {
          state.data.preferences.theme = state.data.preferences.theme === "dark" ? "light" : "dark";
          storage.save();
          ui.render();
        },
        toggleHistory() {
          state.data.preferences.historyCollapsed = !(state.data.preferences.historyCollapsed !== false);
          storage.save();
          ui.renderHistoryToggle();
        },
        // ANALYTICS-001 (Bloc ④ Preuves) : miroir exact de toggleHistory().
        toggleAnalyticsProof() {
          state.data.preferences.analyticsProofCollapsed = !(state.data.preferences.analyticsProofCollapsed !== false);
          storage.save();
          ui.renderAnalyticsProofToggle();
        },
        // ANALYTICS-002 (Bloc ③ Comprendre vos indicateurs) : même pattern.
        toggleAnalyticsHelp() {
          state.data.preferences.analyticsHelpCollapsed = !(state.data.preferences.analyticsHelpCollapsed !== false);
          storage.save();
          ui.renderAnalyticsHelpToggle();
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
          ui.toast("Option ajoutée.", "positive");
        },
        removeSetting(key, index) {
          const list = state.data.settings[key];
          if (!Array.isArray(list) || list.length <= 1) {
            ui.toast("Gardez au moins une option.", "negative");
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
          ui.toast("Compte créé.", "positive");
        },
        deleteAccount(accountId) {
      if (state.data.accounts.length <= 1) {
        ui.toast("Gardez au moins un compte.", "negative");
        return;
      }

      const account = state.data.accounts.find(a => a.id === accountId);
      if (!account) return;

      const confirmed = confirm(`Supprimer définitivement le compte "${account.name}" ? Les trades déjà enregistrés seront conservés avec leur nom de compte d'origine.`);
      if (!confirmed) return;

      state.data.accounts = state.data.accounts.filter(a => a.id !== accountId);

      // Remet un compte valide par défaut dans le formulaire si le compte actif est supprimé
      if (dom["account-select"] && dom["account-select"].value === accountId) {
        dom["account-select"].value = state.data.accounts[0].id;
      }

      // Réinitialise le filtre Analytics sur "Tous" si le compte filtré est supprimé
      if (dom["analytics-filter-account"] && dom["analytics-filter-account"].value === accountId) {
        dom["analytics-filter-account"].value = "";
      }

      storage.save();
      ui.render();
      ui.toast("Compte supprimé.", "positive");
    }
      };

      function bindEvents(adaptiveHeader) {
        dom["trade-form"].addEventListener("submit", actions.saveTrade);

        dom["account-select"].addEventListener("change", () => ui.renderRiskOptions());
        dom["risk-select"].addEventListener("change", () => {
          if (state.editingTradeId) {
            state.hasInteractedWithRisk = true;
          }
          ui.updateRiskPreview();
        });
        // RP-001 (Dashboard Account Filter)
dom["dashboard-account-filter"].addEventListener("change", () => {
  state.dashboardAccountFilter = dom["dashboard-account-filter"].value;
  ui.renderDashboard();
});

        dom["wizard-prev"].addEventListener("click", () => ui.goToWizardCard(state.currentCard - 1));
        dom["wizard-next"].addEventListener("click", () => ui.goToWizardCard(state.currentCard + 1));

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

        dom["trade-form"].addEventListener("focusin", () => {
          dom["history-panel"].classList.add("wizard-focus-dim");
        });
        dom["trade-form"].addEventListener("focusout", event => {
          if (!dom["trade-form"].contains(event.relatedTarget)) {
            dom["history-panel"].classList.remove("wizard-focus-dim");
          }
        });

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
          if (navButton) {
            ui.switchView(navButton.dataset.view);
            // MOB-002-B2 : recalcule immédiatement l'état du header (compact
            // permanent hors Dashboard) sans attendre un événement de scroll.
            if (adaptiveHeader) adaptiveHeader.evaluate();
          }

          const editButton = event.target.closest("[data-edit-trade]");
          if (editButton) actions.startEditTrade(editButton.dataset.editTrade);

          const deleteButton = event.target.closest("[data-delete-trade]");
          if (deleteButton) actions.deleteTrade(deleteButton.dataset.deleteTrade);

          if (event.target.closest("[data-cancel-edit]")) actions.cancelEditTrade();
          // MEDIA-001 (Livraison C) : "Ajouter" et "Remplacer" déclenchent tous deux
    // le même <input type="file"> caché associé au slot (data-capture-input) —
    // un seul mécanisme pour les deux actions, jamais dupliqué.
    const captureAddButton = event.target.closest("[data-capture-add]");
    if (captureAddButton) {
      dom["capture-slots"].querySelector(`[data-capture-input="${captureAddButton.dataset.captureAdd}"]`)?.click();
    }

    const captureReplaceButton = event.target.closest("[data-capture-replace]");
    if (captureReplaceButton) {
      dom["capture-slots"].querySelector(`[data-capture-input="${captureReplaceButton.dataset.captureReplace}"]`)?.click();
    }

    const captureRemoveButton = event.target.closest("[data-capture-remove]");
    if (captureRemoveButton) {
      actions.removeCapture(captureRemoveButton.dataset.captureRemove);
    }
    // MEDIA-001 (Livraison D) : clic sur la vignette → visionneuse grand format.
    const captureViewButton = event.target.closest("[data-capture-view]");
    if (captureViewButton) ui.openCaptureViewer(captureViewButton.dataset.captureView);

    // MEDIA-ACCESS-001 : clic sur "Captures" dans l'historique → visionneuse directe en lecture seule.
    const viewCapturesButton = event.target.closest("[data-view-trade-captures]");
    if (viewCapturesButton) ui.openTradeCaptures(viewCapturesButton.dataset.viewTradeCaptures);

    // MEDIA-ACCESS-001 : changement de slot dans la visionneuse.
    const viewerSlotButton = event.target.closest("[data-viewer-slot]");
    if (viewerSlotButton) ui.switchViewerSlot(viewerSlotButton.dataset.viewerSlot);

          const action = event.target.closest("[data-action]")?.dataset.action;
          if (action === "open-settings") ui.openModal(dom["settings-modal"]);
          if (action === "close-settings") ui.closeModal(dom["settings-modal"]);
          if (action === "export-json") actions.exportJSON();
          if (action === "export-json-captures") actions.exportJSONWithCaptures();
          if (action === "close-capture-viewer") ui.closeCaptureViewer();
          if (action === "prev-capture") ui.prevCaptureViewerSlot();
          if (action === "next-capture") ui.nextCaptureViewerSlot();
          if (action === "close-export") ui.closeModal(dom["export-modal"]);
          if (action === "copy-export") actions.copyExport();
          if (action === "import-json") actions.openImport();
          if (action === "close-import") ui.closeModal(dom["import-modal"]);
          if (action === "run-import") actions.runImport();
          if (action === "toggle-theme") actions.toggleTheme();
          if (action === "toggle-history") actions.toggleHistory();
          if (action === "toggle-analytics-proof") actions.toggleAnalyticsProof();
          if (action === "toggle-analytics-help") actions.toggleAnalyticsHelp();
          if (action === "clear-data") actions.clearData();
          if (action === "load-demo-trades") actions.loadDemoExperience();

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

          const deleteAccountButton = event.target.closest("[data-delete-account]");
if (deleteAccountButton) {
  actions.deleteAccount(deleteAccountButton.dataset.deleteAccount);
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

        // MOB-003-B : délégation "change" sur le dropdown mobile de Paramètres.
        // Reproduit exactement la même action que le clic desktop sur
        // [data-settings-category] ci-dessus — même source de vérité
        // (state.data.preferences.activeSettingsCategory), aucune logique
        // dupliquée. Le select est régénéré à chaque renderSettings() ; la
        // délégation sur le document (plutôt que sur l'élément lui-même)
        // survit donc à cette régénération.
        document.addEventListener("change", event => {
          const mobileSelect = event.target.closest("#settings-category-select");
          if (!mobileSelect) return;
          state.data.preferences.activeSettingsCategory = mobileSelect.value;
          storage.save();
          ui.renderSettings();
        });

        dom["import-file"].addEventListener("change", event => {
          actions.loadImportFile(event.target.files[0]);
        });
        // MEDIA-001 (Livraison C) : délégation sur le conteneur plutôt que sur
    // chaque <input> individuellement — #capture-slots est régénéré en
    // entier à chaque renderCaptureSlots() (innerHTML), un listener attaché
    // à un input précis serait perdu au rendu suivant.
    dom["capture-slots"].addEventListener("change", event => {
      const input = event.target.closest("[data-capture-input]");
      if (input) actions.handleCaptureFile(input.dataset.captureInput, input.files[0]);
    });

    // MEDIA-001 (Livraison D) : délégation hover/focus pour router le paste (Ctrl+V)
    // vers le bon slot. capture:true nécessaire — mouseenter/mouseleave/focusin/focusout
    // ne bubblent pas nativement (sauf focusin/focusout qui bubblent déjà, mais on garde
    // la même API pour les 4 événements par cohérence).
    dom["capture-slots"].addEventListener("mouseenter", event => {
      const slot = event.target.closest("[data-capture-slot]");
      if (slot) ui.setActiveCaptureSlot(slot.dataset.captureSlot);
    }, true);
    dom["capture-slots"].addEventListener("mouseleave", event => {
      const slot = event.target.closest("[data-capture-slot]");
      if (slot) ui.clearActiveCaptureSlot(slot.dataset.captureSlot);
    }, true);
    dom["capture-slots"].addEventListener("focusin", event => {
      const slot = event.target.closest("[data-capture-slot]");
      if (slot) ui.setActiveCaptureSlot(slot.dataset.captureSlot);
    });
    dom["capture-slots"].addEventListener("focusout", event => {
      const slot = event.target.closest("[data-capture-slot]");
      if (slot) ui.clearActiveCaptureSlot(slot.dataset.captureSlot);
    });

    // MEDIA-001 (Livraison D) : drag & drop, délégué sur le conteneur (même raison
    // que le listener "change" existant — #capture-slots est régénéré en entier à
    // chaque renderCaptureSlots()). Fonctionne aussi bien sur une dropzone vide que
    // sur une vignette existante (= remplacement), réutilise handleCaptureFile telle
    // quelle : aucune divergence de comportement entre clic, drag&drop et paste.
    ["dragenter", "dragover"].forEach(type => {
      dom["capture-slots"].addEventListener(type, event => {
        const slot = event.target.closest("[data-capture-slot]");
        if (!slot) return;
        event.preventDefault();
        ui.setCaptureDragState(slot.dataset.captureSlot, true);
      });
    });
    dom["capture-slots"].addEventListener("dragleave", event => {
      const slot = event.target.closest("[data-capture-slot]");
      if (slot) ui.setCaptureDragState(slot.dataset.captureSlot, false);
    });
    dom["capture-slots"].addEventListener("drop", event => {
      const slot = event.target.closest("[data-capture-slot]");
      if (!slot) return;
      event.preventDefault();
      const slotKey = slot.dataset.captureSlot;
      ui.setCaptureDragState(slotKey, false);
      const file = event.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        actions.handleCaptureFile(slotKey, file);
      } else {
        ui.toast("Seules les images sont acceptées.", "negative");
      }
    });

    // MEDIA-001 (Livraison D) : paste (Ctrl+V), routé vers le slot survolé/focus
    // (ui.getActiveCaptureSlot()). Sans slot actif, ne fait rien — pas de fallback
    // "premier slot vide" (décision explicite : éviter un paste accidentel sur le
    // mauvais slot). Scopé à la vue Journal pour ne jamais intercepter un paste
    // destiné à un autre champ (notes, import JSON...).
    document.addEventListener("paste", event => {
      if (state.currentView !== "journal") return;
      const slotKey = ui.getActiveCaptureSlot();
      if (!slotKey) return;

      const items = Array.from(event.clipboardData?.items || []);
      const imageItem = items.find(item => item.type.startsWith("image/"));
      if (!imageItem) return;

      event.preventDefault();
      const file = imageItem.getAsFile();
      if (file) actions.handleCaptureFile(slotKey, file);
    });

    // RCFIX-A03 : storage.save() peut désormais échouer (quota dépassé,
        // stockage indisponible...). Il émet dans ce cas un CustomEvent plutôt
        // que d'appeler ui.toast() lui-même (core/ ne touche jamais le DOM/UI —
        // voir PROJECT_STRUCTURE.md). Ce listener est le seul point de la couche
        // UI qui réagit à cet événement.
        window.addEventListener("cosmos:storage-error", () => {
          ui.toast("Impossible d'enregistrer vos données (stockage plein ou indisponible).", "negative");
        });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        ui.closeModal(dom["settings-modal"]);
        ui.closeModal(dom["export-modal"]);
        ui.closeModal(dom["import-modal"]);
        ui.closeCaptureViewer();
      } else if (dom["capture-viewer-modal"]?.classList.contains("open")) {
        if (event.key === "ArrowLeft") {
          ui.prevCaptureViewerSlot();
        } else if (event.key === "ArrowRight") {
          ui.nextCaptureViewerSlot();
        }
      }
    });

        [dom["settings-modal"], dom["export-modal"], dom["import-modal"], dom["capture-viewer-modal"]].forEach(modal => {
          modal.addEventListener("click", event => {
            if (event.target === modal) {
              if (modal === dom["capture-viewer-modal"]) ui.closeCaptureViewer();
              else ui.closeModal(modal);
            }
          });
        });
      }

      // MOB-002-B2 — Header UX Refinement.
// Dashboard : header complet par défaut, passe en compact dès que l'utilisateur
// quitte le haut de page (seuil anti-oscillation), ne redevient complet que
// lorsque scrollTop revient exactement à 0. Plus de logique directionnelle.
// Journal / Analytics / Coach / Settings : compact en permanence, quelle que
// soit la position de scroll — ce sont des workspaces, l'espace vertical prime.
function initAdaptiveHeader() {
  const header = document.querySelector(".app-header");
  if (!header) return null;

  const COMPACT_BREAKPOINT = 980; // même seuil que la media query CSS existante
  const DASHBOARD_SCROLL_THRESHOLD = 40; // px avant bascule en compact sur Dashboard

  function isMobile() {
    return window.innerWidth <= COMPACT_BREAKPOINT;
  }

  // Point d'entrée unique : recalcule l'état du header à partir de la vue
  // active (state.currentView) et, pour le Dashboard uniquement, de la
  // position de scroll. Appelé à la fois par le listener de scroll et
  // explicitement après tout changement de vue (voir bindEvents ci-dessous),
  // pour que le header réagisse immédiatement au clic sur la nav, sans
  // attendre un événement de scroll.
  function evaluate() {
    if (!isMobile()) {
      header.classList.remove("header-compact");
      return;
    }

    if (state.currentView !== "dashboard") {
      header.classList.add("header-compact");
      return;
    }

    // Dashboard : critère uniquement positionnel, jamais directionnel.
    if (window.scrollY <= 0) {
      header.classList.remove("header-compact");
    } else if (window.scrollY > DASHBOARD_SCROLL_THRESHOLD) {
      header.classList.add("header-compact");
    }
    // Entre 0 et le seuil : aucun changement (évite l'oscillation sur un
    // micro-mouvement de scroll juste après le haut de page).
  }

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      evaluate();
      ticking = false;
    });
  }, { passive: true });

  window.addEventListener("resize", evaluate, { passive: true });

  evaluate();
  return { evaluate };
}

      function init() {
        try {
          ui.cache();
          state.data = storage.load();
          storage.save();
          const adaptiveHeader = initAdaptiveHeader(); // MOB-002-B2 — déplacé avant bindEvents
          bindEvents(adaptiveHeader);
          ui.render();
          ui.goToWizardCard(1);
          ui.switchView("dashboard");
          if (state.data.migratedFrom) ui.toast("Données V2 migrées vers les fondations V3.", "neutral");

          // BOOT-001 : Signalement officiel du succès de l'initialisation JavaScript
          if (window.CosmosBoot) window.CosmosBoot.onJsSuccess();
        } catch (error) {
          console.error("[Cosmos Boot] Échec critique d'initialisation :", error);
          if (window.CosmosBoot) {
            window.CosmosBoot.onJsError(error);
          } else {
            throw error;
          }
        }
      }

      init();
    })();