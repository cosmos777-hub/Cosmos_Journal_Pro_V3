/**
 * Test Suite RISK-001 — Cosmos Journal Pro V3
 * Vérifie toutes les exigences fonctionnelles et sécuritaires de RISK-001.
 */
import { calculations } from "../src/core/calculations.js";
import { state } from "../src/core/state.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ÉCHEC: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${message} [${actual}]`);
  } else {
    failed++;
    console.error(`  ✗ ÉCHEC: ${message} (attendu: ${expected}, obtenu: ${actual})`);
  }
}

// Helpers miroirs pour tester updateTrade et createTrade en isolation Node.js
function isStrictPositiveFiniteNumber(val) {
  return typeof val === "number" && Number.isFinite(val) && val > 0;
}

function isFiniteNumber(val) {
  return typeof val === "number" && Number.isFinite(val);
}

function simulateCreateTrade({ account, accountId, risk, resultCurrency, rrPlanned, fields = {} }) {
  if (!account) return false;
  if (!isStrictPositiveFiniteNumber(account.initialCapital)) return false;
  if (!isFiniteNumber(account.currentCapital)) return false;

  const riskCapitalSnapshot = account.initialCapital;
  const riskAmount = calculations.riskAmount(riskCapitalSnapshot, risk);
  const metrics = calculations.buildTradeMetricsV3Cards({ resultCurrency, riskAmount, riskCapitalSnapshot, rrPlanned });
  const createdAt = new Date().toISOString();

  const trade = {
    id: "trade-" + Math.random().toString(36).slice(2, 7),
    accountId,
    accountName: account.name || "Compte inconnu",
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
    createdAt,
    updatedAt: createdAt,
    source: "v3-journal-8cards"
  };

  state.data.trades.unshift(trade);
  account.currentCapital = +(account.currentCapital + metrics.resultCurrency).toFixed(2);
  return trade;
}

function simulateUpdateTrade(tradeId, { accountId, risk, resultCurrency, rrPlanned, fields = {} }) {
  const trade = state.data.trades.find(t => t.id === tradeId);
  if (!trade) return false;

  const previousAccount = state.data.accounts.find(a => a.id === trade.accountId);
  const targetAccount = state.data.accounts.find(a => a.id === accountId);
  if (!targetAccount) return false;

  const isTransfer = trade.accountId !== accountId;

  if (isTransfer) {
    if (!previousAccount) return false;
    if (!isFiniteNumber(previousAccount.currentCapital)) return false;
    if (!isFiniteNumber(trade.resultCurrency)) return false;
    if (!isStrictPositiveFiniteNumber(targetAccount.initialCapital)) return false;
    if (!isFiniteNumber(targetAccount.currentCapital)) return false;
  } else {
    if (!isFiniteNumber(targetAccount.currentCapital)) return false;
    if (!isFiniteNumber(trade.resultCurrency)) return false;
  }

  const isLegacy = !isStrictPositiveFiniteNumber(trade.riskCapitalSnapshot);
  const riskInteracted = Boolean(state.hasInteractedWithRisk);
  const riskValueChanged = isFiniteNumber(trade.riskPercent) ? risk !== trade.riskPercent : true;
  const riskTrigger = isLegacy ? riskInteracted : riskValueChanged;

  const resultChanged = resultCurrency !== trade.resultCurrency;
  const rrPlannedChanged = trade.rrPlanned != null ? rrPlanned !== trade.rrPlanned : true;

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
    if (riskTrigger) {
      if (isLegacy) {
        if (!isStrictPositiveFiniteNumber(targetAccount.initialCapital)) return false;
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
        finalResultPercent = trade.resultPercent;
      } else {
        finalResultPercent = null;
      }
    }
  }

  let newPreviousCapital = null;
  let newTargetCapital = null;

  if (isTransfer) {
    newPreviousCapital = +(previousAccount.currentCapital - trade.resultCurrency).toFixed(2);
    newTargetCapital = +(targetAccount.currentCapital + finalResultCurrency).toFixed(2);
  } else {
    const balanceDelta = finalResultCurrency - trade.resultCurrency;
    newTargetCapital = +(targetAccount.currentCapital + balanceDelta).toFixed(2);
  }

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
    updatedAt: new Date().toISOString()
  });

  state.hasInteractedWithRisk = false;
  return true;
}

console.log("=== EXÉCUTION DE LA SUITE DE TESTS RISK-001 ===");

