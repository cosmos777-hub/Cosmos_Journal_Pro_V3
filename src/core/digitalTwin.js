// COACH-005 — Digital Twin Workspace : génération temporaire, pure, sans UI.
//
// Même architecture que core/playbooks.js, core/progress.js et
// core/achievements.js (COACH-002/003/004) : ce fichier ne connaît rien du
// DOM ni de Coach. Il ne crée AUCUNE nouvelle information — il synthétise
// uniquement les objets déjà construits par les Workspaces précédents
// (Mission, Playbook, Progress, Achievements) en un portrait qualitatif :
//
//   {
//     portrait:          string,          // portrait qualitatif, une synthèse
//     strengths:         { category, label }[],   // dérivé des Achievements débloqués
//     growthAreas:       string[],         // dérivé des Achievements non débloqués
//     coachPerspective:  string,           // message tourné vers l'avenir
//     state:             "none" | "active" | "consolidated"
//   }
//
// Rappel produit (essentiel, COACH-005) : le Digital Twin est un miroir, pas
// une notation. Ce fichier ne calcule donc rien de nouveau — il relit
// uniquement `achievements.items` (déjà calculé par core/achievements.js) et
// `progress.trend` (déjà calculé par core/progress.js) pour composer un texte
// de synthèse. Aucun accès direct à `trades` ou `calculations` n'est
// nécessaire ici : c'est précisément ce qui garantit qu'aucune formule n'est
// dupliquée entre Achievements, Progress et Digital Twin.
//
// Séparation stricte présentation/génération (même principe que COACH-002/003/004) :
// ui/digitalTwin.js ne doit JAMAIS importer ce fichier ni connaître son
// existence — il reçoit uniquement l'objet DigitalTwin déjà construit.
//
// COACH-CORR-001 (CORR-001) : buildCoachPerspective() est désormais explicitement
// tourné vers le LONG TERME (habitudes qui s'installent, identité qui se
// construit) — pour se distinguer clairement de core/progress.js, dont
// computeCoachComment() parle du présent immédiat (prochains trades, prochaines
// séances). Les deux messages ne doivent plus se ressembler.

// Adjectif de portrait associé à chaque catégorie d'Achievement (COACH-004) —
// vocabulaire volontairement nuancé et réaliste, jamais flatteur de manière
// artificielle (contrainte explicite du ticket).
const TRAIT_ADJECTIVE_BY_CATEGORY = {
  "Discipline": "discipliné",
  "Gestion du risque": "rigoureux dans la gestion du risque",
  "Régularité": "méthodique et régulier",
  "Psychologie": "patient dans son exécution"
};

// Axe de développement associé à chaque catégorie non encore consolidée —
// ton encourageant, jamais culpabilisant (contrainte explicite du ticket).
const GROWTH_PHRASE_BY_CATEGORY = {
  "Discipline": "Renforcer le respect du plan, même dans les moments d'incertitude.",
  "Gestion du risque": "Stabiliser encore la taille de risque appliquée d'un trade à l'autre.",
  "Régularité": "Poursuivre la documentation régulière pour consolider cette base.",
  "Psychologie": "Renforcer la patience sur les sorties plutôt que d'intervenir trop tôt."
};

function joinTraits(traits) {
  if (traits.length === 1) return traits[0];
  return `${traits.slice(0, -1).join(", ")} et ${traits[traits.length - 1]}`;
}

// Nuance apportée par la tendance récente (Progress, COACH-003) — jamais une
// donnée chiffrée, uniquement une clause de phrase supplémentaire. Reste ici
// car elle nourrit le PORTRAIT (photographie actuelle), pas la PERSPECTIVE
// (message d'avenir) — seule cette dernière est concernée par CORR-001.
function trendClause(trend) {
  if (!trend) return "";
  if (trend.state === "progress") return " Cette dynamique se renforce sur tes trades les plus récents.";
  if (trend.state === "regression") return " Une légère pause récente n'efface rien de ce socle déjà construit.";
  return " Cette base reste stable d'une période à l'autre.";
}

function buildPortrait(strengths, progress) {
  if (!strengths.length) {
    return "Ton profil est encore en construction — Coach a besoin de quelques trades supplémentaires pour dessiner tes premiers traits dominants.";
  }
  const traits = strengths.map(s => TRAIT_ADJECTIVE_BY_CATEGORY[s.category] || s.category.toLowerCase());
  return `Tu développes un profil ${joinTraits(traits)}.${trendClause(progress ? progress.trend : null)}`;
}

// COACH-CORR-001 (CORR-001) : message volontairement ancré dans le LONG TERME —
// la construction d'habitudes durables et de l'identité du trader. Le pendant
// court terme (prochains trades) appartient désormais exclusivement à
// core/progress.js (computeCoachComment).
function buildCoachPerspective(mission, strengths) {
  const missionRef = mission && mission.title ? mission.title.toLowerCase() : "ta priorité actuelle";
  if (!strengths.length) {
    return "Ton identité de trader est encore en construction. Chaque trade documenté t'aide à révéler, sur la durée, qui tu es en train de devenir.";
  }
  return `Ces qualités s'installent progressivement comme des habitudes durables. En poursuivant ton travail sur "${missionRef}", tu continues de construire, sur le long terme, le trader que tu deviens.`;
}

// Point d'entrée unique de ce module. Pure : mêmes objets Mission/Playbook/
// Progress/Achievements en entrée -> même DigitalTwin en sortie. `playbook`
// est accepté en paramètre (conforme à la signature demandée par le ticket)
// mais volontairement non exploité par cette V1 — le Playbook est déjà
// référencé indirectement via `mission` dans `coachPerspective`, et son
// contenu détaillé (actions/critères) ne relève pas de la synthèse
// d'identité portée par le Digital Twin.
export function buildDigitalTwin(mission, playbook, progress, achievements) {
  // État de sécurité (COACH-005 §États, "Aucun profil disponible") : reflète
  // directement l'état "none" des Achievements — le Digital Twin ne peut
  // synthétiser une identité tant qu'aucun comportement n'a encore été
  // reconnu (voir core/achievements.js).
  if (!achievements || achievements.state === "none") {
    return {
      portrait: "",
      strengths: [],
      growthAreas: [],
      coachPerspective: "Coach construit progressivement une compréhension de ton profil — reviens après quelques trades supplémentaires.",
      state: "none"
    };
  }

  const strengths = achievements.items
    .filter(item => item.unlocked)
    .map(item => ({ category: item.category, label: item.title }));

  const growthAreas = achievements.items
    .filter(item => !item.unlocked)
    .map(item => GROWTH_PHRASE_BY_CATEGORY[item.category] || `Continuer à développer : ${item.category.toLowerCase()}.`);

  const allConsolidated = achievements.categories.length > 0 && achievements.categories.every(c => c.consolidated);

  return {
    portrait: buildPortrait(strengths, progress),
    strengths,
    growthAreas,
    coachPerspective: buildCoachPerspective(mission, strengths),
    state: allConsolidated ? "consolidated" : "active"
  };
}