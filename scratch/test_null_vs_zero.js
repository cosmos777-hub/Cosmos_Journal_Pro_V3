/**
 * Test Suite Ciblée — Distinction zéro vs valeur inconnue (null)
 * Vérifie :
 * 1. resultR = 0 conserve "Réel +0.00R" (vrai zéro)
 * 2. resultR = null affiche "Réel —" (indisponibilité)
 * 3. emotionalDeltaR = 0 conserve "Delta +0.00R"
 * 4. emotionalDeltaR = null affiche "Delta —"
 * 5. Plan (theoreticalR) : si resultR ou deltaR est null -> "Plan —", si les deux sont 0 -> "Plan +0.00R"
 * 6. Coach & calculations.generateMission : exclusion des null dans le cumul, conservation des vrais 0
 */
import { calculations } from "../src/core/calculations.js";
import { coachUi } from "../src/ui/coach.js";
import { utils } from "../src/utils/index.js";

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

console.log("=== VÉRIFICATION CIBLÉE : ZÉRO vs VALEUR INCONNUE ===");

// Simulation de la logique de badges du Journal (src/ui/journal.js)
function computeBadges(trade) {
  const hasResultR = typeof trade.resultR === "number" && Number.isFinite(trade.resultR);
  const hasDeltaR = typeof trade.emotionalDeltaR === "number" && Number.isFinite(trade.emotionalDeltaR);
  const hasTheoreticalR = hasResultR && hasDeltaR;

  const resultR = hasResultR ? trade.resultR : null;
  const deltaR = hasDeltaR ? trade.emotionalDeltaR : null;
  const theoreticalR = hasTheoreticalR ? resultR - deltaR : null;

  return [
    { tone: hasResultR ? utils.tone(resultR) : "neutral", label: hasResultR ? `Réel ${utils.formatR(resultR)}` : "Réel —" },
    { tone: hasTheoreticalR ? utils.tone(theoreticalR) : "neutral", label: hasTheoreticalR ? `Plan ${utils.formatR(theoreticalR)}` : "Plan —" },
    { tone: hasDeltaR ? utils.tone(deltaR) : "neutral", label: hasDeltaR ? `Delta ${utils.formatR(deltaR)}` : "Delta —" }
  ];
}

// TEST 1 : Vrai zéro (Trade BE parfait)
console.log("\n[TEST 1] Vrai zéro (resultR: 0, emotionalDeltaR: 0)");
const b1 = computeBadges({ resultR: 0, emotionalDeltaR: 0 });
assertEquals(b1[0].label, "Réel +0.00R", "resultR = 0 affiche 'Réel +0.00R'");
assertEquals(b1[0].tone, "neutral", "tone(0) est neutral");
assertEquals(b1[1].label, "Plan +0.00R", "theoreticalR = 0 affiche 'Plan +0.00R'");
assertEquals(b1[2].label, "Delta +0.00R", "emotionalDeltaR = 0 affiche 'Delta +0.00R'");

// TEST 2 : Valeurs null (ancien trade non régularisé sans riskAmount)
console.log("\n[TEST 2] Valeurs null (resultR: null, emotionalDeltaR: null)");
const b2 = computeBadges({ resultR: null, emotionalDeltaR: null });
assertEquals(b2[0].label, "Réel —", "resultR = null affiche 'Réel —'");
assertEquals(b2[0].tone, "neutral", "tone pour null est neutral");
assertEquals(b2[1].label, "Plan —", "Plan pour null affiche 'Plan —'");
assertEquals(b2[2].label, "Delta —", "emotionalDeltaR = null affiche 'Delta —'");

// TEST 3 : Trade avec résultat valide (2R) mais delta inconnu (null)
console.log("\n[TEST 3] Trade mixte (resultR: 2, emotionalDeltaR: null)");
const b3 = computeBadges({ resultR: 2, emotionalDeltaR: null });
assertEquals(b3[0].label, "Réel +2.00R", "resultR = 2 affiche 'Réel +2.00R'");
assertEquals(b3[0].tone, "positive", "tone(2) est positive");
assertEquals(b3[1].label, "Plan —", "theoreticalR impossible sans delta -> 'Plan —'");
assertEquals(b3[2].label, "Delta —", "emotionalDeltaR = null affiche 'Delta —'");

// TEST 4 : Coach missionPriority — Cumul avec valeurs inconnues
console.log("\n[TEST 4] Coach missionPriority — Échantillon 100% inconnu (null)");
const unknownTrades = [
  { emotionalDeltaR: null },
  { emotionalDeltaR: null },
  { emotionalDeltaR: undefined }
];
const pEmpty = coachUi.missionPriority(unknownTrades);
assert(pEmpty.level !== "high", "Pas de faux déclenchement de priorité haute avec des null");
assertEquals(pEmpty.label, "Maintien du cap", "Statut par défaut propre en l'absence de delta négatif prouvé");

// TEST 5 : Coach missionPriority — Mélange de deltas négatifs et de null
console.log("\n[TEST 5] Coach missionPriority — Mélange de deltas négatifs et de null");
const mixedTrades = [
  { emotionalDeltaR: -2 },
  { emotionalDeltaR: null }, // exclu du cumul, ne remplace pas par 0
  { emotionalDeltaR: -1.5 },
  { emotionalDeltaR: null }
];
// Cumul réel : -2 + (-1.5) = -3.5 < -3 -> Priorité haute !
const pMixed = coachUi.missionPriority(mixedTrades);
assertEquals(pMixed.level, "high", "Priorité haute détectée (-3.5R < -3R) malgré les null intercalés");

// TEST 6 : Coach missionPriority — Vrais zéros conservés dans le cumul
console.log("\n[TEST 6] Coach missionPriority — Vrais zéros conservés");
const zeroTrades = [
  { emotionalDeltaR: 0 },
  { emotionalDeltaR: 0 },
  { emotionalDeltaR: 0 }
];
const pZero = coachUi.missionPriority(zeroTrades);
assert(pZero.level !== "high", "3 trades à 0R ne déclenchent pas d'alarme");

// TEST 7 : calculations.generateMission avec moins de 30 deltas valides
console.log("\n[TEST 7] calculations.generateMission — 5 deltas valides et 25 null");

const sampleTrades = Array.from({ length: 30 }, (_, i) => {
  if (i < 5) return { emotionalDeltaR: -1 };
  return { emotionalDeltaR: null };
});

const mResult = calculations.generateMission(sampleTrades);

assertEquals(
  mResult.title,
  "Continuer à construire l'échantillon",
  "Pas de mission émotionnelle avec seulement 5 deltas valides sur 30 trades"
);

// TEST 8 : calculations.generateMission avec 30 trades où TOUS les deltas sont null
console.log("\n[TEST 8] calculations.generateMission — 30 trades tous à null");
const allNullTrades = Array.from({ length: 30 }, () => ({ emotionalDeltaR: null }));
const mAllNull = calculations.generateMission(allNullTrades);
assert(mAllNull.title !== "Réduire le coût de tes émotions", "Aucune fausse alarme émotionnelle si tous les deltas sont null");

console.log("\n================================================");
console.log(`RÉSULTAT DES VÉRIFICATIONS : ${passed} passés, ${failed} échoués`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("TOUS LES TESTS DE DISTINCTION ONT RÉUSSI AVEC SUCCÈS !");
}