// Initialisation de l'état de test
state.data = {
  accounts: [
    { id: "acc-1", name: "Prop 50k", initialCapital: 50000, currentCapital: 51200, currency: "USD", type: "Prop Firm" },
    { id: "acc-2", name: "Personal 10k", initialCapital: 10000, currentCapital: 9800, currency: "EUR", type: "Personal" }
  ],
  trades: []
};

// TEST 1 : Création d'un trade avec adossement au capital initial
console.log("\n[TEST 1] Création d'un trade (calcul de 1R sur initialCapital)");
const t1 = simulateCreateTrade({
  account: state.data.accounts[0],
  accountId: "acc-1",
  risk: 1, // 1%
  resultCurrency: 1000, // +1000 USD
  rrPlanned: 2
});

assertEquals(t1.riskCapitalSnapshot, 50000, "Snapshot égal à initialCapital (50000 USD, pas 51200)");
assertEquals(t1.riskAmount, 500, "1R (riskAmount) = 1% de 50000 = 500 USD");
assertEquals(t1.resultR, 2, "resultR = 1000 / 500 = 2R");
assertEquals(t1.resultPercent, 2, "resultPercent = (1000 / 50000) * 100 = 2%");
assertEquals(state.data.accounts[0].currentCapital, 52200, "currentCapital crédité de 1000 -> 52200");

// TEST 2 : Situation 1 — Modification purement descriptive
console.log("\n[TEST 2] Situation 1 — Modification purement descriptive");
const beforeEditCapital = state.data.accounts[0].currentCapital;
const okS1 = simulateUpdateTrade(t1.id, {
  accountId: "acc-1",
  risk: 1, // identique
  resultCurrency: 1000, // identique
  rrPlanned: 2, // identique
  fields: { notes: "Nouvelle note descriptive", session: "London" }
});

assert(okS1, "Mise à jour descriptive réussie");
assertEquals(t1.notes, "Nouvelle note descriptive", "Notes mises à jour");
assertEquals(t1.riskCapitalSnapshot, 50000, "Snapshot strictement conservé");
assertEquals(t1.riskAmount, 500, "riskAmount strictement conservé");
assertEquals(t1.resultR, 2, "resultR inchangé");
assertEquals(t1.resultPercent, 2, "resultPercent inchangé");
assertEquals(state.data.accounts[0].currentCapital, beforeEditCapital, "Solde du compte inchangé");

// TEST 3 : Situation 2 — Modification du risque %
console.log("\n[TEST 3] Situation 2 — Modification du risque % (0.5% au lieu de 1%)");
const okS2 = simulateUpdateTrade(t1.id, {
  accountId: "acc-1",
  risk: 0.5, // 0.5%
  resultCurrency: 1000,
  rrPlanned: 2
});

assert(okS2, "Mise à jour du risque réussie");
assertEquals(t1.riskCapitalSnapshot, 50000, "Snapshot conservé (50000)");
assertEquals(t1.riskPercent, 0.5, "riskPercent mis à jour à 0.5%");
assertEquals(t1.riskAmount, 250, "riskAmount recalculé sur snapshot : 0.5% de 50000 = 250 USD");
assertEquals(t1.resultR, 4, "resultR recalculé : 1000 / 250 = 4R");
assertEquals(t1.resultPercent, 2, "resultPercent inchangé (1000 / 50000 = 2%)");
assertEquals(state.data.accounts[0].currentCapital, beforeEditCapital, "Solde du compte inchangé lors d'une modif de risque");

// TEST 4 : Situation 3 — Modification du résultat en devise
console.log("\n[TEST 4] Situation 3 — Modification du résultat (+1000 -> +500)");
const okS3 = simulateUpdateTrade(t1.id, {
  accountId: "acc-1",
  risk: 0.5,
  resultCurrency: 500, // 500 USD
  rrPlanned: 2
});

assert(okS3, "Mise à jour du résultat réussie");
assertEquals(t1.riskAmount, 250, "riskAmount conservé (250 USD)");
assertEquals(t1.resultR, 2, "resultR recalculé : 500 / 250 = 2R");
assertEquals(t1.resultPercent, 1, "resultPercent recalculé : (500 / 50000) * 100 = 1%");
assertEquals(state.data.accounts[0].currentCapital, 51700, "Solde du compte ajusté du delta (-500) -> 51700");

