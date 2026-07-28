// COACH-004 — Achievements Workspace : génération temporaire, pure, sans UI.
//
// Même architecture que core/playbooks.js (COACH-002) et core/progress.js
// (COACH-003) : ce fichier ne connaît rien du DOM ni de Coach. Il consomme la
// Mission, le Progress déjà construit (COACH-003) et les trades, et retourne
// un objet métier `Achievements` :
//
//   {
//     latest:     Achievement | null,     // dernier Achievement débloqué
//     items:      Achievement[],          // catalogue complet, débloqués ou non
//     categories: { name: string, consolidated: boolean }[],
//     nextHint:   string,                 // encouragement, jamais les conditions exactes
//     state:      "none" | "active"
//   }
//
//   Achievement = { id, category, title, description, unlocked }
//
// Rappel produit (essentiel) : un Achievement n'est jamais un objectif en soi.
// Il ne fait que matérialiser un comportement déjà consolidé — jamais les
// gains, jamais le profit. Ce fichier ne calcule donc que des signaux
// comportementaux déjà disponibles ailleurs (respect du plan, intervention
// manuelle, régularité, constance du risque) — aucune nouvelle formule
// statistique, uniquement des seuils de lecture sur des données existantes.
//
// Séparation stricte présentation/génération (même principe que COACH-002/003) :
// ui/achievements.js ne doit JAMAIS importer ce fichier ni connaître son
// existence — il reçoit uniquement l'objet Achievements déjà construit. C'est
// ce qui permettra de remplacer ce fichier par le futur Decision Engine
// (COACH_DECISION_ENGINE.md, §13 Achievement Recognition) sans toucher à l'UI.
//
// COACH-CORR-001 (CORR-002) : la fenêtre "récente" (auparavant un littéral 20
// propre à ce fichier) provient désormais de core/coachConstants.js, partagée
// avec core/progress.js — une seule définition du "récent" dans tout le module
// Coach. Aucun changement de comportement ici (la valeur reste 20).
import { calculations } from "./calculations.js";
import { RECENT_TRADES_WINDOW } from "./coachConstants.js";

const RECENT_WINDOW = RECENT_TRADES_WINDOW;
const REGULARITY_THRESHOLD = 50;

// Catalogue temporaire (COACH-004 §"Catalogue temporaire") : une entrée par
// catégorie suffit pour cette première version. Chaque `check` est une
// fonction pure (trades[]) -> boolean, jamais persistée, jamais mémorisée —
// recalculée à chaque rendu, exactement comme Mission/Playbook/Progress.
const ACHIEVEMENT_CATALOG = [
  {
    id: "discipline-plan-respect",
    category: "Discipline",
    title: "Fidèle au plan",
    description: "Ton taux de respect du plan reste élevé sur l'ensemble de tes trades.",
    check(trades) {
      const rate = calculations.planRespectRate(trades);
      return rate != null && rate >= 90;
    }
  },
  {
    id: "risk-consistency",
    category: "Gestion du risque",
    title: "Taille de risque maîtrisée",
    description: "Tu appliques une taille de risque constante sur tes trades récents.",
    check(trades) {
      const recent = trades.slice(0, RECENT_WINDOW);
      if (recent.length < RECENT_WINDOW) return false;
      const firstRisk = recent[0].riskPercent;
      return recent.every(t => t.riskPercent === firstRisk);
    }
  },
  {
    id: "regularity-documentation",
    category: "Régularité",
    title: "Journal tenu avec constance",
    description: "Tu documentes tes trades avec une régularité qui construit une base fiable.",
    check(trades) {
      return trades.length >= REGULARITY_THRESHOLD;
    }
  },
  {
    id: "patience-no-intervention",
    category: "Psychologie",
    title: "Patience d'exécution",
    description: "Tu laisses ton plan s'exécuter sans intervention manuelle sur tes trades récents.",
    check(trades) {
      const recent = trades.slice(0, RECENT_WINDOW);
      if (recent.length < RECENT_WINDOW) return false;
      const byIntervention = calculations.groupTradesByDimension(recent, "manualIntervention", []);
      const non = byIntervention.find(g => g.label === "Non");
      const rate = non ? (non.count / recent.length) * 100 : 0;
      return rate >= 90;
    }
  }
];

// Indication de prochaine étape (COACH-004 §"Prochaine étape") : encourage
// sans jamais révéler le seuil exact ni la mécanique de déverrouillage —
// texte volontairement générique par catégorie, jamais dérivé de `check()`.
const NEXT_HINT_BY_CATEGORY = {
  "Discipline": "Continue à respecter ton plan pour renforcer cette compétence.",
  "Gestion du risque": "Garde une taille de risque stable pour consolider cette habitude.",
  "Régularité": "Continue à documenter chaque trade, la régularité paie sur la durée.",
  "Psychologie": "Laisse ton plan s'exécuter sans intervenir pour approfondir cette qualité."
};

// Point d'entrée unique de ce module. Pure : mêmes trades en entrée -> mêmes
// Achievements en sortie, aucun effet de bord. `progress` et `mission` sont
// acceptés en paramètres (conformes à la signature demandée par le ticket)
// mais volontairement non utilisés par la V1 du catalogue ci-dessus — chaque
// `check()` s'appuie uniquement sur `trades`, pour rester indépendant de la
// Mission active (un Achievement de Discipline reste valable quelle que soit
// la Mission en cours). Les paramètres restent dans la signature pour ne pas
// devoir la faire évoluer lors d'un futur ticket qui en aurait besoin.
export function buildAchievements(progress, mission, trades) {
  const items = ACHIEVEMENT_CATALOG.map(entry => ({
    id: entry.id,
    category: entry.category,
    title: entry.title,
    description: entry.description,
    unlocked: entry.check(trades)
  }));

  const unlockedItems = items.filter(item => item.unlocked);

  // Catégorie consolidée (COACH-004 §États) : avec un seul Achievement par
  // catégorie dans ce catalogue temporaire, "consolidée" équivaut à
  // "débloquée" — cette structure reste néanmoins prête à accueillir
  // plusieurs Achievements par catégorie sans changer la forme de l'objet
  // Achievements exposé au composant de présentation.
  const categories = Array.from(new Set(items.map(item => item.category))).map(name => ({
    name,
    consolidated: items.filter(item => item.category === name).every(item => item.unlocked)
  }));

  // Dernier Achievement débloqué : en l'absence de toute persistance/horodatage
  // (hors périmètre, voir Contraintes importantes), on retient le dernier du
  // catalogue dans son ordre de déclaration parmi ceux débloqués — approximation
  // volontairement simple, cohérente avec "aucune persistance spécifique au
  // Playbook/Progress/Achievements" déjà actée depuis COACH-002.
  const latest = unlockedItems.length ? unlockedItems[unlockedItems.length - 1] : null;

  const firstLocked = items.find(item => !item.unlocked);
  const nextHint = firstLocked
    ? NEXT_HINT_BY_CATEGORY[firstLocked.category] || "Continue à progresser, la reconnaissance vient avec la régularité."
    : "Toutes les compétences suivies sont actuellement consolidées — continue à les entretenir.";

  return {
    latest,
    items,
    categories,
    nextHint,
    state: unlockedItems.length ? "active" : "none"
  };
}