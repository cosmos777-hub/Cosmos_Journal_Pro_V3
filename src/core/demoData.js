// RP-006 — Onboarding : générateur de trades de démonstration.
//
// Rôle unique : produire un tableau d'objets trade V3 complets ("Wizard 7 cartes"),
// prêts à être insérés dans state.data.trades, sans jamais toucher au DOM ni à
// aucune logique d'affichage (Document 04 §2 : séparation stricte). Réutilise
// exclusivement le moteur de calcul existant (calculations.riskAmount,
// calculations.buildTradeMetricsV3Cards) — les mêmes fonctions que
// actions.createTrade (main.js) — pour ne jamais dupliquer une formule
// (Document 06 §4).
//
// Écart assumé par rapport au ticket : migrations.upgradeTradeV3Calc() n'est
// volontairement PAS utilisée ici. Cette fonction recalcule toujours
// riskAmount/resultR/resultCurrency via le modèle legacy (realPL/theoreticalPL
// en %) après avoir spread l'objet reçu — elle écraserait donc silencieusement
// les résultats du modèle V3 "Wizard 7 cartes" construits ci-dessous. Utiliser
// directement calculations.riskAmount()/buildTradeMetricsV3Cards() (le même
// moteur que actions.createTrade) reste conforme à "réutiliser les mécanismes
// existants" sans ce piège — upgradeTradeV3Calc() est conçue pour la migration/
// normalisation au chargement (storage.load/import), pas pour la création de
// nouveaux trades.
//
// Portée strictement limitée à l'onboarding (RP-006) : pas de flag isDemo, pas
// de compte dédié, pas de filtre supplémentaire. Les trades produits ici sont
// des trades V3 ordinaires, indiscernables des trades réels pour le reste de
// l'application — seul `source: "onboarding-demo"` les distingue, à titre
// strictement documentaire (aucun module ne lit ce champ pour filtrer quoi
// que ce soit).
import { calculations } from "./calculations.js";
import { utils } from "../utils/index.js";

const ASSETS = ["EUR/USD", "GBP/USD", "XAU/USD", "BTC/USD"];
const SESSIONS = ["Asie", "Londres", "New York"];
const STRATEGIES = ["Strat 1 - OB/BPR", "Strat 2 - OB/POC/LIQ"];
const HTF_LIST = ["Weekly", "Daily", "H4", "H1"];
const LTF_LIST = ["M15", "M5", "M1"];
const CONFLUENCES = ["Structure", "Liquidité", "OB", "FVG", "SMT", "Volume"];
const EMOTIONAL_CAUSES = ["Sortie anticipée", "Déplacement SL", "FOMO", "Revenge", "Peur", "Hésitation"];
const TAGS = ["A revoir", "Setup A+", "Erreur", "Patience"];

// Scénario narratif (RP-006 : "une évolution visible") : décrit chaque trade
// dans l'ORDRE CHRONOLOGIQUE (le plus ancien en premier). Les premiers trades
// montrent une discipline irrégulière (interventions manuelles, non-respect
// du plan) ; les derniers trades montrent une exécution plus rigoureuse —
// cohérent avec la mécanique de tendance de Coach (core/progress.js compare
// les trades récents aux précédents).
//   resultR      -> résultat réellement obtenu, en multiples de R
//   rrPlanned    -> RR prévu par le plan (résultat théorique)
//   setupQuality -> 1 à 5 étoiles
//   respect      -> "Oui" / "Partiellement" / "Non"
//   intervention -> "Oui" / "Non"
//   causes       -> nombre de causes émotionnelles piochées (0 si aucune)
const SCENARIO = [
  { resultR: -1,  rrPlanned: 2,   setupQuality: 3, respect: "Non",          intervention: "Oui", causes: 2 },
  { resultR: 1.2, rrPlanned: 2,   setupQuality: 4, respect: "Partiellement", intervention: "Oui", causes: 1 },
  { resultR: -1,  rrPlanned: 2,   setupQuality: 2, respect: "Non",          intervention: "Oui", causes: 2 },
  { resultR: 2,   rrPlanned: 2,   setupQuality: 4, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: -1,  rrPlanned: 3,   setupQuality: 2, respect: "Non",          intervention: "Oui", causes: 2 },
  { resultR: 0,   rrPlanned: 2,   setupQuality: 3, respect: "Partiellement", intervention: "Oui", causes: 1 },
  { resultR: -1,  rrPlanned: 2,   setupQuality: 3, respect: "Non",          intervention: "Oui", causes: 2 },
  { resultR: 1.5, rrPlanned: 2,   setupQuality: 4, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: -1,  rrPlanned: 2,   setupQuality: 2, respect: "Partiellement", intervention: "Oui", causes: 1 },
  { resultR: 2,   rrPlanned: 2,   setupQuality: 5, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: -1,  rrPlanned: 2,   setupQuality: 3, respect: "Non",          intervention: "Oui", causes: 1 },
  { resultR: 1.8, rrPlanned: 2,   setupQuality: 4, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: 2,   rrPlanned: 2,   setupQuality: 4, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: -1,  rrPlanned: 2,   setupQuality: 3, respect: "Partiellement", intervention: "Oui", causes: 1 },
  { resultR: 0.5, rrPlanned: 2,   setupQuality: 3, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: -1,  rrPlanned: 2,   setupQuality: 2, respect: "Non",          intervention: "Oui", causes: 2 },
  { resultR: 3,   rrPlanned: 3,   setupQuality: 5, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: -1,  rrPlanned: 2,   setupQuality: 3, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: 1.5, rrPlanned: 2,   setupQuality: 4, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: -1,  rrPlanned: 2,   setupQuality: 2, respect: "Partiellement", intervention: "Oui", causes: 1 },
  { resultR: 2,   rrPlanned: 2,   setupQuality: 4, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: -1,  rrPlanned: 2,   setupQuality: 3, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: 2.5, rrPlanned: 2.5, setupQuality: 5, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: 0,   rrPlanned: 2,   setupQuality: 3, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: -1,  rrPlanned: 2,   setupQuality: 3, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: 2,   rrPlanned: 2,   setupQuality: 4, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: 1.5, rrPlanned: 2,   setupQuality: 4, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: -1,  rrPlanned: 2,   setupQuality: 3, respect: "Partiellement", intervention: "Oui", causes: 1 },
  { resultR: 2,   rrPlanned: 2,   setupQuality: 5, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: -1,  rrPlanned: 2,   setupQuality: 3, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: 2,   rrPlanned: 2,   setupQuality: 4, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: 1.5, rrPlanned: 2,   setupQuality: 4, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: -1,  rrPlanned: 2,   setupQuality: 3, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: 3,   rrPlanned: 3,   setupQuality: 5, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: 2,   rrPlanned: 2,   setupQuality: 4, respect: "Oui",          intervention: "Non", causes: 0 },
  { resultR: -1,  rrPlanned: 2,   setupQuality: 3, respect: "Oui",          intervention: "Non", causes: 0 }
];