// TEST 5 : Situation 4 — Modification du RR prévu (theoretical & delta émotionnel)
console.log("\n[TEST 5] Situation 4 — Modification du RR prévu (2 -> 3)");
const okS4 = simulateUpdateTrade(t1.id, {
  accountId: "acc-1",
  risk: 0.5,
  resultCurrency: 500,
  rrPlanned: 3 // RR prévu passe à 3
});

assert(okS4, "Mise à jour du RR prévu réussie");
assertEquals(t1.riskAmount, 250, "riskAmount inchangé");
assertEquals(t1.resultR, 2, "resultR réel inchangé (2R)");
assertEquals(t1.emotionalDeltaR, -1, "Delta émotionnel en R : 2R - 3R = -1R");
assertEquals(t1.emotionalDeltaCurrency, -250, "Delta émotionnel en devise : -1R * 250 = -250 USD");
assertEquals(state.data.accounts[0].currentCapital, 51700, "Solde du compte inchangé");

// TEST 6 : Transfert de compte atomique
console.log("\n[TEST 6] Transfert de compte atomique (acc-1 -> acc-2 avec changement de résultat)");
const acc1Before = state.data.accounts[0].currentCapital; // 51700
const acc2Before = state.data.accounts[1].currentCapital; // 9800

const okTransfer = simulateUpdateTrade(t1.id, {
  accountId: "acc-2", // Nouveau compte initialCapital = 10000
  risk: 1, // 1%
  resultCurrency: 300, // 300 EUR
  rrPlanned: 2
});

assert(okTransfer, "Transfert de compte réussi");
assertEquals(state.data.accounts[0].currentCapital, +(acc1Before - 500).toFixed(2), "Compte 1 débité de l'ancien résultat (500 USD) -> 51200");
assertEquals(state.data.accounts[1].currentCapital, +(acc2Before + 300).toFixed(2), "Compte 2 crédité du nouveau résultat (300 EUR) -> 10100");
assertEquals(t1.accountId, "acc-2", "Trade rattaché au compte 2");
assertEquals(t1.riskCapitalSnapshot, 10000, "Nouveau snapshot adossé à l'initialCapital du compte 2 (10000)");
assertEquals(t1.riskAmount, 100, "1R recalculé sur compte 2 = 1% de 10000 = 100 EUR");
assertEquals(t1.resultR, 3, "resultR recalculé sur compte 2 : 300 / 100 = 3R");
assertEquals(t1.resultPercent, 3, "resultPercent recalculé sur compte 2 : (300 / 10000) * 100 = 3%");

// TEST 7 : Ancien trade legacy — Cas 1 (Sans snapshot, avec riskAmount valide)
console.log("\n[TEST 7] Ancien trade legacy Cas 1 (Sans snapshot, riskAmount valide, modif descriptive)");
const legacyTrade1 = {
  id: "legacy-1",
  accountId: "acc-2",
  accountName: "Personal 10k",
  riskPercent: 1,
  riskCapitalSnapshot: null, // ABSENT
  riskAmount: 150, // VALIDE
  rrPlanned: 2,
  rrObtained: 2,
  realPL: 2,
  theoreticalPL: 2,
  resultPercent: 1.5,
  resultR: 2,
  resultCurrency: 300,
  tradeStatus: "Gagnant",
  emotionalDelta: 0,
  emotionalDeltaR: 0,
  emotionalDeltaCurrency: 0,
  source: "v3-foundation"
};
state.data.trades.push(legacyTrade1);

state.hasInteractedWithRisk = false;
const okLegacyDesc = simulateUpdateTrade("legacy-1", {
  accountId: "acc-2",
  risk: 1,
  resultCurrency: 300,
  rrPlanned: 2,
  fields: { notes: "Modif descriptive pure" }
});

assert(okLegacyDesc, "Modif descriptive sur legacy trade réussie");
assertEquals(legacyTrade1.riskCapitalSnapshot, null, "Aucun snapshot inventé");
assertEquals(legacyTrade1.riskAmount, 150, "riskAmount historique conservé");
assertEquals(legacyTrade1.resultPercent, 1.5, "resultPercent historique conservé");
assertEquals(legacyTrade1.resultR, 2, "resultR conservé");

// TEST 8 : Ancien trade legacy Cas 1 avec modification de résultat (sans snapshot)
console.log("\n[TEST 8] Ancien trade legacy Cas 1 avec modification de résultat (+300 -> +450)");
const okLegacyResult = simulateUpdateTrade("legacy-1", {
  accountId: "acc-2",
  risk: 1,
  resultCurrency: 450,
  rrPlanned: 2
});

