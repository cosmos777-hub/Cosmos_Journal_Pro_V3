
import { calculations } from "../src/core/calculations.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log("✓ " + message);
  } else {
    failed++;
    console.error("✗ ÉCHEC : " + message);
  }
}

const missionTitle = "Réduire le coût de tes émotions";

console.log("\n=== TEST DU SEUIL DES 30 DELTAS VALIDES ===");

// TEST 1 : 30 deltas valides
const cas1 = Array.from(
  { length: 30 },
  () => ({ emotionalDeltaR: -0.5 })
);

assert(
  calculations.generateMission(cas1).title === missionTitle,
  "30 deltas valides : mission émotionnelle possible"
);

// TEST 2 : seulement 5 deltas valides sur 30
const cas2 = [
  ...Array.from({ length: 5 }, () => ({ emotionalDeltaR: -1 })),
  ...Array.from({ length: 25 }, () => ({ emotionalDeltaR: null }))
];

assert(
  calculations.generateMission(cas2).title !== missionTitle,
  "5 deltas valides sur 30 : mission émotionnelle bloquée"
);

// TEST 3 : aucun delta valide
const cas3 = Array.from(
  { length: 30 },
  () => ({ emotionalDeltaR: null })
);

assert(
  calculations.generateMission(cas3).title !== missionTitle,
  "0 delta valide : mission émotionnelle bloquée"
);

// TEST 4 : seulement 20 trades
const cas4 = Array.from(
  { length: 20 },
  () => ({ emotionalDeltaR: -1 })
);

assert(
  calculations.generateMission(cas4).title !== missionTitle,
  "20 trades : seuil global non atteint"
);

// TEST 5 : 30 deltas valides sur 40 trades
const cas5 = [
  ...Array.from({ length: 30 }, () => ({ emotionalDeltaR: -0.5 })),
  ...Array.from({ length: 10 }, () => ({ emotionalDeltaR: null }))
];

assert(
  calculations.generateMission(cas5).title === missionTitle,
  "30 deltas valides sur 40 : mission émotionnelle possible"
);

// TEST 6 : 30 vrais zéros
const cas6 = Array.from(
  { length: 30 },
  () => ({ emotionalDeltaR: 0 })
);

assert(
  calculations.generateMission(cas6).title !== "Débloquer les Insights automatiques",
  "30 vrais zéros : le Coach reconnaît un échantillon suffisant"
);

console.log("\n==============================");
console.log(`Résultat : ${passed} réussis, ${failed} échoués`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("TOUS LES TESTS SONT RÉUSSIS.");
}