function pick(list, index) {
  return list[((index % list.length) + list.length) % list.length];
}

function buildDateString(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// Construit les `SCENARIO.length` trades V3 complets, chronologiquement
// croissants (le plus ancien en premier), rattachés à `account`. Simule la
// progression du capital trade après trade — même principe que
// actions.createTrade appliqué en boucle — pour que riskAmount et
// riskCapitalSnapshot restent cohérents d'un trade à l'autre.
//
// Retourne { trades, finalCapital } : `trades` est prêt à être inséré tel
// quel dans state.data.trades (après reverse(), pour respecter la convention
// "plus récent en premier" déjà utilisée par actions.createTrade/unshift) ;
// `finalCapital` est le capital du compte après l'ensemble des trades
// simulés, à assigner à account.currentCapital par l'appelant.
export function buildDemoTrades(account) {
  const riskPercent = account.type === "Prop Firm" ? 0.5 : 5;
  let runningCapital = Number(account.currentCapital) || Number(account.initialCapital) || 0;

  const trades = SCENARIO.map((blueprint, index) => {
    const daysAgo = Math.round((SCENARIO.length - index) * 1.5); // étale les trades sur ~7-8 semaines
    const riskCapitalSnapshot = runningCapital;
    const riskAmount = calculations.riskAmount(riskCapitalSnapshot, riskPercent);
    const resultCurrency = +(blueprint.resultR * riskAmount).toFixed(2);

    const metrics = calculations.buildTradeMetricsV3Cards({
      resultCurrency,
      riskAmount,
      riskCapitalSnapshot,
      rrPlanned: blueprint.rrPlanned
    });

    runningCapital = +(runningCapital + metrics.resultCurrency).toFixed(2);

    const asset = pick(ASSETS, index);
    const strategy = pick(STRATEGIES, index);
    const htf = pick(HTF_LIST, index);
    const ltf = pick(LTF_LIST, index + 1);
    const session = pick(SESSIONS, index + 2);
    const confluences = [pick(CONFLUENCES, index), pick(CONFLUENCES, index + 2)];
    const emotionalCauses = blueprint.causes > 0
      ? [pick(EMOTIONAL_CAUSES, index)].concat(blueprint.causes > 1 ? [pick(EMOTIONAL_CAUSES, index + 3)] : [])
      : [];
    const tags = index % 4 === 0 ? [pick(TAGS, index)] : [];

    const dateStr = buildDateString(daysAgo);
    const createdAt = new Date(`${dateStr}T12:00:00`).toISOString();

    return {
      id: utils.uid("trade"),
      accountId: account.id,
      accountName: account.name,
      date: dateStr,
      entryTime: "09:15",
      exitTime: "10:05",
      durationMinutes: 50,
      asset,
      direction: index % 3 === 0 ? "Sell" : "Buy",
      session,
      strategy,
      htf,
      ltf,
      timeframeCombination: `${htf} → ${ltf}`,
      setupQuality: blueprint.setupQuality,
      confluences,
      planRespect: blueprint.respect,
      emotionalCauses,
      manualIntervention: blueprint.intervention,
      notes: "",
      tags,
      media: { htf: null, ltf: null, result: null },
      riskPercent,
      riskCapitalSnapshot,
      riskAmount,
      rrPlanned: blueprint.rrPlanned,
      rrObtained: metrics.resultR,
      realPL: +(metrics.resultR * riskPercent).toFixed(4),
      theoreticalPL: +(metrics.theoreticalResultR * riskPercent).toFixed(4),
      resultPercent: metrics.resultPercent,
      resultR: metrics.resultR,
      resultCurrency: metrics.resultCurrency,
      tradeStatus: metrics.tradeStatus,
      emotionalDelta: +(metrics.resultR * riskPercent).toFixed(4) - +(metrics.theoreticalResultR * riskPercent).toFixed(4),
      emotionalDeltaR: metrics.emotionalDeltaR,
      emotionalDeltaCurrency: metrics.emotionalDeltaCurrency,
      createdAt,
      updatedAt: createdAt,
      source: "onboarding-demo"
    };
  });

  return { trades, finalCapital: runningCapital };
}