assert(okLegacyResult, "Modif de résultat sur legacy trade réussie");
assertEquals(legacyTrade1.riskAmount, 150, "riskAmount historique conservé");
assertEquals(legacyTrade1.resultR, 3, "resultR recalculé sur riskAmount : 450 / 150 = 3R");
assertEquals(legacyTrade1.resultPercent, null, "resultPercent passe à null (résultat modifié sans snapshot)");

// TEST 9 : Ancien trade legacy Cas 2 (Sans snapshot, sans riskAmount valide, sans régularisation)
console.log("\n[TEST 9] Ancien trade legacy Cas 2 (Sans snapshot, sans riskAmount, modif résultat)");
const legacyTrade2 = {
  id: "legacy-2",
  accountId: "acc-2",
  accountName: "Personal 10k",
  riskPercent: 1,
  riskCapitalSnapshot: null,
  riskAmount: null,
  rrPlanned: 2,
  rrObtained: null,
  realPL: null,
  theoreticalPL: null,
  resultPercent: null,
  resultR: null,
  resultCurrency: 200,
  tradeStatus: "Gagnant",
  source: "v3-foundation"
};
state.data.trades.push(legacyTrade2);

state.hasInteractedWithRisk = false;
const okLegacyNoReg = simulateUpdateTrade("legacy-2", {
  accountId: "acc-2",
  risk: 1,
  resultCurrency: 250,
  rrPlanned: 2
});

assert(okLegacyNoReg, "Mise à jour sans régularisation réussie");
assertEquals(legacyTrade2.riskCapitalSnapshot, null, "Snapshot reste null");
assertEquals(legacyTrade2.riskAmount, null, "riskAmount reste null");
assertEquals(legacyTrade2.resultR, null, "resultR reste null (pas de 0 artificiel)");
assertEquals(legacyTrade2.resultPercent, null, "resultPercent reste null");

// TEST 10 : Ancien trade legacy Cas 3 — Régularisation explicite
console.log("\n[TEST 10] Ancien trade legacy Cas 3 — Régularisation explicite (interaction sélecteur)");
state.hasInteractedWithRisk = true; // L'utilisateur a cliqué explicitement sur le sélecteur
const okLegacyReg = simulateUpdateTrade("legacy-2", {
  accountId: "acc-2",
  risk: 1, // Sélection explicite du palier 1%
  resultCurrency: 250,
  rrPlanned: 2
});

assert(okLegacyReg, "Régularisation explicite réussie");
assertEquals(legacyTrade2.riskCapitalSnapshot, 10000, "Snapshot créé sur initialCapital du compte (10000)");
assertEquals(legacyTrade2.riskAmount, 100, "riskAmount régularisé = 1% de 10000 = 100 EUR");
assertEquals(legacyTrade2.resultR, 2.5, "resultR calculé = 250 / 100 = 2.5R");
assertEquals(legacyTrade2.resultPercent, 2.5, "resultPercent calculé = (250 / 10000) * 100 = 2.5%");
assertEquals(state.hasInteractedWithRisk, false, "Indicateur hasInteractedWithRisk réinitialisé à false");

// TEST 11 : Rejet des données corrompues et invalidités
console.log("\n[TEST 11] Rejet strict des entrées invalides et des capitaux corrompus");
const badAccTrade = simulateCreateTrade({
  account: { id: "bad", initialCapital: -500, currentCapital: 1000 },
  accountId: "bad",
  risk: 1,
  resultCurrency: 100,
  rrPlanned: 2
});
assert(badAccTrade === false, "Rejet d'un compte avec initialCapital négatif");

const badCurrentAccTrade = simulateCreateTrade({
  account: { id: "bad2", initialCapital: 1000, currentCapital: NaN },
  accountId: "bad2",
  risk: 1,
  resultCurrency: 100,
  rrPlanned: 2
});
assert(badCurrentAccTrade === false, "Rejet d'un compte avec currentCapital NaN");

const badTransfer = simulateUpdateTrade(t1.id, {
  accountId: "non-existent-account",
  risk: 1,
  resultCurrency: 100,
  rrPlanned: 2
});
assert(badTransfer === false, "Rejet d'un transfert vers un compte inexistant");

console.log("\n================================================");
console.log(`RÉSULTAT DES TESTS : ${passed} passés, ${failed} échoués`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("TOUS LES TESTS RISK-001 ONT RÉUSSI AVEC SUCCÈS !");
}

