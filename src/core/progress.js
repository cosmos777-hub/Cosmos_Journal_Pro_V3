// COACH-003 — Progress Workspace : génération temporaire, pure, sans UI.
//
// Même architecture que core/playbooks.js (COACH-002) : ce fichier ne connaît
// rien du DOM ni de Coach. Il consomme la Mission actuelle + les trades déjà
// chargés en mémoire (state.data.trades, lu en amont par coach.js) et retourne
// un objet métier `Progress` :
//
//   {
//     summary:      string,                              // phrase encourageante
//     indicator:    { level: 1-4, label: string },        // qualitatif, jamais un %
//     trend:        { state: "progress"|"stable"|"regression", label: string },
//     coachComment: string,                                // relié à la Mission
//     state:        "none" | "active" | "completed"
//   }
//
// Important (rappel produit) : la Progression ne mesure PAS la performance
// financière. Elle observe une évolution comportementale (Respect du plan,
// Delta émotionnel), déjà calculée ailleurs (calculations.js) — ce fichier ne
// duplique aucune formule, il se contente de comparer deux fenêtres de trades
// déjà normalisés.
//
// Séparation stricte présentation/génération (même principe que COACH-002) :
// ui/progress.js ne doit JAMAIS importer ce fichier ni connaître son
// existence — il reçoit uniquement l'objet Progress déjà construit. C'est ce
// qui permettra de remplacer ce fichier par le futur Decision Engine
// (COACH_DECISION_ENGINE.md, Progress Tracking §11) sans toucher à l'UI.
//
// COACH-CORR-001 (CORR-002) : la fenêtre "récente" (auparavant 10 trades, une
// valeur propre à ce fichier) provient désormais de core/coachConstants.js,
// partagée avec core/achievements.js — une seule définition du "récent" dans
// tout le module Coach. Comportement : la fenêtre passe de 10 à 20 trades.
//
// COACH-CORR-001 (CORR-001) : computeCoachComment() est désormais explicitement
// tourné vers le PRÉSENT IMMÉDIAT (prochains trades, prochaines séances) — pour
// se distinguer clairement de core/digitalTwin.js, qui parle du LONG TERME
// (habitudes, identité). Les deux messages ne doivent plus être interchangeables.
import { calculations } from "./calculations.js";
import { RECENT_TRADES_WINDOW } from "./coachConstants.js";

const RECENT_WINDOW = RECENT_TRADES_WINDOW;
const TREND_THRESHOLD_R = 0.15;

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Niveau qualitatif (1 à 4) dérivé du taux de respect du plan sur la fenêtre
// récente — jamais affiché comme un pourcentage à l'utilisateur (voir
// ui/progress.js), uniquement utilisé ici pour choisir un palier et un libellé.
function computeIndicator(recentTrades) {
  const planRespect = calculations.planRespectRate(recentTrades);

  if (planRespect == null) return { level: 1, label: "Premiers repères" };
  if (planRespect >= 90) return { level: 4, label: "Ancré" };
  if (planRespect >= 75) return { level: 3, label: "Sur la bonne voie" };
  if (planRespect >= 50) return { level: 2, label: "En construction" };
  return { level: 1, label: "Premiers repères" };
}

// Tendance : compare deux fenêtres de trades consécutives sur le Delta
// émotionnel moyen (déjà calculé par trade, aucune nouvelle formule). Trois
// états seulement (Blueprint) — jamais de régression présentée négativement,
// le libellé reste toujours porté par un ton d'accompagnement.
function computeTrend(recentTrades, previousTrades) {
  if (!previousTrades.length) {
    return {
      state: "stable",
      label: "Encore un peu tôt pour dégager une tendance — continue à documenter tes trades."
    };
  }

  const recentAvg = average(recentTrades.map(t => Number(t.emotionalDeltaR) || 0));
  const previousAvg = average(previousTrades.map(t => Number(t.emotionalDeltaR) || 0));
  const delta = recentAvg - previousAvg;

  if (delta > TREND_THRESHOLD_R) {
    return { state: "progress", label: "Ta discipline récente s'améliore par rapport à la période précédente." };
  }
  if (delta < -TREND_THRESHOLD_R) {
    return { state: "regression", label: "Un léger relâchement récent — rien d'alarmant, remets le cap sur ton Playbook." };
  }
  return { state: "stable", label: "Ta régularité se maintient d'une période à l'autre." };
}

function computeSummary(trend) {
  if (trend.state === "progress") return "Tu progresses de manière régulière.";
  if (trend.state === "regression") return "Les progrès marquent une pause, mais les bases restent en place.";
  return "Continue à appliquer ton plan — la régularité est déjà une réussite.";
}

// COACH-CORR-001 (CORR-001) : ce commentaire reste volontairement ancré dans le
// court terme — la prochaine séance, les prochains trades. Le pendant long terme
// (habitudes, identité) est désormais réservé à digitalTwinUi.coachPerspective
// (core/digitalTwin.js), pour ne plus jamais dire la même chose deux fois.
function computeCoachComment(mission, trend) {
  const base = trend.state === "progress"
    ? "Tes derniers trades montrent une meilleure discipline."
    : trend.state === "regression"
      ? "Tes derniers trades montrent un léger écart, sans remettre en cause ta progression globale."
      : "Tes derniers trades restent cohérents avec ta pratique habituelle.";
  return `${base} Sur tes prochains trades, continue d'appliquer ton Playbook pour progresser sur : ${mission.title.toLowerCase()}.`;
}

// Point d'entrée unique de ce module. Pure : mêmes trades en entrée -> même
// Progress en sortie, aucun effet de bord.
export function buildProgressForMission(mission, trades) {
  // État de sécurité (COACH-003 §États, "Aucun progrès disponible") : ne
  // devrait pas se produire en usage normal, coach.js ne rendant le Progress
  // Workspace qu'une fois l'échantillon Mission déjà suffisant (>= 30 trades) —
  // filet si cette fonction est un jour appelée dans un autre contexte.
  if (!trades.length) {
    return {
      summary: "Pas encore assez d'observations pour mesurer une évolution.",
      indicator: null,
      trend: null,
      coachComment: "Ajoute des trades pour permettre à Coach de suivre ta progression.",
      state: "none"
    };
  }

  const recentTrades = trades.slice(0, RECENT_WINDOW);
  const previousTrades = trades.slice(RECENT_WINDOW, RECENT_WINDOW * 2);

  const trend = computeTrend(recentTrades, previousTrades);
  const indicator = computeIndicator(recentTrades);

  return {
    summary: computeSummary(trend),
    indicator,
    trend,
    coachComment: computeCoachComment(mission, trend),
    // "active" est le seul état atteignable en V1. "completed" (Mission
    // validée) est supporté par la présentation (voir ui/progress.js) mais
    // jamais produit ici tant qu'aucune logique de consolidation n'existe
    // (préparation explicite pour COACH-004, voir note ci-dessous).
    state: "active"
  };
}

// COACH-003 → COACH-004 (préparation Achievements, voir ticket) : expose une
// lecture simple de "consolidation" à partir d'un objet Progress déjà
// construit, SANS ajouter de nouvelle logique de décision — un futur moteur
// d'Achievements pourra s'appuyer sur cette fonction (ou la remplacer) pour
// détecter qu'un comportement est suffisamment stable, sans jamais avoir à
// lire indicator/trend directement ni à connaître leur forme interne.
export function isProgressConsolidated(progress) {
  return Boolean(progress) && progress.state === "active" && progress.indicator && progress.indicator.level >= 4 && progress.trend && progress.trend.state !== "regression";
}