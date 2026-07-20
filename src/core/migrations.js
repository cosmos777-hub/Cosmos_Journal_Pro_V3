// Sprint 1 — ARCH-001 (Livraison 2) : migrations et normalisation de trade,
// déplacées telles quelles depuis main.js. Dépend de calculations.js pour le
// backfill des champs de calcul V3 (upgradeTradeV3Calc), et de defaults.js pour
// les valeurs par défaut lors d'une migration legacy V2.
//
// Sprint Polishing — MEDIA-001 (Livraison B) : trade.media.{htf,ltf,result} accepte
// désormais deux natures de valeur possibles, jamais mélangées :
//   - une chaîne (legacy) : lien texte saisi manuellement avant MEDIA-001. Reste
//     affiché tel quel (fallback), jamais réécrit ni supprimé automatiquement —
//     conforme à la règle "jamais casser une sauvegarde existante" (Document 06 §2).
//   - un objet { native: true, type } (nouveau) : marqueur de capture native stockée
//     dans IndexedDB via mediaStorage.js. Aucun id explicite n'est nécessaire dans
//     cet objet : la clé de stockage est dérivée de façon déterministe à partir de
//     trade.id + slot (voir mediaStorage.captureKey), qui ne changent jamais après
//     création — donc pas de risque de désynchronisation entre trade.media et
//     IndexedDB. `type` (ex. "image/jpeg", "image/webp") est conservé ici pour
//     permettre à l'UI d'afficher un indicateur sans devoir lire le Blob au préalable.
// Les deux helpers ci-dessous (isNativeCapture / isLegacyMediaLink) sont le point
// d'entrée unique pour distinguer les deux natures — aucun autre module ne doit
// tester la forme de trade.media directement (même principe que storage.js, seul
// point d'accès à localStorage : ici, migrations.js fait autorité sur la FORME de
// trade.media, mediaStorage.js sur son CONTENU binaire).
import { calculations } from "./calculations.js";
import { defaults } from "./defaults.js";
import { utils } from "../utils/index.js";

export function isNativeCapture(mediaValue) {
  return Boolean(mediaValue) && typeof mediaValue === "object" && mediaValue.native === true;
}

export function isLegacyMediaLink(mediaValue) {
  return typeof mediaValue === "string" && mediaValue.length > 0;
}
// Sprint Polishing — MEDIA-001 (Livraison E) : 3e nature possible de
// trade.media.{htf,ltf,result}, présente UNIQUEMENT dans un JSON exporté via
// "Exporter avec captures" — jamais dans state.data en mémoire pendant
// l'exécution normale de l'app (voir main.js, reviveCapturesFromImport, qui
// convertit systématiquement cette forme en { native: true, type } + écriture
// IndexedDB avant que storage.normalize() ne voie la donnée). Un objet
// { native: true, type, dataUrl } est donc un état "en transit", jamais une
// forme durable de trade.media — à la différence de isNativeCapture (durable,
// référence IndexedDB) et isLegacyMediaLink (durable, lien texte).
export function isEncodedCapture(mediaValue) {
  return Boolean(mediaValue) && typeof mediaValue === "object" && mediaValue.native === true && typeof mediaValue.dataUrl === "string";
}

export const migrations = {
        // Milestone 2A : complète un trade (peu importe son origine — legacy V2, V3 fondations,
        // ou déjà V3 complet) avec les champs du moteur de calcul V3. Fonction pure et idempotente :
        // appliquée plusieurs fois sur le même trade, elle produit toujours le même résultat.
        //
        // MEDIA-001 (Livraison B) : aucun changement structurel nécessaire ici. Le spread
        // `...trade` (plus bas) préserve déjà trade.media tel qu'il existait, quelle que soit
        // la nature de chacun de ses trois champs (chaîne legacy ou objet natif) — cette
        // fonction n'a jamais besoin d'interpréter la forme de trade.media, seulement de ne
        // jamais l'écraser. Les valeurs par défaut ci-dessous (`media: { htf: null, ltf: null,
        // result: null }`) ne s'appliquent que si trade.media est totalement absent (trade V2
        // très ancien jamais encore passé par tradeV2ToV3).
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
            // MEDIA-001 (Livraison B) : une sauvegarde V2 ne contient que d'anciens liens texte
            // (imgHTF/imgLTF/imgResult) — jamais de capture native. isLegacyMediaLink() les
            // reconnaîtra donc naturellement une fois migrés ici, sans traitement particulier.
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
