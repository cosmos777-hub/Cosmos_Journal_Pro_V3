// Sprint 1 — ARCH-001 (Livraison 3) : rendu du Journal (sélecteurs, wizard 8 cartes,
// aperçus temps réel, historique), déplacé tel quel depuis main.js.
//
// Sprint Polishing — MEDIA-001 (Livraison C) : ajout du composant captureSlot()
// (3 zones d'import compactes — HTF/LTF/Résultat, Carte ⑥) qui remplace les
// anciens champs texte. Reste local à journal.js pour l'instant : pas encore
// réutilisé ailleurs dans l'application, donc pas remonté dans le catalogue
// générique components.js (règle de gouvernance, COMPONENT_CATALOG.md §5).
import { dom } from "./dom.js";
import { state } from "../core/state.js";
import { calculations } from "../core/calculations.js";
import { mediaStorage } from "../core/mediaStorage.js";
import { isNativeCapture, isLegacyMediaLink } from "../core/migrations.js";
import { HISTORY_DISPLAY_LIMIT, riskLevelsFor } from "../utils/constants.js";
import { utils } from "../utils/index.js";

const WIZARD_CARD_LABELS = [
  "Compte", "Trade", "Analyse", "Gestion", "Résultat", "Delta émotionnel", "Notes", "Validation"
];

export const RR_PLANNED_OPTIONS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10];

// MEDIA-001 (Livraison C) : les 3 slots de capture d'un trade — forme figée par
// calculations.js/migrations.js (trade.media.{htf,ltf,result}), jamais un 4e slot
// sans mise à jour coordonnée de ces deux fichiers.
export const CAPTURE_SLOTS = [
  { key: "htf", label: "HTF" },
  { key: "ltf", label: "LTF" },
  { key: "result", label: "Résultat" }
];

export const CAPTURE_SLOT_KEYS = CAPTURE_SLOTS.map(slot => slot.key);

// Cache local des URLs d'aperçu (URL.createObjectURL) déjà générées pour les
// vignettes affichées. Une URL objet doit être explicitement révoquée quand elle
// n'est plus affichée (sinon fuite mémoire) — ce cache permet de retrouver l'URL
// à révoquer avant d'en générer une nouvelle pour le même slot (remplacement).
const captureObjectUrls = {};

// Sprint Polishing — MEDIA-001 (Livraison D) : slot actuellement survolé/focus,
// utilisé uniquement pour router un paste (Ctrl+V) vers le bon slot. Volontairement
// une variable de module simple (pas dans state.js) : c'est un état d'interaction
// éphémère, jamais lu en dehors de journal.js/main.js, jamais persisté ni sérialisé —
// à la différence de state.selected/draftMedia qui font partie du cycle de vie du trade.
let activeCaptureSlotKey = null;

// Sprint Polishing — MEDIA-001 (Livraison D) : état d'ouverture de la visionneuse.
// Même principe que les modales existantes (settings/export/import), mais générée
// dynamiquement (l'image affichée change à chaque ouverture) plutôt que présente
// dans index.html — pas de contenu statique à préremplir.
let viewerObjectUrl = null;

function captureCacheKey(tradeId, slotKey) {
  return `${tradeId}::${slotKey}`;
}

function revokeCaptureUrl(tradeId, slotKey) {
  const cacheKey = captureCacheKey(tradeId, slotKey);
  if (captureObjectUrls[cacheKey]) {
    URL.revokeObjectURL(captureObjectUrls[cacheKey]);
    delete captureObjectUrls[cacheKey];

  }
}

export const journalUi = {
        renderSelectors() {
          const previousAccountId = dom["account-select"] ? dom["account-select"].value : "";
    const activeAccounts = state.data.accounts.filter(account => !account.archived);

    if (dom["account-select"]) {
      dom["account-select"].innerHTML = activeAccounts.map(account => `
        <option value="${utils.escape(account.id)}"${account.id === previousAccountId ? " selected" : ""}>${utils.escape(account.name)} · ${utils.escape(account.currency)}</option>
      `).join("");

      if (!activeAccounts.some(account => account.id === previousAccountId) && activeAccounts[0]) {
        dom["account-select"].value = activeAccounts[0].id;
      }
    }

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

         // RP-002C : Causes émotionnelles devient une sélection multiple
          // (checklist), même mécanisme que Confluences/Tags juste au-dessus/
          // en-dessous — plus de distinction principale/secondaire.
          this.renderChecklist(dom["emotional-cause-options"], state.data.settings.emotionalCauses, state.selectedEmotionalCauses, value => {
            const index = state.selectedEmotionalCauses.indexOf(value);
            if (index === -1) state.selectedEmotionalCauses.push(value); else state.selectedEmotionalCauses.splice(index, 1);
          }); 

          this.renderChips(dom["manual-intervention-options"], ["Oui", "Non"], state.selectedManualIntervention, value => {
            state.selectedManualIntervention = value;
            dom["manual-intervention-value"].value = value;
            this.renderSelectors();
            this.updateResultPreviews();
          });

          // RP-003 : préserve la sélection active lors de la reconstruction des
          // listes, même mécanisme que account-select ci-dessus (D-0XY : jamais
          // de logique dupliquée — même principe, appliqué aux 3 sélecteurs
          // restants de renderSelectors()).
          [
            { dom: dom["session-select"], values: state.data.settings.sessions },
            { dom: dom["timeframe-select"], values: state.data.settings.ltf },
            { dom: dom["htf-select"], values: state.data.settings.htf }
          ].forEach(({ dom: selectEl, values }) => {
            const previousValue = selectEl.value;
            selectEl.innerHTML = values.map(value => `<option>${utils.escape(value)}</option>`).join("");
            if (values.includes(previousValue)) {
              selectEl.value = previousValue;
            }
          });

          this.renderChecklist(dom["confluences-options"], state.data.settings.confluences, state.selectedConfluences, value => {
            const index = state.selectedConfluences.indexOf(value);
            if (index === -1) state.selectedConfluences.push(value); else state.selectedConfluences.splice(index, 1);
          });

          

          this.renderChecklist(dom["tags-options"], state.data.settings.tags, state.selectedTags, value => {
            const index = state.selectedTags.indexOf(value);
            if (index === -1) state.selectedTags.push(value); else state.selectedTags.splice(index, 1);
          });

          this.renderStars();
          this.renderRiskOptions();
          this.renderRRPlannedOptions();
          this.updateComboPreview();
          this.updateDurationPreview();
          this.updateResultPreviews();
        },

        // MEDIA-001 (Livraison C) : identifiant de travail du trade en cours de saisie.
        // En édition, réutilise directement l'id du trade existant (les captures y sont
        // déjà rattachées). En création, génère un id une seule fois — appelé au premier
        // ajout de capture, pas avant (Progressive Disclosure : aucun coût tant que
        // l'utilisateur n'utilise pas les captures).
        ensureDraftTradeId() {
          if (state.editingTradeId) return state.editingTradeId;
          if (!state.draftTradeId) state.draftTradeId = utils.uid("trade");
          return state.draftTradeId;
        },

        // Trade id + objet media actuellement pertinents pour l'affichage des slots,
        // quelle que soit la situation (création en cours, édition, formulaire vierge).
        currentCaptureContext() {
          if (state.editingTradeId) {
            const trade = state.data.trades.find(t => t.id === state.editingTradeId);
            return { tradeId: state.editingTradeId, media: (trade && trade.media) || {} };
          }
          return { tradeId: state.draftTradeId, media: state.draftMedia || {} };
        },

        // Rendu synchrone du squelette des 3 cartes de capture (Carte ⑥). Les vignettes
        // des captures natives déjà présentes sont hydratées ensuite de façon asynchrone
        // (hydrateCaptureThumbnails) : IndexedDB étant asynchrone par nature, on ne bloque
        // jamais le rendu du formulaire en attendant une lecture de Blob.
        renderCaptureSlots() {
          if (!dom["capture-slots"]) return;
          const { tradeId, media } = this.currentCaptureContext();
          dom["capture-slots"].innerHTML = CAPTURE_SLOTS.map(slot => this.captureSlotMarkup(slot, media[slot.key])).join("");
          if (tradeId) this.hydrateCaptureThumbnails(tradeId, media);
        },

        captureSlotMarkup(slot, mediaValue) {
          const hasCapture = isNativeCapture(mediaValue);
          const legacyLink = isLegacyMediaLink(mediaValue) ? mediaValue : "";

          const body = hasCapture
            ? `
              <button type="button" class="capture-thumb" data-capture-view="${slot.key}" aria-label="Agrandir la capture ${utils.escape(slot.label)}">
                <img data-capture-img="${slot.key}" alt="Capture ${utils.escape(slot.label)}">
              </button>
              <div class="capture-slot-actions">
                <button type="button" class="button ghost" data-capture-replace="${slot.key}">Remplacer</button>
                <button type="button" class="button danger" data-capture-remove="${slot.key}">Supprimer</button>
              </div>
            `
            : legacyLink
            ? `
              <a class="capture-legacy-link" href="${utils.escape(legacyLink)}" target="_blank" rel="noopener noreferrer">Lien existant ↗</a>
              <div class="capture-slot-actions">
                <button type="button" class="button ghost" data-capture-replace="${slot.key}">Remplacer par une capture</button>
              </div>
            `
            : `
              <button type="button" class="capture-dropzone" data-capture-add="${slot.key}">
                <span class="capture-dropzone-icon" aria-hidden="true">+</span>
                <span>Ajouter</span>
              </button>
            `;

          return `
            <div class="capture-slot" data-capture-slot="${slot.key}">
              <p class="capture-slot-label">${utils.escape(slot.label)}</p>
              <div class="capture-slot-body" data-capture-body="${slot.key}">${body}</div>
              <input type="file" class="hidden" accept="image/png,image/jpeg,image/webp" data-capture-input="${slot.key}">
            </div>
          `;
        },

        // Lecture asynchrone des Blobs déjà stockés pour générer les vignettes. Applique
        // un état Loading discret (STATE_MODEL.md : premier déclenchement réel, D-014)
        // pendant la lecture — même traitement visuel que wizard-focus-dim (flou léger),
        // jamais un spinner générique.
        async hydrateCaptureThumbnails(tradeId, media) {
          for (const slot of CAPTURE_SLOTS) {
            if (!isNativeCapture(media[slot.key])) continue;
            const imgEl = dom["capture-slots"].querySelector(`[data-capture-img="${slot.key}"]`);
            if (!imgEl) continue;
            const thumbEl = imgEl.closest(".capture-thumb");
            if (thumbEl) thumbEl.classList.add("capture-loading");
            try {
              // eslint-disable-next-line no-await-in-loop
              const entry = await mediaStorage.get(tradeId, slot.key);
              if (!entry) continue;
              revokeCaptureUrl(tradeId, slot.key);
              const url = URL.createObjectURL(entry.blob);
              captureObjectUrls[captureCacheKey(tradeId, slot.key)] = url;
              imgEl.src = url;
            } finally {
              if (thumbEl) thumbEl.classList.remove("capture-loading");
            }
          }
        },

        // Révoque toutes les URLs d'aperçu en cache pour un trade donné — appelé quand
        // ses captures ne sont plus affichées (reset du formulaire, suppression du trade).
        revokeCaptureUrlsForTrade(tradeId) {
          if (!tradeId) return;
          CAPTURE_SLOTS.forEach(slot => revokeCaptureUrl(tradeId, slot.key));
        },
        // MEDIA-001 (Livraison D) : mémorise le slot actif pour le routage du paste.
        // Appelé sur mouseenter/focusin d'un [data-capture-slot] (voir bindEvents).
        setActiveCaptureSlot(slotKey) {
          activeCaptureSlotKey = slotKey;
        },
        clearActiveCaptureSlot(slotKey) {
          // Ne réinitialise que si on quitte bien le slot mémorisé (évite qu'un
          // mouseleave sur un enfant n'efface par erreur le slot parent encore survolé).
          if (activeCaptureSlotKey === slotKey) activeCaptureSlotKey = null;
        },
        getActiveCaptureSlot() {
          return activeCaptureSlotKey;
        },

        // MEDIA-001 (Livraison D) : visionneuse simple. Réutilise .modal-backdrop
        // (components.css) — pas un 5e composant modal, juste un nouveau contenu
        // injecté dans le même gabarit que Settings/Export/Import.
        async openCaptureViewer(slotKey) {
          const { tradeId, media } = this.currentCaptureContext();
          if (!tradeId || !isNativeCapture(media[slotKey])) return;

          const entry = await mediaStorage.get(tradeId, slotKey);
          if (!entry) return;

          if (viewerObjectUrl) URL.revokeObjectURL(viewerObjectUrl);
          viewerObjectUrl = URL.createObjectURL(entry.blob);

          if (!dom["capture-viewer-modal"]) return;
          dom["capture-viewer-image"].src = viewerObjectUrl;
          this.openModal(dom["capture-viewer-modal"]);
        },
        closeCaptureViewer() {
          if (!dom["capture-viewer-modal"]) return;
          this.closeModal(dom["capture-viewer-modal"]);
          if (viewerObjectUrl) {
            URL.revokeObjectURL(viewerObjectUrl);
            viewerObjectUrl = null;
          }
          dom["capture-viewer-image"].src = "";
        },

        // MEDIA-001 (Livraison D) : bascule visuelle pendant un drag-over, sur la
        // dropzone vide OU la vignette existante (remplacement) selon l'état du slot.
        setCaptureDragState(slotKey, isDragging) {
          const body = dom["capture-slots"]?.querySelector(`[data-capture-body="${slotKey}"]`);
          if (!body) return;
          const target = body.querySelector(".capture-dropzone, .capture-thumb");
          if (target) target.classList.toggle("dragover", isDragging);
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

          if (dom["account-type-preview"]) {
            dom["account-type-preview"].classList.toggle("hidden", !account);
            if (account) {
              dom["account-type-preview"].textContent = `Type : ${account.type} · Capital actuel : ${account.currentCapital.toFixed(2)} ${account.currency}`;
            }
          }

          this.updateRiskPreview(account);
        },
        
        renderRRPlannedOptions() {
    if (!dom["rr-planned"]) return;
    const previous = dom["rr-planned"].value;
    dom["rr-planned"].innerHTML =
      `<option value="">—</option>` +
      RR_PLANNED_OPTIONS.map(value => `<option value="${value}">${value}</option>`).join("");
    if (RR_PLANNED_OPTIONS.some(v => String(v) === previous)) {
      dom["rr-planned"].value = previous;
    }
  },
        // Affiche instantanément le montant réellement risqué en devise du compte actif.
        updateRiskPreview(account) {
          if (!dom["risk-amount-preview"]) return;
          const acc = account || state.data.accounts.find(a => a.id === dom["account-select"].value);
          dom["risk-amount-preview"].classList.toggle("hidden", !acc);
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
          dom["combo-preview"].classList.toggle("hidden", !(htf && ltf));
          dom["combo-preview"].textContent = htf && ltf ? `Combinaison : ${htf} → ${ltf}` : "";
        },
        // Durée automatique du trade (Document 02, Carte 2).
        updateDurationPreview() {
          if (!dom["duration-preview"]) return;
          const date = dom["trade-date"].value;
          const entry = dom["entry-time"].value;
          const exit = dom["exit-time"].value;
          if (!date || !entry || !exit) {
            dom["duration-preview"].classList.add("hidden");
            dom["duration-preview"].textContent = "";
            return;
          }
          const minutes = calculations.durationMinutes(`${date}T${entry}`, `${date}T${exit}`);
          dom["duration-preview"].classList.remove("hidden");
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
          const hasResult = dom["result-currency-input"].value !== "";

          [dom["result-percent-display"], dom["trade-status-display"], dom["rr-obtained-display"]].forEach(el => {
            if (el) el.classList.toggle("hidden", !hasResult);
          });
          dom["result-percent-display"].textContent = hasResult ? `Résultat % : ${metrics.resultPercent.toFixed(2)}%` : "";
          dom["trade-status-display"].textContent = hasResult ? `Trade : ${metrics.tradeStatus}` : "";
          dom["rr-obtained-display"].textContent = hasResult ? `RR obtenu : ${metrics.resultR.toFixed(2)}R` : "";

          dom["theoretical-result-display"].textContent = `Théorique : ${metrics.theoreticalResultR.toFixed(2)}R`;
          dom["real-result-display"].textContent = `Réel : ${metrics.resultR.toFixed(2)}R`;
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
        renderHistoryToggle() {
          if (!dom["history-collapsible"]) return;
          const collapsed = state.data.preferences.historyCollapsed !== false;
          dom["history-collapsible"].classList.toggle("open", !collapsed);
          dom["history-toggle"].setAttribute("aria-expanded", String(!collapsed));
        },
        renderTrades() {
          const trades = state.data.trades;
          this.renderHistoryToggle();
          dom["history-subtitle"].textContent = trades.length ? `${trades.length} trade${trades.length > 1 ? "s" : ""} enregistré${trades.length > 1 ? "s" : ""}.` : "Aucun trade enregistré.";
          if (!trades.length) {
            dom["trade-list"].innerHTML = this.emptyState(
              "Aucun trade enregistré",
              "Ajoutez votre premier trade. Cosmos gardera la structure prête pour les Analytics V3."
            );
            return;
          }

          const visibleTrades = trades.slice(0, HISTORY_DISPLAY_LIMIT);

          dom["trade-list"].innerHTML = visibleTrades.map(trade => {
            const resultR = Number(trade.resultR) || 0;
            const deltaR = Number(trade.emotionalDeltaR) || 0;
            const theoreticalR = resultR - deltaR;
            return this.tradeRow({
              title: `${utils.escape(trade.asset || "Actif non défini")} · ${utils.escape(trade.strategy || "Stratégie non définie")}`,
              meta: `${utils.escape(trade.date)} · ${utils.escape(trade.session)} · ${utils.escape(trade.timeframeCombination || trade.ltf || "")}`,
              notes: trade.notes ? utils.escape(trade.notes) : "",
              badges: [
                { tone: utils.tone(resultR), label: `Réel ${utils.formatR(resultR)}` },
                { tone: utils.tone(theoreticalR), label: `Plan ${utils.formatR(theoreticalR)}` },
                { tone: utils.tone(deltaR), label: `Delta ${utils.formatR(deltaR)}` }
              ],
              actions: `
                <div style="display:flex; gap:6px;">
                  <button type="button" class="button ghost" data-edit-trade="${utils.escape(trade.id)}">Modifier</button>
                  <button type="button" class="button danger" data-delete-trade="${utils.escape(trade.id)}">Supprimer</button>
                </div>
              `
            });
          }).join("") + (trades.length > HISTORY_DISPLAY_LIMIT
            ? `<p class="muted" style="text-align:center; padding:12px;">Affichage des ${HISTORY_DISPLAY_LIMIT} trades les plus récents sur ${trades.length}. Utilisez Analytics pour explorer l'historique complet.</p>`
            : "");
        },
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
};
